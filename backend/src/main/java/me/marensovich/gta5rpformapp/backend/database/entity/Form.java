package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Entity representing a form configuration in the database.
 * <p>
 * Stores the structural definition of a form including its schema,
 * associated Discord server, channel restrictions, and webhook configurations.
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
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "form_channels",
            joinColumns = @JoinColumn(name = "form_id")
    )
    private Set<Long> channelsIds = new HashSet<>();

    /**
     * RoleGate allow list (E2.1): Discord role IDs of which a respondent needs
     * at least one. Empty = any member of the server. Applies only while
     * {@link #accessMode} is {@code ROLE_GATED}.
     *
     * @since v.0.1
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "form_allowed_roles", joinColumns = @JoinColumn(name = "form_id"))
    @Column(name = "discord_role_id")
    private Set<Long> allowedRoleIds = new HashSet<>();

    /**
     * RoleGate deny list (E2.1): any of these Discord roles refuses access,
     * whatever the allow list says (deny wins). Applies only while
     * {@link #accessMode} is {@code ROLE_GATED}.
     *
     * @since v.0.1
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "form_denied_roles", joinColumns = @JoinColumn(name = "form_id"))
    @Column(name = "discord_role_id")
    private Set<Long> deniedRoleIds = new HashSet<>();

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
     * A list of Discord webhook configurations for this form.
     * <p>
     * Stored as JSON in the database using Hibernate's JSON mapping.
     * Each webhook is triggered when a new submission is created,
     * sending form data to the configured Discord channel.
     * </p>
     * <p>
     * Supports multiple webhooks per form, allowing notifications
     * to be sent to different channels or with different formats.
     * </p>
     *
     * @see WebhookConfig
     * @since v.0.1
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private List<WebhookConfig> webhooks = new ArrayList<>();

    /**
     * Indicates whether the form is active and accepting submissions.
     * <p>
     * Kept for backward compatibility only — always equal to
     * {@code status == PUBLISHED} (synced in {@link #syncDerivedFields()}).
     * Use {@link #status} in new code.
     * </p>
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private boolean active = false;

    /**
     * Where the form is in its lifecycle.
     *
     * @see FormStatus
     * @since v.0.1
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormStatus status = FormStatus.DRAFT;

    /**
     * Who may fill the form in.
     *
     * @see FormAccessMode
     * @since v.0.1
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "access_mode", nullable = false, length = 20)
    private FormAccessMode accessMode = FormAccessMode.AUTHENTICATED;

    /**
     * Public URL identifier, assigned on first publish and never changed
     * afterwards (so shared links keep working). {@code null} for a form
     * that has never been published.
     *
     * @since v.0.1
     */
    @Column(unique = true, length = 80)
    private String slug;

    /**
     * Max submissions per respondent, {@code null} = unlimited.
     *
     * @since v.0.1
     */
    private Integer submissionLimitPerUser;

    /**
     * Submissions are accepted from this moment on ({@code null} = immediately).
     *
     * @since v.0.1
     */
    private LocalDateTime opensAt;

    /**
     * Submissions are no longer accepted after this moment ({@code null} = never closes).
     *
     * @since v.0.1
     */
    private LocalDateTime closesAt;

    /**
     * When the form was last modified.
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    /**
     * Optimistic-locking version: a save based on an outdated copy fails
     * instead of overwriting newer changes (#103).
     *
     * @since v.0.1
     */
    @Version
    @Column(nullable = false)
    private Long version;

    /**
     * Sets the status and keeps the legacy {@link #active} flag in step
     * immediately — not only at flush time — so a DTO built from this
     * entity before the transaction flushes is still consistent.
     *
     * @param status the new status
     * @since v.0.1
     */
    public void setStatus(FormStatus status) {
        this.status = status;
        this.active = status == FormStatus.PUBLISHED;
    }

    /**
     * Copy of {@code schema.title} kept as a column, so forms can be searched
     * and sorted by title without reading the JSON schema (#107).
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private String title = "";

    @PrePersist
    @PreUpdate
    void syncDerivedFields() {
        active = status == FormStatus.PUBLISHED;
        updatedAt = LocalDateTime.now();
        String schemaTitle = schema != null && schema.getTitle() != null ? schema.getTitle() : "";
        title = schemaTitle.length() > 255 ? schemaTitle.substring(0, 255) : schemaTitle;
    }

    /**
     * Whether the form accepts submissions right now: published, and inside
     * its opening window.
     *
     * @return {@code true} if a submission may be accepted
     * @since v.0.1
     */
    @Transient
    public boolean isAcceptingSubmissions() {
        if (status != FormStatus.PUBLISHED) return false;
        LocalDateTime now = LocalDateTime.now();
        if (opensAt != null && now.isBefore(opensAt)) return false;
        return closesAt == null || !now.isAfter(closesAt);
    }

    /**
     * The timestamp when the form was created.
     * Automatically set to the current time and immutable.
     *
     * @since v.0.1
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}