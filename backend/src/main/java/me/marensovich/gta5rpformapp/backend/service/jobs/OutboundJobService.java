package me.marensovich.gta5rpformapp.backend.service.jobs;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Enqueues and tracks {@link OutboundJob} rows — the DB-backed job outbox
 * decided in {@code docs/adr/0001-background-job-mechanism.md}.
 * <p>
 * This service only owns the generic lifecycle (enqueue, succeed, fail,
 * reschedule-with-backoff). Picking up due jobs and actually doing the work
 * is the job of a type-specific {@code @Scheduled} processor, e.g.
 * {@code WebhookDeliveryProcessor} for {@link #JOB_TYPE_WEBHOOK_DELIVERY}.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OutboundJobService {

    /** Job type handled by {@code WebhookDeliveryProcessor}. */
    public static final String JOB_TYPE_WEBHOOK_DELIVERY = "webhook_delivery";

    private static final int DEFAULT_MAX_ATTEMPTS = 5;
    private static final int MAX_ERROR_LENGTH = 2000;

    private final OutboundJobRepository outboundJobRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.jobs.retention-days:14}")
    private long retentionDays = 14;

    /**
     * Enqueues a new job, due immediately.
     * <p>
     * Call this within the same transaction as the write that triggers the
     * job (e.g. saving the {@code Submission} it notifies about) — see the
     * ADR for why that atomicity matters.
     * </p>
     *
     * @param jobType discriminates which processor picks this up
     * @param payload any object Jackson can serialize; stored as JSON and
     *                handed back to the processor as a {@code Map}
     * @return the persisted job
     * @since v.0.1
     */
    @Transactional
    public OutboundJob enqueue(String jobType, Object payload) {
        OutboundJob job = new OutboundJob();
        job.setId(UUID.randomUUID());
        job.setJobType(jobType);
        job.setPayload(objectMapper.convertValue(payload, new TypeReference<Map<String, Object>>() {
        }));
        job.setStatus(OutboundJobStatus.PENDING);
        job.setAttempts(0);
        job.setMaxAttempts(DEFAULT_MAX_ATTEMPTS);
        LocalDateTime now = LocalDateTime.now();
        job.setNextAttemptAt(now);
        job.setCreatedAt(now);
        job.setUpdatedAt(now);
        return outboundJobRepository.save(job);
    }

    /**
     * Marks a job done — either genuinely delivered, or determined to need
     * no further action (e.g. the thing it would have acted on no longer
     * exists). A no-op if the job doesn't exist.
     *
     * @param jobId the job to mark
     * @since v.0.1
     */
    @Transactional
    public void markSucceeded(UUID jobId) {
        outboundJobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(OutboundJobStatus.SUCCEEDED);
            job.setUpdatedAt(LocalDateTime.now());
            outboundJobRepository.save(job);
        });
    }

    /**
     * Marks a job permanently failed — no further retries, regardless of
     * remaining attempts. Use for errors a retry can't fix (e.g. a 404 for a
     * webhook that was deleted). A no-op if the job doesn't exist.
     *
     * @param jobId the job to mark
     * @param error a short description of why, kept for later diagnosis
     * @since v.0.1
     */
    @Transactional
    public void markFailed(UUID jobId, String error) {
        outboundJobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus(OutboundJobStatus.FAILED);
            job.setLastError(truncate(error));
            job.setUpdatedAt(LocalDateTime.now());
            outboundJobRepository.save(job);
        });
    }

    /**
     * Records a failed attempt and either schedules a retry or, once
     * {@code maxAttempts} is reached, marks the job {@code FAILED}. A no-op
     * if the job doesn't exist.
     *
     * @param jobId         the job to reschedule
     * @param nextAttemptAt when to retry, if attempts remain
     * @param error         a short description of why this attempt failed
     * @since v.0.1
     */
    @Transactional
    public void reschedule(UUID jobId, LocalDateTime nextAttemptAt, String error) {
        outboundJobRepository.findById(jobId).ifPresent(job -> {
            int attempts = job.getAttempts() + 1;
            job.setAttempts(attempts);
            job.setLastError(truncate(error));
            job.setUpdatedAt(LocalDateTime.now());
            if (attempts >= job.getMaxAttempts()) {
                job.setStatus(OutboundJobStatus.FAILED);
            } else {
                job.setStatus(OutboundJobStatus.PENDING);
                job.setNextAttemptAt(nextAttemptAt);
            }
            outboundJobRepository.save(job);
        });
    }

    private String truncate(String s) {
        if (s == null) return null;
        return s.length() > MAX_ERROR_LENGTH ? s.substring(0, MAX_ERROR_LENGTH) : s;
    }

    /**
     * Deletes finished jobs after {@code app.jobs.retention-days} (14): their
     * payloads copy submission answers and usernames, which must not outlive
     * the submissions themselves (#103). Pending jobs are never touched.
     *
     * @since v.0.1
     */
    @Scheduled(cron = "0 17 3 * * *")
    public void deleteOldJobs() {
        int removed = outboundJobRepository.deleteFinishedBefore(
                List.of(OutboundJobStatus.SUCCEEDED, OutboundJobStatus.FAILED),
                LocalDateTime.now().minusDays(retentionDays));
        if (removed > 0) log.info("Deleted {} finished outbound job(s)", removed);
    }
}
