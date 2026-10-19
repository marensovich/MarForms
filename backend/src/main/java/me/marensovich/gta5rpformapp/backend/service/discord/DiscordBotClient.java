package me.marensovich.gta5rpformapp.backend.service.discord;

import lombok.extern.slf4j.Slf4j;
import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.Webhook;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.entities.channel.middleman.GuildChannel;
import net.dv8tion.jda.api.exceptions.ErrorResponseException;
import net.dv8tion.jda.api.requests.ErrorResponse;
import net.dv8tion.jda.api.utils.data.DataObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Client for interacting with the Discord API using the bot's own JDA session.
 * <p>
 * Distinct from {@link DiscordApiClient}, which acts on behalf of a signed-in
 * user with their OAuth2 access token. Every call here degrades gracefully
 * (returns empty) rather than throwing — the bot may not have been added to
 * a given guild, may lack permissions, or no {@code JDA} bean may exist at
 * all (see {@code JdaConfig} — happens when {@code discord.bot.token} isn't
 * configured, e.g. in tests).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
public class DiscordBotClient {

    @Nullable
    private final JDA jda;

    @Autowired(required = false)
    public DiscordBotClient(@Nullable JDA jda) {
        this.jda = jda;
    }

    /**
     * Whether a live bot session is available at all.
     * <p>
     * Callers that need to distinguish "the bot isn't configured in this
     * environment" from "the bot is configured but was kicked from this
     * particular guild" (e.g. {@code GuildStatusReconciler}) should check
     * this first — every other method here already returns an empty result
     * in both cases, which is indistinguishable on its own.
     * </p>
     *
     * @return {@code true} if a {@link JDA} session is connected
     * @since v.0.1
     */
    public boolean isAvailable() {
        return jda != null;
    }

