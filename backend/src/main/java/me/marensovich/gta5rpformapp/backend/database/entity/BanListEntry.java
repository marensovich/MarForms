package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One user barred from submitting a guild's forms (E2.2, task #67).
 * <p>
 * Guild-scoped, and keyed by Discord ID rather than {@link User} so that a
 * user can be banned before they ever log in to MarForms. Unrelated to the
 * platform-wide ban on {@link User}.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "ban_list",
        uniqueConstraints = @UniqueConstraint(name = "uc_ban_list_guild_discord", columnNames = {"guild_id", "discord_id"}))
public class BanListEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    /**
     * The guild's Discord snowflake ID.
     */
    @Column(name = "guild_id", nullable = false, updatable = false)
    private Long guildId;

    /**
     * The banned user's Discord ID.
     */
    @Column(name = "discord_id", nullable = false, updatable = false)
    private Long discordId;

    /**
     * Discord ID of the owner/moderator who issued the ban.
     */
    @Column(name = "banned_by")
    private Long bannedBy;

    /**
     * Optional reason, shown to staff only.
     */
    @Column(length = 500)
    private String reason;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** When the ban ends (ТЗ ФТ-4.8.2); {@code null} = forever. */
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    /** Whether the ban still applies — a lapsed one stops working without anyone lifting it. */
    public boolean isActive() {
        return expiresAt == null || expiresAt.isAfter(LocalDateTime.now());
    }
}
