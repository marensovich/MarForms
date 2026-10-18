package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One platform ban or time-out (ТЗ 6.3, #144): who gave it, when and why,
 * until when, and who lifted it. The «Разбан» dialog shows the latest one.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Table(name = "user_restrictions")
@Data
public class UserRestriction {

    /** A ban closes the whole platform; a time-out, submissions and the panel. */
    public enum Type {BAN, TIMEOUT}

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_discord_id", nullable = false)
    private Long userDiscordId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type;

    @Column(columnDefinition = "TEXT")
    private String reason;

    /** The end of a time-out; {@code null} for a ban. */
    @Column(name = "ends_at")
    private LocalDateTime endsAt;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "created_by_name", length = 100)
    private String createdByName;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "lifted_by")
    private Long liftedBy;

    @Column(name = "lifted_by_name", length = 100)
    private String liftedByName;

    @Column(name = "lifted_at")
    private LocalDateTime liftedAt;
}
