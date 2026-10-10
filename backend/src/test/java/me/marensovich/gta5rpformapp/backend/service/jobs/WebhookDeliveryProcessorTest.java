package me.marensovich.gta5rpformapp.backend.service.jobs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookHealth;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import me.marensovich.gta5rpformapp.backend.service.WebhookService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebhookDeliveryProcessorTest {

    @Mock
    private OutboundJobRepository outboundJobRepository;
    @Mock
    private OutboundJobService outboundJobService;
    @Mock
    private FormService formService;
    @Mock
    private WebhookService webhookService;
    @Mock
    private SubmissionService submissionService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private WebhookDeliveryProcessor processor() {
        return new WebhookDeliveryProcessor(
                outboundJobRepository, outboundJobService, formService, webhookService, submissionService, objectMapper);
    }

    private OutboundJob jobFor(WebhookDeliveryPayload payload) {
        OutboundJob job = new OutboundJob();
        job.setId(UUID.randomUUID());
        job.setJobType(OutboundJobService.JOB_TYPE_WEBHOOK_DELIVERY);
        job.setPayload(objectMapper.convertValue(payload, new TypeReference<Map<String, Object>>() {
        }));
        job.setAttempts(0);
        job.setMaxAttempts(5);
        return job;
    }

    private Form formWithWebhook(UUID formId, WebhookConfig webhook) {
        Form form = new Form();
        form.setId(formId);
        FormSchema schema = new FormSchema();
        schema.setTitle("Test Form");
        schema.setFields(List.of());
        form.setSchema(schema);
        form.setWebhooks(webhook == null ? List.of() : List.of(webhook));
        return form;
    }

    private void runDueJob(OutboundJob job) {
        when(outboundJobRepository.findTop20ByJobTypeAndStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                eq(OutboundJobService.JOB_TYPE_WEBHOOK_DELIVERY), any(), any(LocalDateTime.class)))
                .thenReturn(List.of(job));
        processor().processDueDeliveries();
    }

    @Test
    void successfulDeliveryRecordsMessageIdAndMarksJobSucceeded() {
        UUID formId = UUID.randomUUID();
        UUID submissionId = UUID.randomUUID();
        WebhookConfig webhook = new WebhookConfig();
        webhook.setUrl("https://discord.com/api/webhooks/1/tok");
        Form form = formWithWebhook(formId, webhook);
        var payload = new WebhookDeliveryPayload(formId, submissionId, webhook.getUrl(), Map.of(), "alice", 42L);
        OutboundJob job = jobFor(payload);

        when(formService.getById(formId)).thenReturn(form);
        when(webhookService.deliverToWebhook(eq(form), eq(webhook), any(), eq("alice"), eq(42L), eq(submissionId)))
                .thenReturn("999888777");

        runDueJob(job);

        verify(submissionService).recordWebhookMessageId(submissionId, webhook.getUrl(), "999888777");
        verify(outboundJobService).markSucceeded(job.getId());
    }

    @Test
    void skipsAndMarksSucceededWhenTheFormNoLongerExists() {
        UUID formId = UUID.randomUUID();
        var payload = new WebhookDeliveryPayload(formId, UUID.randomUUID(), "https://discord.com/api/webhooks/1/tok",
                Map.of(), null, null);
        OutboundJob job = jobFor(payload);

        when(formService.getById(formId)).thenThrow(new NotFoundException("Form not found: " + formId));

        runDueJob(job);

        verify(outboundJobService).markSucceeded(job.getId());
        verifyNoInteractions(webhookService);
    }

    @Test
    void skipsAndMarksSucceededWhenTheWebhookWasRemovedFromTheForm() {
        UUID formId = UUID.randomUUID();
        Form form = formWithWebhook(formId, null);
        var payload = new WebhookDeliveryPayload(formId, UUID.randomUUID(), "https://discord.com/api/webhooks/1/tok",
                Map.of(), null, null);
        OutboundJob job = jobFor(payload);

        when(formService.getById(formId)).thenReturn(form);

        runDueJob(job);

        verify(outboundJobService).markSucceeded(job.getId());
        verifyNoInteractions(webhookService);
    }

    @Test
    void skipsAndMarksSucceededWhenTheWebhookIsAlreadyMarkedInvalid() {
        UUID formId = UUID.randomUUID();
        WebhookConfig webhook = new WebhookConfig();
        webhook.setUrl("https://discord.com/api/webhooks/1/tok");
        webhook.setInvalid(true);
        Form form = formWithWebhook(formId, webhook);
        var payload = new WebhookDeliveryPayload(formId, UUID.randomUUID(), webhook.getUrl(), Map.of(), null, null);
        OutboundJob job = jobFor(payload);

        when(formService.getById(formId)).thenReturn(form);

        runDueJob(job);

        verify(outboundJobService).markSucceeded(job.getId());
        verifyNoInteractions(webhookService);
    }

    @Test
    void rateLimitReschedulesUsingTheRetryAfterHeader() {
        UUID formId = UUID.randomUUID();
        WebhookConfig webhook = new WebhookConfig();
        webhook.setUrl("https://discord.com/api/webhooks/1/tok");
        Form form = formWithWebhook(formId, webhook);
        var payload = new WebhookDeliveryPayload(formId, UUID.randomUUID(), webhook.getUrl(), Map.of(), null, null);
        OutboundJob job = jobFor(payload);

        HttpHeaders headers = new HttpHeaders();
        headers.add("Retry-After", "7");
        var rateLimited = HttpClientErrorException.create(
                HttpStatus.TOO_MANY_REQUESTS, "Too Many Requests", headers, new byte[0], null);

        when(formService.getById(formId)).thenReturn(form);
        when(webhookService.deliverToWebhook(any(), any(), any(), any(), any(), any())).thenThrow(rateLimited);

        runDueJob(job);

        verify(outboundJobService).reschedule(eq(job.getId()), argThat(t ->
                t.isAfter(LocalDateTime.now().plusSeconds(5)) && t.isBefore(LocalDateTime.now().plusSeconds(9))
        ), anyString());
        verify(outboundJobService, never()).markFailed(any(), anyString());
    }

    @Test
    void notFoundMarksTheWebhookInvalidAndFailsTheJobPermanently() {
        UUID formId = UUID.randomUUID();
        WebhookConfig webhook = new WebhookConfig();
        webhook.setUrl("https://discord.com/api/webhooks/1/tok");
        Form form = formWithWebhook(formId, webhook);
        var payload = new WebhookDeliveryPayload(formId, UUID.randomUUID(), webhook.getUrl(), Map.of(), null, null);
        OutboundJob job = jobFor(payload);

        var notFound = HttpClientErrorException.create(
                HttpStatus.NOT_FOUND, "Not Found", new HttpHeaders(), new byte[0], null);

        when(formService.getById(formId)).thenReturn(form);
        when(webhookService.deliverToWebhook(any(), any(), any(), any(), any(), any())).thenThrow(notFound);

        runDueJob(job);

        verify(formService).markWebhookInvalid(eq(formId), eq(webhook.getUrl()), anyString());
        verify(outboundJobService).markFailed(eq(job.getId()), anyString());
        verify(outboundJobService, never()).reschedule(any(), any(), anyString());
    }

    @Test
    void genericFailureReschedulesWithBackoff() {
        UUID formId = UUID.randomUUID();
        WebhookConfig webhook = new WebhookConfig();
        webhook.setUrl("https://discord.com/api/webhooks/1/tok");
        Form form = formWithWebhook(formId, webhook);
        var payload = new WebhookDeliveryPayload(formId, UUID.randomUUID(), webhook.getUrl(), Map.of(), null, null);
        OutboundJob job = jobFor(payload);

        when(formService.getById(formId)).thenReturn(form);
        when(webhookService.deliverToWebhook(any(), any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("connection reset"));

        runDueJob(job);

        verify(outboundJobService).reschedule(eq(job.getId()), any(LocalDateTime.class), eq("connection reset"));
    }

    @Test
    void aFailedDeliveryDegradesTheWebhookAndTheNextSuccessRestoresIt() {
        UUID formId = UUID.randomUUID();
        WebhookConfig webhook = new WebhookConfig();
        webhook.setUrl("https://discord.com/api/webhooks/1/tok");
        Form form = formWithWebhook(formId, webhook);
        var payload = new WebhookDeliveryPayload(formId, UUID.randomUUID(), webhook.getUrl(), Map.of(), null, null);

        when(formService.getById(formId)).thenReturn(form);
        when(webhookService.deliverToWebhook(any(), any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("connection reset"));
        runDueJob(jobFor(payload));
        verify(formService).updateWebhookHealth(formId, webhook.getUrl(), WebhookHealth.DEGRADED,
                WebhookHealth.REASON_DELIVERY_FAILING, "connection reset");

        webhook.setHealth(WebhookHealth.DEGRADED);
        webhook.setHealthReason(WebhookHealth.REASON_DELIVERY_FAILING);
        org.mockito.Mockito.reset(webhookService);
        when(webhookService.deliverToWebhook(any(), any(), any(), any(), any(), any())).thenReturn(null);
        runDueJob(jobFor(payload));
        verify(formService).updateWebhookHealth(formId, webhook.getUrl(), WebhookHealth.HEALTHY, null, null);
    }
}
