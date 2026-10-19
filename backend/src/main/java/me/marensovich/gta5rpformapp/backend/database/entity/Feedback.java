package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Feedback about MarForms itself (2026-10-19): a bug, an idea, a potential
 * problem or anything else. Not a form of the forms system.
 *
 * @author marensovich
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "feedback")
public class Feedback {

    /** What it is about; each kind asks its own questions. */
    public enum Type {BUG, IDEA, PROBLEM, OTHER}

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Type type;

    @Column(name = "author_discord_id", nullable = false)
    private Long authorDiscordId;

    @Column(name = "author_username")
    private String authorUsername;

    /** Question id → answer. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, String> answers;

    /** The page of the panel it was sent from, if the sender left it. */
    @Column(length = 300)
    private String page;

    /** Whether the feedback webhook took it. */
    @Column(nullable = false)
    private boolean delivered;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
