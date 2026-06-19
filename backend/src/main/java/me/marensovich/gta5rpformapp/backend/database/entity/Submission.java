package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
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
     * Identifies the submitter across the system.
     * </p>
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private Long discordId;

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
}