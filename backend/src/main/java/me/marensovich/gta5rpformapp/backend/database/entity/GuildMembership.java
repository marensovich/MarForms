package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Entity linking a {@link User} to a {@link Guild} with a per-guild role.
 * <p>
 * One row per (user, guild) pair. A {@code RESPONDENT} row is created
 * lazily the first time a user is confirmed to be a member of a guild
 * that has the bot installed; {@code OWNER}/{@code MODERATOR} rows are
 * created explicitly (bot install, moderator assignment).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(
        name = "guild_memberships",
        uniqueConstraints = @UniqueConstraint(name = "uc_guild_memberships_user_guild", columnNames = {"user_id", "guild_id"})
)
public class GuildMembership {

    /**
     * Unique identifier for the membership row.
     *
     * @since v.0.1
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    /**
     * The member.
     *
     * @since v.0.1
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    /**
     * The guild this membership belongs to.
     *
     * @since v.0.1
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guild_id", nullable = false, updatable = false)
    private Guild guild;

    /**
     * The member's role on this specific guild.
     *
     * @see GuildRole
     * @since v.0.1
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GuildRole role;

    /**
     * Cached list of the member's Discord role snowflake IDs on this guild,
     * used for role-based form gating (see product spec раздел 4.3).
     * {@code null} until the first sync.
     *
     * @since v.0.1
     */
    @JdbcTypeCode(SqlTypes.JSON)
    private List<Long> discordRoles;

    /**
     * When {@link #discordRoles} was last refreshed from Discord.
     * {@code null} until the first sync.
     *
     * @since v.0.1
     */
    private LocalDateTime discordRolesSyncedAt;

    /**
     * When Discord last confirmed this {@code OWNER}/{@code MODERATOR} row
     * still holds (see {@code GuildMembershipService#verifyStaffIfStale}).
     * {@code null} until the first check.
     *
     * @since v.0.1
     */
    private LocalDateTime staffVerifiedAt;

    /**
     * When this membership row was first created.
     *
     * @since v.0.1
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
