package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Entity representing a form submission in the database.
 * <p>
 * Stores user responses to a form, including the submitted answers
 * and metadata about the submission.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "submission")
public class Submission {

    /**
     * Unique identifier for the submission.
     * Automatically generated as a UUID.
     *
     * @since v.0.1
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * The ID of the form that was submitted.
     * <p>
     * References the {@link Form} entity that this submission belongs to.
     * </p>
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private UUID formId;

    /**
     * The Discord ID of the user who submitted the form.
     * <p>
     * Identifies the submitter across the system. {@code null} when an
     * {@code OPEN} form was filled in without logging in.
     * </p>
     *
     * @since v.0.1
     */
    private Long discordId;

    /**
     * Moderation state.
     *
     * @since v.0.1
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubmissionStatus status = SubmissionStatus.PENDING;

    /**
     * Discord ID of the moderator who made the last decision.
     *
     * @since v.0.1
     */
    private Long moderatorDiscordId;

    /**
     * The moderator's comment on the decision (e.g. what to fix).
     *
     * @since v.0.1
     */
    @Column(columnDefinition = "TEXT")
    private String moderatorComment;

    /**
     * When the last decision was made.
     *
     * @since v.0.1
     */
    private LocalDateTime decidedAt;

    /**
     * Client-supplied {@code Idempotency-Key} — a retried submit with the
     * same key returns this submission instead of creating another.
     *
     * @since v.0.1
     */
    @Column(unique = true, length = 100)
    private String idempotencyKey;

    /**
     * Optimistic-lock version — concurrent moderation decisions on the same
     * submission make the later write fail instead of silently overwriting.
     * Left {@code null} on new rows on purpose: Spring Data treats a null
     * version as "new" (persist, not merge); Hibernate then sets it to 0.
     *
     * @since v.0.1
     */
    @Version
    private Long version;

    /**
     * The timestamp when the submission was created.
     * Automatically set to the current time and immutable.
     *
     * @since v.0.1
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * The submitted answers as a key-value map.
     * <p>
     * Stored as JSON in the database using Hibernate's JSON mapping.
     * Keys correspond to field IDs from the form schema, and values
     * are the user's responses.
     * </p>
     *
     * @since v.0.1
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> answers;

    /**
     * Maps each webhook URL to the Discord message ID returned after delivery.
     * <p>
     * Stored as JSON. Used to delete the corresponding Discord messages
     * when this submission is deleted by a moderator.
     * </p>
     *
     * @since v.0.1
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "webhook_message_ids")
    private Map<String, String> webhookMessageIds = new HashMap<>();
}