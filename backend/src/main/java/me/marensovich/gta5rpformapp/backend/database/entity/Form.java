package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Entity representing a form configuration in the database.
 * <p>
 * Stores the structural definition of a form including its schema,
 * associated Discord server, and channel restrictions.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "form")
public class Form {

    /**
     * Unique identifier for the form.
     * Automatically generated as a UUID.
     *
     * @since v.0.1
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    /**
     * The Discord server (guild) ID that this form belongs to.
     * Only members of this server can access and submit the form.
     *
     * @since v.0.1
     */
    private Long serverId;

    /**
     * A set of Discord channel IDs where this form can be submitted.
     * <p>
     * If empty, the form can be submitted from any channel within the server.
     * Restricts submissions to specific channels when populated.
     * </p>
     *
     * @since v.0.1
     */
    @ElementCollection
    @CollectionTable(
            name = "form_channels",
            joinColumns = @JoinColumn(name = "form_id")
    )
    private Set<Long> channelsIds = new HashSet<>();

    /**
     * The JSON schema defining the form structure.
     * <p>
     * Stored as JSON in the database using Hibernate's JSON mapping.
     * Contains the title, description, and field definitions.
     * </p>
     *
     * @see FormSchema
     * @since v.0.1
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private FormSchema schema;

    /**
     * Indicates whether the form is active and accepting submissions.
     * Inactive forms cannot be submitted.
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private boolean active = true;

    /**
     * The timestamp when the form was created.
     * Automatically set to the current time and immutable.
     *
     * @since v.0.1
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}