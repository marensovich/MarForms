package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.notifications.NotificationType;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * One entry of a user's bell (#122): the type and its parameters, which the
 * client turns into text, and where clicking it leads.
 *
 * @author marensovich
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "recipient_discord_id", nullable = false, updatable = false)
    private Long recipientDiscordId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private NotificationType type;

    @Column(name = "guild_id", updatable = false)
    private Long guildId;

    /** The object it is about (a submission, a form), as text. */
    @Column(name = "target_id", length = 64, updatable = false)
    private String targetId;

    /** Names for the text: form title, server name, author… */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(updatable = false)
    private Map<String, String> params;

    /** The panel path to open. */
    @Column(length = 512, updatable = false)
    private String link;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "read_at")
    private LocalDateTime readAt;
}
