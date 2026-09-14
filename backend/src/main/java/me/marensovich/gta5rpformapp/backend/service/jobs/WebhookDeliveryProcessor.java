package me.marensovich.gta5rpformapp.backend.service.jobs;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import me.marensovich.gta5rpformapp.backend.service.WebhookService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;

import java.time.LocalDateTime;

/**
 * Polls for due {@code webhook_delivery} jobs and attempts them — the
 * consumer side of the queue {@code SubmissionService#submit} enqueues into.
 * <p>
 * Retry/rate-limit handling (product spec T1.4.3 / #59):
 * <ul>
 *     <li><b>429 (rate limited)</b> — respects Discord's {@code Retry-After}
 *     header and reschedules; the notification is never dropped, just delayed.</li>
 *     <li><b>404 (webhook deleted on Discord's side)</b> — permanent, not
 *     retried: the webhook is marked {@code invalid} on the form
 *     ({@code FormService#markWebhookInvalid}) and the job is marked
 *     {@code FAILED}. A full UI alert to the owner is Stage 2 (E2.4); for now
 *     this is logged only.</li>
 *     <li><b>Anything else</b> — exponential backoff up to
 *     {@code OutboundJob#maxAttempts}, then {@code FAILED}.</li>
 * </ul>
 * A submission's other webhooks, and the submission itself, are never
 * blocked by one webhook's failure — each is an independent job.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebhookDeliveryProcessor {

    private static final long BASE_RETRY_DELAY_SECONDS = 30;
    private static final long DEFAULT_RATE_LIMIT_RETRY_SECONDS = 5;
    private static final int MAX_BACKOFF_DOUBLINGS = 5;

    private final OutboundJobRepository outboundJobRepository;
    private final OutboundJobService outboundJobService;
    private final FormService formService;
    private final WebhookService webhookService;
    private final SubmissionService submissionService;
    private final ObjectMapper objectMapper;

    /**
     * Runs every few seconds — short on purpose, since the DoD for #58 is a
     * Discord message appearing within seconds of the submission.
     *
     * @since v.0.1
     */
    @Scheduled(fixedDelay = 3000)
    public void processDueDeliveries() {
        LocalDateTime now = LocalDateTime.now();
        for (OutboundJob job : outboundJobRepository
                .findTop20ByJobTypeAndStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                        OutboundJobService.JOB_TYPE_WEBHOOK_DELIVERY, OutboundJobStatus.PENDING, now)) {
            processOne(job);
        }
    }

    private void processOne(OutboundJob job) {
        WebhookDeliveryPayload payload = objectMapper.convertValue(job.getPayload(), WebhookDeliveryPayload.class);

        Form form;
        try {
            form = formService.getById(payload.formId());
        } catch (NotFoundException e) {
            log.info("Form {} no longer exists — dropping queued webhook delivery", payload.formId());
            outboundJobService.markSucceeded(job.getId());
            return;
        }

        WebhookConfig webhook = form.getWebhooks() == null ? null : form.getWebhooks().stream()
                .filter(w -> payload.webhookUrl().equals(w.getUrl()))
                .findFirst().orElse(null);

        if (webhook == null) {
            log.info("Webhook {} is no longer configured on form {} — skipping queued delivery",
                    payload.webhookUrl(), payload.formId());
            outboundJobService.markSucceeded(job.getId());
            return;
        }
        if (Boolean.TRUE.equals(webhook.getInvalid())) {
            log.info("Webhook {} is marked invalid — skipping queued delivery", payload.webhookUrl());
            outboundJobService.markSucceeded(job.getId());
            return;
        }

        try {
            String messageId = webhookService.deliverToWebhook(
                    form, webhook, payload.answers(), payload.discordUsername(), payload.discordId(), payload.submissionId());
            if (messageId != null) {
                submissionService.recordWebhookMessageId(payload.submissionId(), payload.webhookUrl(), messageId);
            }
            outboundJobService.markSucceeded(job.getId());
        } catch (HttpClientErrorException.TooManyRequests e) {
            long retryAfterSeconds = parseRetryAfter(e);
            log.info("Webhook {} rate-limited — retrying in {}s", payload.webhookUrl(), retryAfterSeconds);
            outboundJobService.reschedule(job.getId(), LocalDateTime.now().plusSeconds(retryAfterSeconds),
                    "Rate limited (429), Retry-After=" + retryAfterSeconds + "s");
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("Webhook {} returned 404 — marking invalid", payload.webhookUrl());
            formService.markWebhookInvalid(payload.formId(), payload.webhookUrl(),
                    "Discord returned 404 for this webhook — it was likely deleted directly on Discord");
            outboundJobService.markFailed(job.getId(), "Webhook not found (404), marked invalid");
        } catch (Exception e) {
            long backoffSeconds = BASE_RETRY_DELAY_SECONDS * (1L << Math.min(job.getAttempts(), MAX_BACKOFF_DOUBLINGS));
            log.warn("Webhook delivery failed [{}], retrying in {}s: {}",
                    payload.webhookUrl(), backoffSeconds, e.getMessage());
            outboundJobService.reschedule(job.getId(), LocalDateTime.now().plusSeconds(backoffSeconds), e.getMessage());
        }
    }

    private long parseRetryAfter(HttpClientErrorException.TooManyRequests e) {
        String header = e.getResponseHeaders() != null ? e.getResponseHeaders().getFirst("Retry-After") : null;
        if (header == null) return DEFAULT_RATE_LIMIT_RETRY_SECONDS;
        try {
            return Math.max(1, Math.round(Double.parseDouble(header)));
        } catch (NumberFormatException ex) {
            return DEFAULT_RATE_LIMIT_RETRY_SECONDS;
        }
    }
}