    /**
     * Fetches a guild's real name and icon hash, if the bot is a member of it.
     *
     * @param guildId the Discord guild snowflake ID
     * @return the guild info, or empty if unavailable for any reason
     * @since v.0.1
     */
    public Optional<DiscordGuildInfo> fetchGuild(Long guildId) {
        if (jda == null) return Optional.empty();
        try {
            Guild guild = jda.getGuildById(guildId);
            if (guild == null) return Optional.empty();
            return Optional.of(new DiscordGuildInfo(guild.getId(), guild.getName(), guild.getIconId()));
        } catch (Exception e) {
            log.warn("Failed to fetch guild {} via bot: {}", guildId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * What the bot needs on a server (ТЗ 7.1): see its channels, create
     * webhooks in them, create the server's log channels and set its own
     * nickname there (2026-10-19). Reading members
     * and their roles goes through the API and needs no permission, so a
     * revoked role is noticed without Manage Roles — the bot never changes
     * roles, and doesn't ask for that right (2026-10-19).
     *
     * @since v.0.1
     */
    public static final List<Permission> REQUIRED_PERMISSIONS =
            List.of(Permission.VIEW_CHANNEL, Permission.MANAGE_WEBHOOKS, Permission.MANAGE_CHANNEL, Permission.NICKNAME_CHANGE);

    /** The log category and its channel, as the bot names them. */
    public static final String LOG_CATEGORY_NAME = "MarForms";
    public static final String LOG_AUDIT_CHANNEL_NAME = "аудит";

    /**
     * A server as the bot sees it now (#124).
     *
     * @param name               its name
     * @param icon               its icon hash
     * @param memberCount        approximate member count
     * @param missingPermissions {@link #REQUIRED_PERMISSIONS} the bot lacks, by name
     */
    public record GuildState(String name, String icon, int memberCount, List<String> missingPermissions) {
    }

    /**
     * Reads a server's name, icon, member count and the bot's missing permissions.
     *
     * @param guildId the Discord guild snowflake ID
     * @return the state, or empty if the bot isn't on the server or there is no bot
     * @since v.0.1
     */
    public Optional<GuildState> fetchGuildState(Long guildId) {
        if (jda == null) return Optional.empty();
        try {
            Guild guild = jda.getGuildById(guildId);
            if (guild == null) return Optional.empty();
            Member self = guild.getSelfMember();
            List<String> missing = REQUIRED_PERMISSIONS.stream()
                    .filter(p -> !self.hasPermission(p)).map(Permission::name).toList();
            return Optional.of(new GuildState(guild.getName(), guild.getIconId(), guild.getMemberCount(), missing));
        } catch (Exception e) {
            log.warn("Failed to read the state of guild {} via bot: {}", guildId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Fetches the text channels of a guild that the bot can both see and
     * create webhooks in.
     *
     * @param guildId the Discord guild snowflake ID
     * @return the guild's eligible text channels, or an empty list if unavailable
     * @since v.0.1
     */
    public List<DiscordChannel> fetchTextChannels(Long guildId) {
        if (jda == null) return List.of();
        try {
            Guild guild = jda.getGuildById(guildId);
            if (guild == null) return List.of();
            var self = guild.getSelfMember();
            return guild.getTextChannels().stream()
                    .filter(channel -> self.hasPermission(channel, Permission.VIEW_CHANNEL, Permission.MANAGE_WEBHOOKS))
                    .map(channel -> new DiscordChannel(channel.getId(), channel.getName(), 0))
                    .toList();
        } catch (Exception e) {
            log.warn("Failed to fetch channels for guild {}: {}", guildId, e.getMessage());
            return List.of();
        }
    }

    /**
     * Creates a webhook in the given channel.
     * <p>
     * Requires the bot to have {@code MANAGE_WEBHOOKS} on that channel — see
     * product spec раздел 4.1. Callers are responsible for persisting the
     * returned URL; Discord does not let it be retrieved again later, only
     * the webhook's ID (not its token).
     * </p>
     *
     * @param guildId   the guild the channel must belong to — prevents an
     *                  owner of one guild from creating webhooks in another
     *                  guild's channel just by knowing its ID
     * @param channelId the Discord channel snowflake ID
     * @param name      the webhook's display name (shown as the message sender)
     * @return the created webhook, or empty if the bot lacks access/permission,
     *         the channel isn't in {@code guildId}, or no bot session is available
     * @since v.0.1
     */
    public Optional<CreatedWebhook> createWebhook(Long guildId, Long channelId, String name) {
        if (jda == null) return Optional.empty();
        try {
            TextChannel channel = jda.getTextChannelById(channelId);
            if (channel == null || channel.getGuild().getIdLong() != guildId) return Optional.empty();
            Webhook webhook = channel.createWebhook(name).complete();
            return Optional.of(new CreatedWebhook(webhook.getId(), webhook.getToken()));
        } catch (Exception e) {
            log.warn("Failed to create webhook in channel {}: {}", channelId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * The log channel the bot created on a server: a category with #аудит
     * in it, and the channel's webhook.
     */
    public record LogChannels(long categoryId, long auditChannelId, CreatedWebhook auditWebhook) {
    }

    /**
     * Creates the log category at the top of the server, with #аудит in it,
     * hidden from everyone but the admin roles (server
     * administrators see every channel anyway). The access is set while the
     * channels are created: that takes Manage Channels only, while changing
     * it later would take Manage Roles, which the bot doesn't ask for.
     *
     * @param guildId      the Discord guild snowflake ID
     * @param adminRoleIds the roles that see the channels; ones not on the server are skipped
     * @return the channels, empty if the bot couldn't create them
     * @since v.0.1
     */
    public Optional<LogChannels> createLogChannels(Long guildId, java.util.Collection<Long> adminRoleIds) {
        if (jda == null) return Optional.empty();
        try {
            Guild guild = jda.getGuildById(guildId);
            if (guild == null) return Optional.empty();
            List<Long> roles = adminRoleIds.stream().filter(id -> guild.getRoleById(id) != null).toList();
            var categoryAction = guild.createCategory(LOG_CATEGORY_NAME).setPosition(0);
            hideFromEveryone(categoryAction, guild, roles);
            var category = categoryAction.complete();
            TextChannel audit = hideFromEveryone(category.createTextChannel(LOG_AUDIT_CHANNEL_NAME), guild, roles).complete();
            Webhook auditHook = audit.createWebhook(LOG_CATEGORY_NAME).complete();
            return Optional.of(new LogChannels(category.getIdLong(),
                    audit.getIdLong(), new CreatedWebhook(auditHook.getId(), auditHook.getToken())));
        } catch (Exception e) {
            log.warn("Failed to create the log channels of guild {}: {}", guildId, e.getMessage());
            return Optional.empty();
        }
    }

    private static <T extends net.dv8tion.jda.api.requests.restaction.ChannelAction<?>> T hideFromEveryone(
            T action, Guild guild, List<Long> roles) {
        action.addRolePermissionOverride(guild.getIdLong(), List.of(), List.of(Permission.VIEW_CHANNEL));
        for (Long role : roles) action.addRolePermissionOverride(role, List.of(Permission.VIEW_CHANNEL), List.of());
        action.addMemberPermissionOverride(guild.getSelfMember().getIdLong(),
                List.of(Permission.VIEW_CHANNEL, Permission.MANAGE_WEBHOOKS), List.of());
        return action;
    }

    /**
     * Gives the log channels to a new set of admin roles. Discord asks Manage
     * Roles for this; without it the access stays as it was.
     *
     * @param guildId    the Discord guild snowflake ID
     * @param channelIds the category and its channels
     * @param previous   the roles that saw them
     * @param current    the roles that should see them
     * @return whether Discord took the change
     * @since v.0.1
     */
    public boolean updateLogChannelAccess(Long guildId, List<Long> channelIds,
                                          java.util.Collection<Long> previous, java.util.Collection<Long> current) {
        if (jda == null) return false;
        try {
            Guild guild = jda.getGuildById(guildId);
            if (guild == null) return false;
            for (Long id : channelIds) {
                GuildChannel channel = guild.getGuildChannelById(id);
                if (!(channel instanceof net.dv8tion.jda.api.entities.channel.attribute.IPermissionContainer container)) continue;
                var manager = container.getPermissionContainer().getManager();
                for (Long role : previous) if (!current.contains(role)) manager.removePermissionOverride(role);
                for (Long role : current) {
                    if (guild.getRoleById(role) != null) manager.putRolePermissionOverride(role, List.of(Permission.VIEW_CHANNEL), List.of());
                }
                manager.complete();
            }
            return true;
        } catch (Exception e) {
            log.info("Could not change who sees the log channels of guild {}: {}", guildId, e.getMessage());
            return false;
        }
    }

    /**
     * How the bot looks on one server (2026-10-19): Discord keeps a nickname,
     * avatar, banner and «Обо мне» per server; {@code null} = the account's own.
     *
     * @param username    the bot account's name
     * @param nickname    its nickname on the server
     * @param avatarUrl   its avatar on the server
     * @param bannerUrl   its banner on the server
     * @param accountAvatarUrl the account's avatar, shown when there's none on the server
     */
    public record BotProfile(String username, String nickname, String avatarUrl, String bannerUrl, String accountAvatarUrl) {
    }

    /**
     * The bot's profile on a server.
     *
     * @return the profile, empty without a bot session or if the bot isn't on the server
     * @since v.0.1
     */
    public Optional<BotProfile> fetchBotProfile(Long guildId) {
        if (jda == null) return Optional.empty();
        Guild guild = jda.getGuildById(guildId);
        if (guild == null) return Optional.empty();
        Member self = guild.getSelfMember();
        return Optional.of(new BotProfile(self.getUser().getName(), self.getNickname(), self.getAvatarUrl(),
                self.getBannerUrl(), self.getUser().getEffectiveAvatarUrl()));
    }

    /** How a profile change went. */
    public enum ProfileResult {
        OK,
        /** No bot session, or the bot isn't on the server. */
        NO_BOT,
        /** A nickname needs Change Nickname. */
        MISSING_PERMISSIONS,
        /** Discord refused it (a bad image, rate limits). */
        FAILED
    }

    /**
     * Changes the bot's profile on one server; the other servers keep theirs.
     *
     * @param nickname {@code null} keeps it, empty resets it to the account's name
     * @param avatar   {@code null} keeps it, empty resets it, else the image's bytes
     * @param banner   the same, for the banner
     * @param bio      {@code null} keeps it, empty clears it
     * @return how it went
     * @since v.0.1
     */
    public ProfileResult updateBotProfile(Long guildId, @Nullable String nickname, @Nullable byte[] avatar,
                                          @Nullable byte[] banner, @Nullable String bio) {
        if (jda == null) return ProfileResult.NO_BOT;
        Guild guild = jda.getGuildById(guildId);
        if (guild == null) return ProfileResult.NO_BOT;
        try {
            var manager = guild.getSelfMember().getManager();
            if (nickname != null) manager.setNickname(nickname.isBlank() ? null : nickname.trim());
            if (avatar != null) manager.setAvatar(avatar.length == 0 ? null : net.dv8tion.jda.api.entities.Icon.from(avatar));
            if (banner != null) manager.setBanner(banner.length == 0 ? null : net.dv8tion.jda.api.entities.Icon.from(banner));
            if (bio != null) manager.setBio(bio.isBlank() ? null : bio.trim());
            manager.complete();
            return ProfileResult.OK;
        } catch (net.dv8tion.jda.api.exceptions.InsufficientPermissionException e) {
            return ProfileResult.MISSING_PERMISSIONS;
        } catch (Exception e) {
            log.warn("Failed to change the bot's profile on guild {}: {}", guildId, e.getMessage());
            return ProfileResult.FAILED;
        }
    }

    /**
     * The bot's status and activity — one for every server, a Discord rule.
     *
     * @param status   ONLINE, IDLE, DO_NOT_DISTURB or INVISIBLE
     * @param activity PLAYING, LISTENING, WATCHING, COMPETING or CUSTOM; anything else = none
     * @param text     the activity's text; blank = none
     * @since v.0.1
     */
    public void setPresence(String status, String activity, String text) {
        if (jda == null) return;
        net.dv8tion.jda.api.OnlineStatus online;
        try {
            online = net.dv8tion.jda.api.OnlineStatus.valueOf(status);
        } catch (Exception e) {
            online = net.dv8tion.jda.api.OnlineStatus.ONLINE;
        }
        net.dv8tion.jda.api.entities.Activity shown = text == null || text.isBlank() ? null : switch (activity == null ? "" : activity) {
            case "PLAYING" -> net.dv8tion.jda.api.entities.Activity.playing(text);
            case "LISTENING" -> net.dv8tion.jda.api.entities.Activity.listening(text);
            case "WATCHING" -> net.dv8tion.jda.api.entities.Activity.watching(text);
            case "COMPETING" -> net.dv8tion.jda.api.entities.Activity.competing(text);
            case "CUSTOM" -> net.dv8tion.jda.api.entities.Activity.customStatus(text);
            default -> null;
        };
        jda.getPresence().setPresence(online, shown);
    }

    /**
     * A channel's name, if the bot sees it.
     *
     * @return its name, empty if it's gone or there is no bot
     * @since v.0.1
     */
    public Optional<String> channelName(Long guildId, Long channelId) {
        if (jda == null || channelId == null) return Optional.empty();
        Guild guild = jda.getGuildById(guildId);
        GuildChannel channel = guild == null ? null : guild.getGuildChannelById(channelId);
        return channel == null ? Optional.empty() : Optional.of(channel.getName());
    }

    /**
     * Fetches the Discord role IDs a user currently holds on a guild
     * ({@code GET /guilds/{guild.id}/members/{user.id}}, via JDA).
     * <p>
     * A single-member REST lookup does <b>not</b> need the privileged
     * {@code GUILD_MEMBERS} intent (only member <i>listing</i> and member
     * Gateway events do), so the bot keeps running with
     * {@code createLight} and no privileged intents.
     * </p>
     *
     * @param guildId the Discord guild snowflake ID
     * @param userId  the user's Discord snowflake ID
     * @return the member's role IDs (excluding {@code @everyone}), or empty
     * if they couldn't be determined — no bot session, the bot isn't in the
     * guild, the user isn't a member, or the request failed
     * @since v.0.1
     */
    public Optional<List<Long>> fetchMemberRoleIds(Long guildId, Long userId) {
        if (jda == null) return Optional.empty();
        try {
            Guild guild = jda.getGuildById(guildId);
            if (guild == null) return Optional.empty();
            Member member = guild.retrieveMemberById(userId).complete();
            return Optional.of(member.getRoles().stream().map(Role::getIdLong).toList());
        } catch (ErrorResponseException e) {
            if (e.getErrorResponse() == ErrorResponse.UNKNOWN_MEMBER) {
                log.debug("User {} is not a member of guild {}", userId, guildId);
            } else {
                log.warn("Failed to fetch member {} of guild {}: {}", userId, guildId, e.getMessage());
            }
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Failed to fetch member {} of guild {}: {}", userId, guildId, e.getMessage());
            return Optional.empty();
        }
    }

    /** A server member as the moderator picker shows them (#130). */
    public record MemberInfo(String id, String username, String displayName, String avatarUrl) {
        static MemberInfo of(Member m) {
            return new MemberInfo(m.getId(), m.getUser().getName(), m.getEffectiveName(), m.getEffectiveAvatarUrl());
        }
    }

    /**
     * Members whose username or nickname starts with {@code prefix} (ТЗ ФТ-4.7.2).
     * A prefix query over the Gateway needs no privileged intent, unlike a full listing.
     *
     * @param guildId the Discord guild snowflake ID
     * @param prefix  the start of the name, not blank
     * @param limit   at most this many, 1–100
     * @return the matches, empty without a bot session or on failure
     * @since v.0.1
     */
    public List<MemberInfo> searchMembers(Long guildId, String prefix, int limit) {
        if (jda == null || prefix == null || prefix.isBlank()) return List.of();
        Guild guild = jda.getGuildById(guildId);
        if (guild == null) return List.of();
        try {
            return guild.retrieveMembersByPrefix(prefix.trim(), limit).get().stream()
                    .filter(m -> !m.getUser().isBot()).map(MemberInfo::of).toList();
        } catch (Exception e) {
            log.warn("Failed to search members of guild {}: {}", guildId, e.getMessage());
            return List.of();
        }
    }

    /**
     * One member of a guild, by ID.
     *
     * @return the member, empty if they aren't one or it can't be told
     * @since v.0.1
     */
    public Optional<MemberInfo> fetchMember(Long guildId, Long userId) {
        if (jda == null) return Optional.empty();
        Guild guild = jda.getGuildById(guildId);
        if (guild == null) return Optional.empty();
        try {
            return Optional.of(MemberInfo.of(guild.retrieveMemberById(userId).complete()));
        } catch (Exception e) {
            log.debug("No member {} on guild {}: {}", userId, guildId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Names and colours of a guild's roles, from the bot's cache — to show
     * a member's cached role IDs ({@code GuildMembership.discordRoles}) as
     * readable chips.
     *
     * @param guildId the Discord guild snowflake ID
     * @return role ID → role info, empty if unavailable
     * @since v.0.1
     */
    public Map<Long, DiscordRole> fetchRoles(Long guildId) {
        if (jda == null) return Map.of();
        try {
            Guild guild = jda.getGuildById(guildId);
            if (guild == null) return Map.of();
            Map<Long, DiscordRole> roles = new HashMap<>();
            for (Role role : guild.getRoles()) {
                roles.put(role.getIdLong(), new DiscordRole(role.getId(), role.getName(), role.getColors().getPrimaryRaw()));
            }
            return roles;
        } catch (Exception e) {
            log.warn("Failed to fetch roles of guild {}: {}", guildId, e.getMessage());
            return Map.of();
        }
    }

    /**
     * What the bot can do in a webhook's channel (E2.4, #73).
     */
    public enum ChannelAccess {
        /** The bot sees the channel and may manage its webhooks. */
        OK,
        /** No bot session in this environment: nothing can be concluded. */
        UNKNOWN,
        /** The bot isn't on the guild (kicked, or the guild is gone). */
        NOT_IN_GUILD,
        /** The channel is gone, or the bot can't see it. */
        CHANNEL_UNAVAILABLE,
        /** The bot sees the channel but lacks {@code MANAGE_WEBHOOKS} there. */
        MISSING_PERMISSIONS
    }

    /**
     * Checks the bot's access to one channel, from its Gateway-fed cache: a
     * lost {@code MANAGE_WEBHOOKS} on that channel is caught without the bot
     * having been removed from the server.
     *
     * @param guildId   the Discord guild snowflake ID
     * @param channelId the channel's snowflake ID
     * @return the bot's access
     * @since v.0.1
     */
    public ChannelAccess checkChannelAccess(Long guildId, Long channelId) {
        if (jda == null) return ChannelAccess.UNKNOWN;
        try {
            Guild guild = jda.getGuildById(guildId);
            if (guild == null) return ChannelAccess.NOT_IN_GUILD;
            GuildChannel channel = guild.getGuildChannelById(channelId);
            Member self = guild.getSelfMember();
            if (channel == null || !self.hasPermission(channel, Permission.VIEW_CHANNEL)) {
                return ChannelAccess.CHANNEL_UNAVAILABLE;
            }
            return self.hasPermission(channel, Permission.MANAGE_WEBHOOKS)
                    ? ChannelAccess.OK
                    : ChannelAccess.MISSING_PERMISSIONS;
        } catch (Exception e) {
            log.warn("Failed to check access to channel {} of guild {}: {}", channelId, guildId, e.getMessage());
            return ChannelAccess.UNKNOWN;
        }
    }

    /**
     * Whether a user may connect a guild (security audit, #103).
     */
    public enum GuildManagerCheck {
        /** The user owns the guild or has {@code MANAGE_SERVER} there. */
        MANAGER,
        /** The user is on the guild without those rights, or isn't on it. */
        NOT_MANAGER,
        /** The bot isn't on the guild (yet), or has no session. */
        BOT_NOT_IN_GUILD
    }

    /**
     * Checks, through the bot, that a user owns or manages a guild — the
     * only proof the bot-install callback accepts that the guild is theirs.
     *
     * @param guildId the Discord guild snowflake ID
     * @param userId  the user's Discord snowflake ID
     * @return the outcome
     * @since v.0.1
     */
    public GuildManagerCheck checkGuildManager(Long guildId, Long userId) {
        return switch (memberStatus(guildId, userId)) {
            case MANAGER -> GuildManagerCheck.MANAGER;
            case MEMBER, NOT_MEMBER -> GuildManagerCheck.NOT_MANAGER;
            case UNKNOWN -> jda != null && jda.getGuildById(guildId) != null
                    ? GuildManagerCheck.NOT_MANAGER
                    : GuildManagerCheck.BOT_NOT_IN_GUILD;
        };
    }

    /**
     * A user's standing on a guild, as far as the bot can tell.
     */
    public enum MemberStatus {
        /** Owns the guild or has {@code MANAGE_SERVER}. */
        MANAGER,
        /** On the guild without those rights. */
        MEMBER,
        /** Discord says the user isn't on the guild. */
        NOT_MEMBER,
        /** No bot session, the bot isn't on the guild, or Discord failed: nothing can be concluded. */
        UNKNOWN
    }

    /**
     * Looks a user up on a guild through the bot.
     *
     * @param guildId the Discord guild snowflake ID
     * @param userId  the user's Discord snowflake ID
     * @return the user's standing, {@link MemberStatus#UNKNOWN} when it can't be told
     * @since v.0.1
     */
    public MemberStatus memberStatus(Long guildId, Long userId) {
        if (jda == null) return MemberStatus.UNKNOWN;
        Guild guild = jda.getGuildById(guildId);
        if (guild == null) return MemberStatus.UNKNOWN;
        try {
            Member member = guild.retrieveMemberById(userId).complete();
            return member.isOwner() || member.hasPermission(Permission.MANAGE_SERVER)
                    ? MemberStatus.MANAGER
                    : MemberStatus.MEMBER;
        } catch (ErrorResponseException e) {
            if (e.getErrorResponse() == ErrorResponse.UNKNOWN_MEMBER) return MemberStatus.NOT_MEMBER;
            log.warn("Failed to check member {} of guild {}: {}", userId, guildId, e.getMessage());
            return MemberStatus.UNKNOWN;
        } catch (Exception e) {
            log.warn("Failed to check member {} of guild {}: {}", userId, guildId, e.getMessage());
            return MemberStatus.UNKNOWN;
        }
    }

    /**
     * A guild role as shown in the UI.
     *
     * @param id    the role ID as a string
     * @param name  the role's name
     * @param color the role's colour as 0xRRGGBB ({@code 0x1FFFFFFF} = default/none)
     * @since v.0.1
     */
    /** How a direct message went (#120). */
    public enum DmResult {
        SENT,
        /** The user doesn't accept DMs from the bot, or shares no server with it. */
        CLOSED,
        /** No bot session in this environment. */
        NO_BOT,
        /** Anything else; worth retrying. */
        FAILED
    }

    /**
     * Writes a user a direct message made of embeds (Discord's JSON embed objects).
     *
     * @param userId the recipient's Discord ID
     * @param embeds the embeds, as Discord's API takes them
     * @return how it went
     * @since v.0.1
     */
    public DmResult sendDirectMessage(Long userId, List<Map<String, Object>> embeds) {
        if (jda == null) return DmResult.NO_BOT;
        try {
            List<MessageEmbed> built = new java.util.ArrayList<>();
            for (Map<String, Object> embed : embeds) {
                built.add(EmbedBuilder.fromData(DataObject.fromJson(EMBED_JSON.writeValueAsString(embed))).build());
            }
            jda.openPrivateChannelById(userId).flatMap(channel -> channel.sendMessageEmbeds(built)).complete();
            return DmResult.SENT;
        } catch (ErrorResponseException e) {
            if (e.getErrorResponse() == ErrorResponse.CANNOT_SEND_TO_USER || e.getErrorResponse() == ErrorResponse.UNKNOWN_USER) {
                return DmResult.CLOSED;
            }
            log.warn("Failed to DM user {}: {}", userId, e.getMessage());
            return DmResult.FAILED;
        } catch (Exception e) {
            log.warn("Failed to DM user {}: {}", userId, e.getMessage());
            return DmResult.FAILED;
        }
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper EMBED_JSON = new com.fasterxml.jackson.databind.ObjectMapper();

    public record DiscordRole(String id, String name, int color) {
    }

    /**
     * A guild as reported by the Discord API.
     *
     * @param id   the guild ID as a string
     * @param name the guild's display name
     * @param icon the guild's icon hash, or {@code null} if it has none
     * @since v.0.1
     */
    public record DiscordGuildInfo(String id, String name, String icon) {
    }

    /**
     * A guild channel as reported by the Discord API.
     *
     * @param id   the channel ID as a string
     * @param name the channel's display name
     * @param type the Discord channel type (0 = text)
     * @since v.0.1
     */
    public record DiscordChannel(String id, String name, int type) {
    }

    /**
     * A webhook as reported by the Discord API right after creation — includes
     * the {@code token}, which Discord only ever returns this once.
     *
     * @param id    the webhook's snowflake ID
     * @param token the webhook's secret token
     * @since v.0.1
     */
    public record CreatedWebhook(String id, String token) {
        /**
         * Builds the full webhook URL, in the same format used everywhere
         * else in the app ({@code WebhookConfig.url}, {@code WebhookService}).
         *
         * @return the webhook's executable URL
         * @since v.0.1
         */
        public String url() {
            return "https://discord.com/api/webhooks/" + id + "/" + token;
        }
    }
}
