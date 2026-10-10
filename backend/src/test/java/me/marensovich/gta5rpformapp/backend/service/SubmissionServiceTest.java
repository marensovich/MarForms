package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmitFormRequest;
import me.marensovich.gta5rpformapp.backend.service.files.FileService;
import me.marensovich.gta5rpformapp.backend.service.forms.FormAccessService;
import me.marensovich.gta5rpformapp.backend.service.jobs.OutboundJobService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubmissionServiceTest {

    @Mock
    private SubmissionRepository submissionRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FormService formService;
    @Mock
    private WebhookService webhookService;
    @Mock
    private AuditLogService auditLogService;
    @Mock
    private OutboundJobService outboundJobService;
    @Mock
    private FormAccessService formAccessService;
    @Mock
    private FileService fileService;

    private SubmissionService service() {
        return new SubmissionService(
                submissionRepository, userRepository, formService, webhookService, auditLogService, outboundJobService,
                formAccessService, fileService);
    }

    private Form activeFormWithWebhooks(WebhookConfig... webhooks) {
        Form form = new Form();
        form.setId(UUID.randomUUID());
        form.setStatus(me.marensovich.gta5rpformapp.backend.data.forms.FormStatus.PUBLISHED);
        FormSchema schema = new FormSchema();
        schema.setTitle("Test Form");
        form.setSchema(schema);
        form.setWebhooks(List.of(webhooks));
        return form;
    }

    private WebhookConfig webhook(String url) {
        WebhookConfig cfg = new WebhookConfig();
        cfg.setUrl(url);
        return cfg;
    }

    @Test
    void enqueuesOneJobPerConfiguredWebhookAndNeverCallsWebhookServiceDirectly() {
        Form form = activeFormWithWebhooks(webhook("https://discord.com/api/webhooks/1/a"),
                webhook("https://discord.com/api/webhooks/2/b"));
        when(formService.getById(form.getId())).thenReturn(form);
        when(formAccessService.check(any(), any())).thenReturn(FormAccessService.Access.GRANTED);
        when(submissionRepository.save(any(Submission.class))).thenAnswer(inv -> {
            Submission s = inv.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });

        service().submit(form.getId(), 123L, new SubmitFormRequest(Map.of("q1", "answer")));

        verify(outboundJobService, times(2))
                .enqueue(eq(OutboundJobService.JOB_TYPE_WEBHOOK_DELIVERY), any());
        verifyNoInteractions(webhookService);
    }

    @Test
    void skipsWebhooksMarkedInvalid() {
        WebhookConfig invalid = webhook("https://discord.com/api/webhooks/1/a");
        invalid.setInvalid(true);
        Form form = activeFormWithWebhooks(invalid, webhook("https://discord.com/api/webhooks/2/b"));
        when(formService.getById(form.getId())).thenReturn(form);
        when(formAccessService.check(any(), any())).thenReturn(FormAccessService.Access.GRANTED);
        when(submissionRepository.save(any(Submission.class))).thenAnswer(inv -> {
            Submission s = inv.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });

        service().submit(form.getId(), 123L, new SubmitFormRequest(Map.of()));

        verify(outboundJobService, times(1))
                .enqueue(eq(OutboundJobService.JOB_TYPE_WEBHOOK_DELIVERY), any());
    }

    @Test
    void enqueuesNothingWhenTheFormHasNoWebhooks() {
        Form form = activeFormWithWebhooks();
        when(formService.getById(form.getId())).thenReturn(form);
        when(formAccessService.check(any(), any())).thenReturn(FormAccessService.Access.GRANTED);
        when(submissionRepository.save(any(Submission.class))).thenAnswer(inv -> {
            Submission s = inv.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });

        service().submit(form.getId(), 123L, new SubmitFormRequest(Map.of()));

        verifyNoInteractions(outboundJobService);
    }

    @Test
    void rejectsSubmissionsToAnInactiveForm() {
        Form form = activeFormWithWebhooks();
        form.setStatus(me.marensovich.gta5rpformapp.backend.data.forms.FormStatus.CLOSED);
        when(formService.getById(form.getId())).thenReturn(form);

        try {
            service().submit(form.getId(), 123L, new SubmitFormRequest(Map.of()));
            org.junit.jupiter.api.Assertions.fail("expected InvalidStateException");
        } catch (me.marensovich.gta5rpformapp.backend.exception.InvalidStateException expected) {
            // expected
        }

        verifyNoInteractions(submissionRepository, outboundJobService);
    }
}
