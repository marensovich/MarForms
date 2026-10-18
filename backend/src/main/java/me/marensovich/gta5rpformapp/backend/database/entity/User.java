package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Entity representing an application user in the database.
 * <p>
 * Stores user information including Discord account details, assigned roles,
 * server memberships, and ban status.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Data
@Table(name = "users")
@Entity
public class User {

    /**
     * Unique identifier for the user.
     * Auto-incremented database ID.
     *
     * @since v.0.1
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Discord user ID.
     * <p>
     * Unique and non-null. Used as the primary identifier for
     * authentication and linking with Discord's API.
     * </p>
     *
     * @since v.0.1
     */
    @Column(unique = true, nullable = false)
    private Long discordId;

    /**
     * Discord username of the user.
     * <p>
     * Stores the current Discord username (without discriminator).
     * </p>
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private String discordUsername;

    /**
     * Discord avatar hash, refreshed on each OAuth login; {@code null} if the
     * user has the default avatar or never logged in via OAuth.
     *
     * @since v.0.1
     */
    @Column(name = "discord_avatar", length = 64)
    private String discordAvatar;

    /**
     * The set of roles assigned to the user.
     * <p>
     * Fetched eagerly to ensure roles and their permissions are available
     * immediately for authorization checks.
     * </p>
     *
     * @see Role
     * @since v.0.1
     */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();

    /**
     * The set of Discord server (guild) IDs the user is a member of.
     * <p>
     * Used for access control to forms that are restricted to specific servers.
     * </p>
     *
     * @since v.0.1
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "user_guilds",
            joinColumns = @JoinColumn(name = "user_id")
    )
    @Column(name = "guild_id")
    private Set<Long> guildIds = new HashSet<>();

    /**
     * The timestamp when the user's guild memberships were last synced.
     * <p>
     * Used to determine if a refresh of guild data from Discord is needed.
     * </p>
     *
     * @since v.0.1
     */
    private LocalDateTime guildsSyncedAt;

    /**
     * Flag indicating if the user is permanently banned.
     * <p>
     * If {@code true}, the user cannot access the system regardless of
     * other ban conditions.
     * </p>
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private boolean bannedPermanently = false;

    /**
     * Version stamped into every JWT issued to this user; bumping it (on
     * logout) invalidates all tokens issued before (#103).
     *
     * @since v.0.1
     */
    @Column(name = "token_version", nullable = false)
    private int tokenVersion = 0;

    /**
     * The timestamp until which the user is temporarily banned.
     * <p>
     * If {@code null} and not permanently banned, the user is not banned.
     * </p>
     *
     * @since v.0.1
     */
    private LocalDateTime bannedUntil;

    /** Why the user is banned or timed out; the user sees it (ТЗ 6.3). */
    @Column(name = "restriction_reason", columnDefinition = "TEXT")
    private String restrictionReason;

    /** The last request the user made, for «активные за 30 дней» (ТЗ 6.3). */
    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** A ban: the whole platform is closed to the user (ТЗ 6.3). */
    @Transient
    public boolean isBanned() {
        return bannedPermanently;
    }

    /** A time-out: no submissions and no panel until {@link #getBannedUntil()} (ТЗ 6.3). */
    @Transient
    public boolean isTimedOut() {
        return !bannedPermanently && bannedUntil != null && bannedUntil.isAfter(LocalDateTime.now());
    }

    /**
     * Checks if the user is currently banned.
     * <p>
     * A user is considered banned if either:
     * <ul>
     *     <li>{@code bannedPermanently} is {@code true}, or</li>
     *     <li>{@code bannedUntil} is in the future</li>
     * </ul>
     * </p>
     *
     * @return {@code true} if the user is currently banned, {@code false} otherwise
     * @since v.0.1
     */
    @Transient
    public boolean isCurrentlyBanned() {
        if (bannedPermanently) return true;
        return bannedUntil != null && bannedUntil.isAfter(LocalDateTime.now());
    }

    /**
     * Checks if the user is a member of a specific Discord server.
     *
     * @param guildId the Discord server (guild) ID to check
     * @return {@code true} if the user is a member of the specified guild,
     * {@code false} otherwise
     * @since v.0.1
     */
    @Transient
    public boolean isMemberOfGuild(Long guildId) {
        return guildIds.contains(guildId);
    }
}