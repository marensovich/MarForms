package me.marensovich.gta5rpformapp.backend.service.jobs;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookHealth;
import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import me.marensovich.gta5rpformapp.backend.service.WebhookService;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookUrl;
import me.marensovich.gta5rpformapp.backend.service.discord.WebhookUrlCipher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpStatusCodeException;

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
    private final WebhookUrlCipher webhookUrlCipher;

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
            try {
                processOne(job);
            } catch (Exception e) {
                log.error("Webhook delivery job {} failed unexpectedly: {}", job.getId(), WebhookUrlCipher.redact(e.getMessage()));
            }
        }
    }

    private void processOne(OutboundJob job) {
        WebhookDeliveryPayload payload = objectMapper.convertValue(job.getPayload(), WebhookDeliveryPayload.class);
        // Sealed when queued; jobs queued before encryption hold the plain URL.
        String webhookUrl = webhookUrlCipher.open(payload.webhookUrl());
        String loggedUrl = WebhookUrlCipher.redact(webhookUrl);

        Form form;
        try {
            form = formService.getById(payload.formId());
        } catch (NotFoundException e) {
            log.info("Form {} no longer exists — dropping queued webhook delivery", payload.formId());
            outboundJobService.markSucceeded(job.getId());
            return;
        }

        WebhookConfig webhook = form.getWebhooks() == null ? null : form.getWebhooks().stream()
                .filter(w -> sameWebhook(webhookUrl, w.getUrl()))
                .findFirst().orElse(null);

        if (webhook == null) {
            log.info("Webhook {} is no longer configured on form {} — skipping queued delivery",
                    loggedUrl, payload.formId());
            outboundJobService.markSucceeded(job.getId());
            return;
        }
        if (Boolean.TRUE.equals(webhook.getInvalid())) {
            log.info("Webhook {} is marked invalid — skipping queued delivery", loggedUrl);
            outboundJobService.markSucceeded(job.getId());
            return;
        }

        String messageId;
        try {
            messageId = webhookService.deliverToWebhook(
                    form, webhook, payload.answers(), payload.discordUsername(), payload.discordId(), payload.submissionId());
        } catch (WebhookService.NotADiscordWebhookException e) {
            log.warn("Webhook {} of form {} is not a Discord webhook URL — marking invalid", loggedUrl, payload.formId());
            formService.markWebhookInvalid(payload.formId(), webhookUrl, "Not a Discord webhook URL");
            outboundJobService.markFailed(job.getId(), "Not a Discord webhook URL, marked invalid");
            return;
        } catch (HttpClientErrorException.TooManyRequests e) {
            long retryAfterSeconds = parseRetryAfter(e);
            log.info("Webhook {} rate-limited — retrying in {}s", loggedUrl, retryAfterSeconds);
            outboundJobService.reschedule(job.getId(), LocalDateTime.now().plusSeconds(retryAfterSeconds),
                    "Rate limited (429), Retry-After=" + retryAfterSeconds + "s");
            return;
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("Webhook {} returned 404 — marking invalid", loggedUrl);
            formService.markWebhookInvalid(payload.formId(), webhookUrl,
                    "Discord returned 404 for this webhook — it was likely deleted directly on Discord");
            outboundJobService.markFailed(job.getId(), "Webhook not found (404), marked invalid");
            return;
        } catch (Exception e) {
            long backoffSeconds = BASE_RETRY_DELAY_SECONDS * (1L << Math.min(job.getAttempts(), MAX_BACKOFF_DOUBLINGS));
            String error = describe(e);
            log.warn("Webhook delivery failed [{}], retrying in {}s: {}",
                    loggedUrl, backoffSeconds, WebhookUrlCipher.redact(e.getMessage()));
            outboundJobService.reschedule(job.getId(), LocalDateTime.now().plusSeconds(backoffSeconds), error);
            if (webhook.effectiveHealth() == WebhookHealth.HEALTHY) {
                formService.updateWebhookHealth(payload.formId(), webhookUrl, WebhookHealth.DEGRADED,
                        WebhookHealth.REASON_DELIVERY_FAILING, error);
            }
            return;
        }

        // Delivered. Nothing below may send the message again, so a failure
        // here is logged and the job still completes (no duplicate posts).
        outboundJobService.markSucceeded(job.getId());
        try {
            if (messageId != null) {
                submissionService.recordWebhookMessageId(payload.submissionId(), webhookUrl, messageId);
            }
            // A delivery got through: clear a delivery-failure status, but not one
            // the health check set (lost channel access may not stop delivery).
            if (WebhookHealth.REASON_DELIVERY_FAILING.equals(webhook.getHealthReason())) {
                formService.updateWebhookHealth(payload.formId(), webhookUrl, WebhookHealth.HEALTHY, null, null);
            }
        } catch (Exception e) {
            log.warn("Webhook {} delivered, but recording it failed: {}", loggedUrl, WebhookUrlCipher.redact(e.getMessage()));
        }
    }

    /**
     * What gets stored and shown to the form's owner about a failure: a status
     * code or the error type, never a response body or message that could
     * echo another server's content (#103).
     */
    static String describe(Exception e) {
        if (e instanceof HttpStatusCodeException http) return "Discord responded " + http.getStatusCode().value();
        return "Delivery failed (" + e.getClass().getSimpleName() + ")";
    }

    private static boolean sameWebhook(String a, String b) {
        if (a == null || b == null) return false;
        return DiscordWebhookUrl.parse(a).map(DiscordWebhookUrl::canonical).orElse(a)
                .equals(DiscordWebhookUrl.parse(b).map(DiscordWebhookUrl::canonical).orElse(b));
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
