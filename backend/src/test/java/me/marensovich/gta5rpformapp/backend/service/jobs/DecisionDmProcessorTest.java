package me.marensovich.gta5rpformapp.backend.service.jobs;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import me.marensovich.gta5rpformapp.backend.service.WebhookService;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient.DmResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The bot's direct message about a decision (#120).
 */
@ExtendWith(MockitoExtension.class)
class DecisionDmProcessorTest {

    @Mock
    private OutboundJobRepository outboundJobRepository;
    @Mock
    private OutboundJobService outboundJobService;
    @Mock
    private DiscordBotClient botClient;
    @Mock
    private WebhookService webhookService;
    @Mock
    private AuditLogService auditLogService;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private DecisionDmProcessor processor() {
        DecisionDmProcessor p = new DecisionDmProcessor(outboundJobRepository, outboundJobService, botClient,
                webhookService, auditLogService, objectMapper);
        ReflectionTestUtils.setField(p, "frontendUrl", "https://app");
        return p;
    }

    private OutboundJob job(SubmissionStatus status, String comment) {
        OutboundJob job = new OutboundJob();
        job.setId(UUID.randomUUID());
        job.setAttempts(0);
        job.setMaxAttempts(5);
        job.setPayload(objectMapper.convertValue(new DecisionDmPayload(UUID.randomUUID(), 42L, 7L, "Los Santos RP",
                "Набор в LSPD", status, comment, "Lena"), new TypeReference<Map<String, Object>>() {
        }));
        return job;
    }

    @Test
    @SuppressWarnings("unchecked")
    void writesTheDecisionWithTheCommentAndTheWayToMySubmissions() {
        when(botClient.sendDirectMessage(eq(42L), any())).thenReturn(DmResult.SENT);
        OutboundJob job = job(SubmissionStatus.NEEDS_REVISION, "Укажите возраст");

        processor().processOne(job);

        ArgumentCaptor<List<Map<String, Object>>> embeds = ArgumentCaptor.forClass(List.class);
        verify(botClient).sendDirectMessage(eq(42L), embeds.capture());
        Map<String, Object> embed = embeds.getValue().getFirst();
        assertThat(embed.get("title")).isEqualTo("Решение по заявке: Нужна доработка");
        assertThat(embed.get("description")).isEqualTo("**Набор в LSPD** · Los Santos RP");
        assertThat(embed.get("url")).isEqualTo("https://app/me/submissions");
        assertThat((List<Map<String, Object>>) embed.get("fields"))
                .anyMatch(f -> f.get("name").equals("Комментарий модератора · Lena") && f.get("value").equals("Укажите возраст"));
        verify(outboundJobService).markSucceeded(job.getId());
        verify(auditLogService, never()).logGuildActionAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void closedDirectMessagesAreLoggedAndNotRetried() {
        when(botClient.sendDirectMessage(eq(42L), any())).thenReturn(DmResult.CLOSED);
        OutboundJob job = job(SubmissionStatus.APPROVED, null);

        processor().processOne(job);

        verify(outboundJobService).markFailed(eq(job.getId()), anyString());
        verify(outboundJobService, never()).reschedule(any(), any(), any());
        verify(auditLogService).logGuildActionAs(eq(null), eq("MarForms"), eq(7L), eq(AuditAction.SUBMISSION_DM_FAILED),
                eq("SUBMISSION"), anyString(), eq("Набор в LSPD"), any(), anyString());
    }

    @Test
    void otherFailuresAreRetried() {
        when(botClient.sendDirectMessage(eq(42L), any())).thenReturn(DmResult.FAILED);
        OutboundJob job = job(SubmissionStatus.REJECTED, "Нет");

        processor().processOne(job);

        verify(outboundJobService).reschedule(eq(job.getId()), any(), anyString());
        verify(auditLogService, never()).logGuildActionAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }
}
