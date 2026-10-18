package me.marensovich.gta5rpformapp.backend.service.jobs;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import me.marensovich.gta5rpformapp.backend.service.NotificationVars;
import me.marensovich.gta5rpformapp.backend.service.WebhookService;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient.DmResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sends the queued direct messages about decisions (#120, ТЗ ФТ-4.5.5): the bot
 * writes the author the decision, the moderator's comment and a link to «Мои
 * заявки», with the platform's common embed (6.7).
 * <p>
 * Closed DMs, no shared server or no bot at all: the decision stands, the job
 * ends, and the server log records that the message wasn't delivered. Other
 * failures are retried with backoff; when the retries run out, the same note is
 * logged.
 * </p>
 *
 * @author marensovich
 * @since v.0.1
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DecisionDmProcessor {

    private static final long BASE_RETRY_DELAY_SECONDS = 30;
    private static final int MAX_BACKOFF_DOUBLINGS = 5;

    private static final Map<SubmissionStatus, String> STATUS_TEXT = Map.of(
            SubmissionStatus.APPROVED, "Принята",
            SubmissionStatus.REJECTED, "Отклонена",
            SubmissionStatus.NEEDS_REVISION, "Нужна доработка");
    private static final Map<SubmissionStatus, Integer> STATUS_COLOR = Map.of(
            SubmissionStatus.APPROVED, 0x16A34A,
            SubmissionStatus.REJECTED, 0xDC2626,
            SubmissionStatus.NEEDS_REVISION, 0x4F46E5);

    private final OutboundJobRepository outboundJobRepository;
    private final OutboundJobService outboundJobService;
    private final DiscordBotClient botClient;
    private final WebhookService webhookService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Runs every few seconds: the author hears about the decision right away.
     *
     * @since v.0.1
     */
    @Scheduled(fixedDelay = 5000)
    public void processDueMessages() {
        for (OutboundJob job : outboundJobRepository
                .findTop20ByJobTypeAndStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                        OutboundJobService.JOB_TYPE_DECISION_DM, OutboundJobStatus.PENDING, LocalDateTime.now())) {
            try {
                processOne(job);
            } catch (Exception e) {
                log.warn("Decision DM job {} failed unexpectedly: {}", job.getId(), e.getMessage());
                outboundJobService.reschedule(job.getId(), LocalDateTime.now().plusSeconds(BASE_RETRY_DELAY_SECONDS),
                        "Unexpected error (" + e.getClass().getSimpleName() + ")");
            }
        }
    }

    void processOne(OutboundJob job) {
        DecisionDmPayload payload = objectMapper.convertValue(job.getPayload(), DecisionDmPayload.class);
        List<Map<String, Object>> embeds = new ArrayList<>();
        embeds.add(decisionEmbed(payload));
        Map<String, Object> branding = webhookService.brandingEmbed(NotificationVars.of()
                .user(payload.recipientId(), null, false)
                .form(null, payload.formTitle(), null)
                .server(payload.guildId(), payload.guildName())
                .status(payload.status())
                .submission(payload.submissionId())
                .build());
        if (branding != null) embeds.add(branding);

        DmResult result = botClient.sendDirectMessage(payload.recipientId(), embeds);
        switch (result) {
            case SENT -> outboundJobService.markSucceeded(job.getId());
            case CLOSED, NO_BOT -> {
                outboundJobService.markFailed(job.getId(), result == DmResult.CLOSED
                        ? "The author doesn't accept direct messages from the bot" : "No bot session");
                logNotDelivered(payload, result == DmResult.CLOSED
                        ? "ЛС не доставлено: автор закрыл личные сообщения или нет общего сервера с ботом"
                        : "ЛС не доставлено: бот не подключён");
            }
            case FAILED -> {
                long backoff = BASE_RETRY_DELAY_SECONDS * (1L << Math.min(job.getAttempts(), MAX_BACKOFF_DOUBLINGS));
                outboundJobService.reschedule(job.getId(), LocalDateTime.now().plusSeconds(backoff), "Discord refused the message");
                if (job.getAttempts() + 1 >= job.getMaxAttempts()) {
                    logNotDelivered(payload, "ЛС не доставлено: Discord не принял сообщение после нескольких попыток");
                }
            }
        }
    }

    /** The message itself: form, server, decision, comment and the way to «Мои заявки». */
    Map<String, Object> decisionEmbed(DecisionDmPayload p) {
        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", "Решение по заявке: " + STATUS_TEXT.getOrDefault(p.status(), p.status().name()));
        embed.put("description", "**" + nullToEmpty(p.formTitle()) + "**"
                + (p.guildName() != null ? " · " + p.guildName() : ""));
        embed.put("color", STATUS_COLOR.getOrDefault(p.status(), 0x4F46E5));
        embed.put("url", frontendUrl + "/me/submissions");
        List<Map<String, Object>> fields = new ArrayList<>();
        if (p.comment() != null && !p.comment().isBlank()) {
            String comment = p.comment().length() > 1024 ? p.comment().substring(0, 1021) + "…" : p.comment();
            fields.add(Map.of("name", "Комментарий модератора" + (p.moderatorName() != null ? " · " + p.moderatorName() : ""),
                    "value", comment, "inline", false));
        }
        fields.add(Map.of("name", "Все заявки", "value", "[Мои заявки](" + frontendUrl + "/me/submissions)", "inline", false));
        embed.put("fields", fields);
        return embed;
    }

    private void logNotDelivered(DecisionDmPayload p, String details) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("authorDiscordId", String.valueOf(p.recipientId()));
        metadata.put("status", p.status().name());
        auditLogService.logGuildActionAs(null, "MarForms", p.guildId(), AuditAction.SUBMISSION_DM_FAILED,
                "SUBMISSION", String.valueOf(p.submissionId()), p.formTitle(), metadata, details);
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
