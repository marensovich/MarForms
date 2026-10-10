package me.marensovich.gta5rpformapp.backend.service.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import me.marensovich.gta5rpformapp.backend.service.jobs.OutboundJobService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Applies queued Stripe events (E4.2) from {@code outbound_jobs}, retrying
 * with backoff on failure, like {@code WebhookDeliveryProcessor} (ADR 0001).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StripeEventProcessor {

    private static final long BASE_RETRY_DELAY_SECONDS = 30;
    private static final int MAX_BACKOFF_DOUBLINGS = 5;

    private final OutboundJobRepository outboundJobRepository;
    private final OutboundJobService outboundJobService;
    private final BillingService billingService;
    private final ObjectMapper objectMapper;

    /**
     * Processes due Stripe events.
     *
     * @since v.0.1
     */
    @Scheduled(fixedDelay = 5000)
    public void processDueEvents() {
        for (OutboundJob job : outboundJobRepository
                .findTop20ByJobTypeAndStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                        BillingService.JOB_TYPE_STRIPE_EVENT, OutboundJobStatus.PENDING, LocalDateTime.now())) {
            processOne(job);
        }
    }

    void processOne(OutboundJob job) {
        JsonNode payload = objectMapper.valueToTree(job.getPayload());
        try {
            billingService.apply(payload.path("type").asText(), payload.path("created").asLong(), payload.path("object"));
            outboundJobService.markSucceeded(job.getId());
        } catch (Exception e) {
            long backoff = BASE_RETRY_DELAY_SECONDS * (1L << Math.min(job.getAttempts(), MAX_BACKOFF_DOUBLINGS));
            log.warn("Applying Stripe event {} failed, retrying in {}s: {}",
                    payload.path("eventId").asText(), backoff, e.getMessage());
            outboundJobService.reschedule(job.getId(), LocalDateTime.now().plusSeconds(backoff), e.getMessage());
        }
    }
}
