package me.marensovich.gta5rpformapp.backend.service.discord;

import lombok.extern.slf4j.Slf4j;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.Webhook;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.entities.channel.middleman.GuildChannel;
import net.dv8tion.jda.api.exceptions.ErrorResponseException;
import net.dv8tion.jda.api.requests.ErrorResponse;
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
        if (jda == null) return GuildManagerCheck.BOT_NOT_IN_GUILD;
        Guild guild = jda.getGuildById(guildId);
        if (guild == null) return GuildManagerCheck.BOT_NOT_IN_GUILD;
        try {
            Member member = guild.retrieveMemberById(userId).complete();
            return member.isOwner() || member.hasPermission(Permission.MANAGE_SERVER)
                    ? GuildManagerCheck.MANAGER
                    : GuildManagerCheck.NOT_MANAGER;
        } catch (ErrorResponseException e) {
            if (e.getErrorResponse() != ErrorResponse.UNKNOWN_MEMBER) {
                log.warn("Failed to check member {} of guild {}: {}", userId, guildId, e.getMessage());
            }
            return GuildManagerCheck.NOT_MANAGER;
        } catch (Exception e) {
            log.warn("Failed to check member {} of guild {}: {}", userId, guildId, e.getMessage());
            return GuildManagerCheck.NOT_MANAGER;
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
