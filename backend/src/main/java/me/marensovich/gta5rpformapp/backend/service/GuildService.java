package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Service for managing {@link Guild} entities.
 * <p>
 * There is no bot-install flow yet (webhooks are still pasted in manually —
 * see {@code WebhookService}), so a Guild row is created lazily the first
 * time its Discord ID is referenced by a form. Its name is fetched from
 * Discord via the bot token when available; if the bot isn't in that guild
 * (or no bot token is configured), the ID itself is used as a placeholder
 * name and corrected the next time this guild is looked up after the bot
 * gains access.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class GuildService {

    private final GuildRepository guildRepository;
    private final DiscordBotClient discordBotClient;
    private final me.marensovich.gta5rpformapp.backend.service.NotificationService notificationService;
    private final AuditLogService auditLogService;

    /**
     * Retrieves the {@link Guild} for the given Discord guild ID, creating it
     * if it does not exist yet. If the stored name is still the placeholder
     * (the ID itself), a real name is fetched again in case the bot has since
     * been added to the guild.
     *
     * @param discordGuildId the Discord guild snowflake ID
     * @return the existing or newly created {@link Guild}
     * @since v.0.1
     */
    @Transactional
    public Guild getOrCreate(Long discordGuildId) {
        return guildRepository.findById(discordGuildId)
                .map(guild -> refreshNameIfPlaceholder(guild, discordGuildId))
                .orElseGet(() -> {
                    Guild guild = new Guild();
                    guild.setDiscordGuildId(discordGuildId);
                    guild.setName(fetchRealName(discordGuildId).orElse(discordGuildId.toString()));
                    guild.setBotStatus(GuildBotStatus.CONNECTED);
                    return guildRepository.save(guild);
                });
    }

    private Guild refreshNameIfPlaceholder(Guild guild, Long discordGuildId) {
        if (!guild.getName().equals(discordGuildId.toString())) return guild;
        fetchRealName(discordGuildId).ifPresent(guild::setName);
        return guildRepository.save(guild);
    }

    /**
     * Marks a guild as no longer reachable by the bot (kicked, or the bot's
     * invite was revoked). A no-op if the guild is already marked kicked, or
     * if no row exists for it yet.
     *
     * @param discordGuildId the Discord guild snowflake ID
     * @since v.0.1
     */
    @Transactional
    public void markKicked(Long discordGuildId) {
        guildRepository.findById(discordGuildId).ifPresent(guild -> {
            if (guild.getBotStatus() != GuildBotStatus.KICKED) {
                guild.setBotStatus(GuildBotStatus.KICKED);
                guildRepository.save(guild);
                logBot(discordGuildId, me.marensovich.gta5rpformapp.backend.data.audit.AuditAction.BOT_REMOVED, null);
                notificationService.notifyOwner(discordGuildId, me.marensovich.gta5rpformapp.backend.data.notifications.NotificationType.BOT_REMOVED, discordGuildId.toString(),
                        java.util.Map.of("server", guild.getName() != null ? guild.getName() : discordGuildId.toString()),
                        "/dashboard/servers");
            }
        });
    }

    /**
     * Marks a guild as reachable by the bot again — used when the bot is
     * reinstalled on a guild it was previously kicked from (see
     * {@code GuildConnectController}). A no-op if the guild is already
     * marked connected, or if no row exists for it yet.
     *
     * @param discordGuildId the Discord guild snowflake ID
     * @since v.0.1
     */
    @Transactional
    public void markConnected(Long discordGuildId) {
        guildRepository.findById(discordGuildId).ifPresent(guild -> {
            if (guild.getBotStatus() != GuildBotStatus.CONNECTED) {
                guild.setBotStatus(GuildBotStatus.CONNECTED);
                guildRepository.save(guild);
                logBot(discordGuildId, me.marensovich.gta5rpformapp.backend.data.audit.AuditAction.BOT_RECONNECTED, null);
            }
        });
    }

    /** A problem with the bot, or its end, in the server's journal (ТЗ 4.6.1). */
    private void logBot(Long guildId, me.marensovich.gta5rpformapp.backend.data.audit.AuditAction action,
                        java.util.Map<String, Object> metadata) {
        auditLogService.logGuildActionAs(null, "Discord", guildId, action, "BOT", guildId.toString(), null, metadata, null);
    }

    /**
     * Re-reads a server's name, icon, member count and the bot's permissions
     * from Discord (#124). A server the bot can't see any more is marked
     * kicked; one it sees again, connected. Without a bot session nothing changes.
     *
     * @param discordGuildId the server
     * @since v.0.1
     */
    @Transactional
    public void sync(Long discordGuildId) {
        if (!discordBotClient.isAvailable()) return;
        Guild guild = guildRepository.findById(discordGuildId).orElse(null);
        if (guild == null) return;
        Optional<DiscordBotClient.GuildState> state = discordBotClient.fetchGuildState(discordGuildId);
        if (state.isEmpty()) {
            markKicked(discordGuildId);
            return;
        }
        DiscordBotClient.GuildState s = state.get();
        guild.setName(s.name());
        guild.setIconHash(s.icon());
        guild.setMemberCount(s.memberCount());
        String missing = String.join(",", s.missingPermissions());
        boolean wasMissing = guild.getMissingPermissions() != null && !guild.getMissingPermissions().isBlank();
        if (!missing.isEmpty() && !wasMissing) {
            logBot(discordGuildId, me.marensovich.gta5rpformapp.backend.data.audit.AuditAction.BOT_PERMISSIONS_MISSING,
                    java.util.Map.of("permissions", s.missingPermissions()));
        }
        guild.setMissingPermissions(missing);
        guild.setSyncedAt(LocalDateTime.now());
        guild.setBotStatus(GuildBotStatus.CONNECTED);
        guildRepository.save(guild);
    }

    private Optional<String> fetchRealName(Long discordGuildId) {
        return discordBotClient.fetchGuild(discordGuildId).map(DiscordBotClient.DiscordGuildInfo::name);
    }
}
