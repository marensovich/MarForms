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
    @ElementCollection
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
     * The timestamp until which the user is temporarily banned.
     * <p>
     * If {@code null} and not permanently banned, the user is not banned.
     * </p>
     *
     * @since v.0.1
     */
    private LocalDateTime bannedUntil;

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
     *         {@code false} otherwise
     * @since v.0.1
     */
    @Transient
    public boolean isMemberOfGuild(Long guildId) {
        return guildIds.contains(guildId);
    }
}