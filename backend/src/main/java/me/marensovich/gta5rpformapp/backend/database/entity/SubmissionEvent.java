package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionEventType;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import org.springframework.lang.Nullable;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One step in a submission's history (#118): who moved it from which status to
 * which, when, and with what comment.
 *
 * @author marensovich
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "submission_events")
public class SubmissionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "submission_id", nullable = false, updatable = false)
    private UUID submissionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32, updatable = false)
    private SubmissionEventType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 32, updatable = false)
    private SubmissionStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 32, updatable = false)
    private SubmissionStatus toStatus;

    /** Who did it; null for an anonymous respondent. */
    @Column(name = "actor_discord_id", updatable = false)
    private Long actorDiscordId;

    @Column(columnDefinition = "TEXT", updatable = false)
    private String comment;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public static SubmissionEvent of(UUID submissionId, SubmissionEventType type, @Nullable SubmissionStatus from,
                                     SubmissionStatus to, @Nullable Long actorDiscordId, @Nullable String comment) {
        SubmissionEvent event = new SubmissionEvent();
        event.setSubmissionId(submissionId);
        event.setType(type);
        event.setFromStatus(from);
        event.setToStatus(to);
        event.setActorDiscordId(actorDiscordId);
        event.setComment(comment);
        return event;
    }
}
