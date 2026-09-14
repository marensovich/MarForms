package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * A queued unit of background work, polled and executed by a job-type-specific
 * {@code @Scheduled} processor (e.g. {@code WebhookDeliveryProcessor}).
 * <p>
 * See {@code docs/adr/0001-background-job-mechanism.md} for why this DB-backed
 * outbox exists instead of a Redis-based queue. This entity is intentionally
 * generic — {@code jobType} + a JSON {@code payload} — so any future
 * background-job need (billing webhooks, etc.) can reuse the same table
 * rather than growing a bespoke queue per feature.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "outbound_jobs")
public class OutboundJob {

    @Id
    private UUID id;

    /**
     * Discriminates which processor should handle this job — e.g.
     * {@code OutboundJobService.JOB_TYPE_WEBHOOK_DELIVERY}.
     *
     * @since v.0.1
     */
    @Column(name = "job_type", nullable = false, length = 50)
    private String jobType;

    /**
     * Job-type-specific data, deserialized by the matching processor into its
     * own payload record (e.g. {@code WebhookDeliveryPayload}).
     *
     * @since v.0.1
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> payload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OutboundJobStatus status = OutboundJobStatus.PENDING;

    @Column(nullable = false)
    private int attempts = 0;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts = 5;

    /**
     * When this job is next eligible to be picked up — set to "now" on
     * enqueue, pushed forward on each retry (see {@code OutboundJobService#reschedule}).
     *
     * @since v.0.1
     */
    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
