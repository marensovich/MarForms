package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A user asked to be told in Discord when a form opens (#121).
 *
 * @author marensovich
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "form_reminders",
        uniqueConstraints = @UniqueConstraint(name = "uq_form_reminders_form_user", columnNames = {"form_id", "discord_id"}))
public class FormReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "form_id", nullable = false, updatable = false)
    private UUID formId;

    @Column(name = "discord_id", nullable = false, updatable = false)
    private Long discordId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** When the message went out, or was given up on; null while waiting. */
    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Column(nullable = false)
    private int attempts;
}
