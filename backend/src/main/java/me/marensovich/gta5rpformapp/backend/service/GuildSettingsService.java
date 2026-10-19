package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.dto.guild.GuildSettingsDto;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordApiClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordTokenService;
import me.marensovich.gta5rpformapp.backend.service.discord.WebhookUrlCipher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * A server's own settings (2026-10-19): its admin roles — their holders own
 * the server in MarForms, which is not the platform's ownership — and the log
 * channels the bot creates for it.
 *
 * @author marensovich
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GuildSettingsService {

    /** At most this many admin roles per server. */
    static final int MAX_ADMIN_ROLES = 25;

    private final GuildRepository guildRepository;
    private final GuildMembershipRepository guildMembershipRepository;
    private final GuildMembershipService guildMembershipService;
    private final DiscordBotClient discordBotClient;
    private final DiscordApiClient discordApiClient;
    private final DiscordTokenService discordTokenService;
    private final WebhookUrlCipher webhookUrlCipher;
    private final AuditLogService auditLogService;
    private final GuildLogService guildLogService;

    /**
     * The server's admin roles and log channels, as the settings tab shows them.
     *
     * @param guildId the Discord guild snowflake ID
     * @return its settings
     * @throws NotFoundException if MarForms doesn't know the server
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public GuildSettingsDto view(Long guildId) {
        return toDto(require(guildId), null);
    }

    /**
     * Sets the server's admin roles. Owners through a role that is no longer
     * an admin one lose that on their next request; the log channels are
     * given to the new roles if Discord lets the bot change their access.
     *
     * @param guildId the Discord guild snowflake ID
     * @param roleIds the roles, all of the server's and not {@code @everyone}
     * @return the settings, with whether the channels' access followed
     * @throws IllegalArgumentException if a role isn't one of the server's
     * @since v.0.1
     */
    @Transactional
    public GuildSettingsDto setAdminRoles(Long guildId, Collection<Long> roleIds) {
        Guild guild = require(guildId);
        Set<Long> next = new HashSet<>(roleIds);
        if (next.size() > MAX_ADMIN_ROLES) throw new IllegalArgumentException("At most " + MAX_ADMIN_ROLES + " admin roles");
        Map<Long, DiscordBotClient.DiscordRole> serverRoles = discordBotClient.fetchRoles(guildId);
        for (Long id : next) {
            if (id.equals(guildId) || !serverRoles.containsKey(id)) {
                throw new IllegalArgumentException("Not a role of this server: " + id);
            }
        }
        Set<Long> previous = Set.copyOf(guild.getAdminRoleIds());
        if (previous.equals(next)) return toDto(guild, null);

        guild.getAdminRoleIds().clear();
        guild.getAdminRoleIds().addAll(next);
        guildRepository.save(guild);
        // Owners through a role are checked again on their next request.
        for (GuildMembership m : guildMembershipRepository.findAllByGuild_DiscordGuildIdAndRole(guildId, GuildRole.OWNER)) {
            if (m.isOwnerByAdminRole()) {
                m.setStaffVerifiedAt(null);
                guildMembershipRepository.save(m);
            }
        }

        Boolean accessUpdated = null;
        List<Long> channels = logChannelIds(guild);
        if (!channels.isEmpty()) accessUpdated = discordBotClient.updateLogChannelAccess(guildId, channels, previous, next);

        auditLogService.logGuildAction(guildId, AuditAction.GUILD_ADMIN_ROLES_CHANGED, "GUILD", guildId.toString(),
                guild.getName(), Map.of("from", names(previous, serverRoles), "to", names(next, serverRoles)),
                "Admin roles: " + label(previous, serverRoles) + " → " + label(next, serverRoles));
        return toDto(guild, accessUpdated);
    }

    /**
     * Creates the server's log category with #ответы and #аудит, seen by the
     * admin roles. Channels that are still there are kept: only a set with a
     * channel gone is created anew.
     *
     * @param guildId the Discord guild snowflake ID
     * @return the settings with the channels
     * @throws InvalidStateException if both channels exist, or the bot couldn't create them
     * @since v.0.1
     */
    @Transactional
    public GuildSettingsDto createLogChannels(Long guildId) {
        Guild guild = require(guildId);
        boolean responses = discordBotClient.channelName(guildId, guild.getLogResponsesChannelId()).isPresent();
        boolean audit = discordBotClient.channelName(guildId, guild.getLogAuditChannelId()).isPresent();
        if (responses && audit && guild.getLogResponsesWebhook() != null && guild.getLogAuditWebhook() != null) {
            throw new InvalidStateException("The log channels already exist");
        }
        DiscordBotClient.LogChannels created = discordBotClient.createLogChannels(guildId, guild.getAdminRoleIds())
                .orElseThrow(() -> new InvalidStateException(
                        "The bot could not create the channels — it needs Manage Channels on the server"));
        guild.setLogCategoryId(created.categoryId());
        guild.setLogResponsesChannelId(created.responsesChannelId());
        guild.setLogResponsesWebhook(webhookUrlCipher.seal(created.responsesWebhook().url()));
        guild.setLogAuditChannelId(created.auditChannelId());
        guild.setLogAuditWebhook(webhookUrlCipher.seal(created.auditWebhook().url()));
        guildRepository.save(guild);

        guildLogService.sendNow(created.responsesWebhook().url(), greeting(
                "Сюда будут приходить новые ответы на формы сервера и решения по ним."));
        guildLogService.sendNow(created.auditWebhook().url(), greeting(
                "Сюда будет приходить журнал сервера: изменения форм, команды и настроек."));
        auditLogService.logGuildAction(guildId, AuditAction.GUILD_LOG_CHANNELS_CREATED, "GUILD", guildId.toString(),
                guild.getName(), Map.of("channels", List.of(DiscordBotClient.LOG_RESPONSES_CHANNEL_NAME,
                        DiscordBotClient.LOG_AUDIT_CHANNEL_NAME)),
                "#" + DiscordBotClient.LOG_RESPONSES_CHANNEL_NAME + ", #" + DiscordBotClient.LOG_AUDIT_CHANNEL_NAME);
        return toDto(guild, null);
    }

    /**
     * Makes a user an owner of the connected servers where they hold an admin
     * role. Their servers come from their own Discord token; their roles on
     * each from the bot.
     *
     * @param user the signed-in user
     * @since v.0.1
     */
    @Transactional
    public void claimAdminRoleOwnerships(User user) {
        Set<Long> theirs = discordTokenService.getValidAccessToken(user.getId())
                .flatMap(discordApiClient::fetchUserGuildIds).orElse(Set.of());
        if (theirs.isEmpty()) return;
        for (Guild guild : guildRepository.findAllById(theirs)) {
            if (guild.getBotStatus() != GuildBotStatus.CONNECTED || guild.getAdminRoleIds().isEmpty()) continue;
            Long guildId = guild.getDiscordGuildId();
            GuildMembership current = guildMembershipRepository
                    .findByUser_IdAndGuild_DiscordGuildId(user.getId(), guildId).orElse(null);
            if (current != null && current.getRole() == GuildRole.OWNER) continue;
            List<Long> roles = discordBotClient.fetchMemberRoleIds(guildId, user.getDiscordId()).orElse(List.of());
            if (roles.stream().noneMatch(guild.getAdminRoleIds()::contains)) continue;

            GuildMembership owner = guildMembershipService.ensureMembership(user.getDiscordId(), guildId, GuildRole.OWNER);
            owner.setOwnerByAdminRole(true);
            owner.setStaffVerifiedAt(LocalDateTime.now());
            guildMembershipRepository.save(owner);
            auditLogService.logGuildActionAs(null, "Discord check", guildId, AuditAction.GUILD_ROLE_GRANTED, "USER",
                    user.getDiscordId().toString(), user.getDiscordUsername(), Map.of("role", GuildRole.OWNER.name()),
                    "Holds an admin role of the server");
        }
    }

    private Guild require(Long guildId) {
        return guildRepository.findById(guildId).orElseThrow(() -> new NotFoundException("Server not found: " + guildId));
    }

    private static List<Long> logChannelIds(Guild guild) {
        List<Long> ids = new ArrayList<>();
        if (guild.getLogCategoryId() != null) ids.add(guild.getLogCategoryId());
        if (guild.getLogResponsesChannelId() != null) ids.add(guild.getLogResponsesChannelId());
        if (guild.getLogAuditChannelId() != null) ids.add(guild.getLogAuditChannelId());
        return ids;
    }

    private GuildSettingsDto toDto(Guild guild, Boolean accessUpdated) {
        Long guildId = guild.getDiscordGuildId();
        Map<Long, DiscordBotClient.DiscordRole> serverRoles = discordBotClient.fetchRoles(guildId);
        List<GuildSettingsDto.Role> roles = guild.getAdminRoleIds().stream().sorted()
                .map(id -> {
                    DiscordBotClient.DiscordRole r = serverRoles.get(id);
                    return new GuildSettingsDto.Role(id.toString(), r != null ? r.name() : null, r != null ? r.color() : 0,
                            !serverRoles.isEmpty() && r == null);
                }).toList();
        return new GuildSettingsDto(roles,
                channel(guildId, guild.getLogResponsesChannelId(), guild.getLogResponsesWebhook()),
                channel(guildId, guild.getLogAuditChannelId(), guild.getLogAuditWebhook()),
                !guild.missingPermissionList().contains("MANAGE_CHANNEL"),
                accessUpdated);
    }

    private GuildSettingsDto.Channel channel(Long guildId, Long channelId, String webhook) {
        if (channelId == null || webhook == null) return null;
        String name = discordBotClient.channelName(guildId, channelId).orElse(null);
        return new GuildSettingsDto.Channel(channelId.toString(), name);
    }

    private static List<String> names(Set<Long> ids, Map<Long, DiscordBotClient.DiscordRole> roles) {
        return ids.stream().sorted().map(id -> roles.containsKey(id) ? roles.get(id).name() : id.toString()).toList();
    }

    private static String label(Set<Long> ids, Map<Long, DiscordBotClient.DiscordRole> roles) {
        return ids.isEmpty() ? "none" : String.join(", ", names(ids, roles).stream().map(Objects::toString).toList());
    }

    private static Map<String, Object> greeting(String text) {
        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", "Канал логов MarForms");
        embed.put("description", text + " Канал видят админ-роли сервера и его администраторы.");
        embed.put("color", 0x5865F2);
        return embed;
    }
}
