package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;

import java.time.LocalDateTime;

/**
 * Entity representing a Discord server (guild) that has the bot installed.
 * <p>
 * The primary key is the Discord guild snowflake ID itself — a Guild row
 * only ever exists because a real Discord server has it, so there is no
 * need for a separate surrogate identifier.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "guilds")
public class Guild {

    /**
     * The Discord guild snowflake ID.
     *
     * @since v.0.1
     */
    @Id
    @Column(name = "discord_guild_id", updatable = false, nullable = false)
    private Long discordGuildId;

    /**
     * The server's display name, as reported by Discord.
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private String name;

    /**
     * The server's icon hash, as reported by Discord (nullable — not every
     * server has a custom icon).
     *
     * @since v.0.1
     */
    private String iconHash;

    /**
     * The server icon on Discord's CDN.
     *
     * @return the URL, or {@code null} if the server has no icon
     * @since v.0.1
     */
    @Transient
    public String iconUrl() {
        return iconHash == null ? null
                : "https://cdn.discordapp.com/icons/" + Long.toUnsignedString(discordGuildId) + "/" + iconHash + ".png?size=128";
    }

    /**
     * Whether the bot currently has access to this server.
     *
     * @see GuildBotStatus
     * @since v.0.1
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GuildBotStatus botStatus = GuildBotStatus.CONNECTED;

    /**
     * Billing tier — see {@link PlanTier}.
     *
     * @since v.0.1
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PlanTier planTier = PlanTier.FREE;

    /**
     * When the bot was (most recently) added to this server.
     *
     * @since v.0.1
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime connectedAt = LocalDateTime.now();

    /**
     * Approximate member count, as the bot last saw it (#124).
     *
     * @since v.0.1
     */
    private Integer memberCount;

    /**
     * Permissions the bot lacks on this server, comma-separated
     * ({@code DiscordBotClient.REQUIRED_PERMISSIONS} names); empty or null if none (#124).
     *
     * @since v.0.1
     */
    @Column(length = 255)
    private String missingPermissions;

    /**
     * When the state above was last read from Discord.
     *
     * @since v.0.1
     */
    private LocalDateTime syncedAt;

    /**
     * Discord roles whose holders own this server in MarForms (not the
     * platform) and see its log channels (2026-10-19).
     *
     * @since v.0.1
     */
    @ElementCollection
    @CollectionTable(name = "guild_admin_roles", joinColumns = @JoinColumn(name = "guild_id"))
    @Column(name = "role_id", nullable = false)
    @lombok.EqualsAndHashCode.Exclude
    @lombok.ToString.Exclude
    private java.util.Set<Long> adminRoleIds = new java.util.HashSet<>();

    /** The bot's «Обо мне» on this server, as last set from the panel (Discord doesn't give it back). */
    @Column(name = "bot_bio", length = 190)
    private String botBio;

    /** The category of the log channels the bot created, if any. */
    private Long logCategoryId;

    /** #аудит: the server's journal. */
    private Long logAuditChannelId;

    /** Its webhook's URL, sealed ({@code WebhookUrlCipher}). */
    @Column(columnDefinition = "TEXT")
    private String logAuditWebhook;

    /**
     * The missing permissions as a list.
     *
     * @return their names, empty if none
     * @since v.0.1
     */
    @Transient
    public java.util.List<String> missingPermissionList() {
        return missingPermissions == null || missingPermissions.isBlank() ? java.util.List.of()
                : java.util.List.of(missingPermissions.split(","));
    }
}
