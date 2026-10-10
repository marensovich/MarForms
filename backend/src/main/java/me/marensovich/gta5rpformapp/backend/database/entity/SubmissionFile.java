package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A file uploaded for a {@code FILE_UPLOAD} field (E3.2, ADR 0003). The
 * bytes live in {@code FileStorage} under {@link #storageKey}; this row is
 * the metadata and the link to the submission.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "submission_file")
public class SubmissionFile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "form_id", nullable = false, updatable = false)
    private UUID formId;

    @Column(name = "field_id", nullable = false, updatable = false, length = 100)
    private String fieldId;

    /**
     * The submission it belongs to; {@code null} while the form is still
     * being filled in.
     */
    @Column(name = "submission_id")
    private UUID submissionId;

    /**
     * The name the respondent's file had, for display and download only:
     * never used as a path.
     */
    @Column(name = "original_name", nullable = false)
    private String originalName;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    /**
     * Random key under which {@code FileStorage} holds the bytes.
     */
    @Column(name = "storage_key", nullable = false, updatable = false, length = 100)
    private String storageKey;

    /**
     * Discord ID of the uploader, {@code null} if not logged in or the form
     * is anonymous.
     */
    @Column(name = "uploaded_by")
    private Long uploadedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
