package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
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
     * On an {@code ANONYMOUS} form: SHA-256 of the form ID and the browser's
     * random token (hex). Lets the per-user limit count one browser's
     * submissions without identifying anyone or linking forms (E2.3).
     *
     * @since v.0.1
     */
    @Column(name = "anonymous_token", length = 64)
    private String anonymousToken;

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
     * Short number for people, sequential within the form's server ("Заявка #1048", #114);
     * {@code null} only for forms of a server the platform has no record of.
     *
     * @since v.0.1
     */
    @Column(updatable = false)
    private Long number;

    /**
     * The form's questions as they were when this was submitted (#117): labels,
     * types, sections and options. Shown instead of the form's current schema, so
     * later edits don't change earlier submissions; {@code null} never after V23.
     *
     * @since v.0.1
     */
    @JdbcTypeCode(SqlTypes.JSON)
    // Updated only when the author sends it again after revision (#119): the questions answered then.
    @Column(name = "schema_snapshot")
    private FormSchema schemaSnapshot;

    /**
     * The questions to show this submission with: its snapshot, or the form's
     * schema for a row from before snapshots.
     *
     * @param form the submission's form (may be {@code null} if deleted)
     * @return the schema to read the answers by, or {@code null}
     * @since v.0.1
     */
    public FormSchema questions(Form form) {
        if (schemaSnapshot != null) return schemaSnapshot;
        return form != null ? form.getSchema() : null;
    }

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