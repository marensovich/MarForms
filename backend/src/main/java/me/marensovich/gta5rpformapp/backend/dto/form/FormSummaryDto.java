package me.marensovich.gta5rpformapp.backend.dto.form;

import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookHealth;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Data Transfer Object representing a summarized view of a form.
 * <p>
 * Contains basic form information and statistics, used for dashboard
 * listings and overview displays.
 * </p>
 *
 * @param id              the unique identifier of the form
 * @param title           the title of the form (extracted from the schema)
 * @param active          indicates whether the form is accepting submissions
 *                        (legacy, equals {@code status == PUBLISHED})
 * @param submissionCount the total number of submissions received for this form
 * @param createdAt       the timestamp when the form was created
 * @param serverId        the guild the form belongs to
 * @param status          the form's lifecycle status
 * @param accessMode      who may fill the form in
 * @param slug            the public URL slug, {@code null} until first published
 * @param fieldCount      number of fields in the form
 * @param updatedAt       when the form was last modified
 * @param notificationHealth the worst status among the form's webhooks
 *                        ({@code null} if it has none), E2.4
 * @param notificationReason why the worst webhook is failing (a {@code WebhookHealth.REASON_*}
 *                        code), {@code null} when notifications are fine
 * @param pendingCount    submissions waiting for a decision (ТЗ 4.4.1, the «+12» next to the count)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record FormSummaryDto(
        UUID id,
        String title,
        boolean active,
        long submissionCount,
        LocalDateTime createdAt,
        @JsonSerialize(using = ToStringSerializer.class)
        Long serverId,
        FormStatus status,
        FormAccessMode accessMode,
        String slug,
        int fieldCount,
        LocalDateTime updatedAt,
        WebhookHealth notificationHealth,
        String notificationReason,
        long pendingCount
) {
    public static FormSummaryDto from(Form form, long submissionCount) {
        return from(form, submissionCount, 0);
    }

    public static FormSummaryDto from(Form form, long submissionCount, long pendingCount) {
        WebhookConfig worst = worstWebhook(form);
        WebhookHealth health = worst == null ? null : worst.effectiveHealth();
        return new FormSummaryDto(
                form.getId(),
                form.getSchema() != null ? form.getSchema().getTitle() : null,
                form.isActive(),
                submissionCount,
                form.getCreatedAt(),
                form.getServerId(),
                form.getStatus(),
                form.getAccessMode(),
                form.getSlug(),
                form.getSchema() != null && form.getSchema().getFields() != null
                        ? form.getSchema().getFields().size() : 0,
                form.getUpdatedAt(),
                health,
                health == null || health == WebhookHealth.HEALTHY ? null : worst.getHealthReason(),
                pendingCount
        );
    }

    /** The webhook in the worst state, or {@code null} if the form has none. */
    private static WebhookConfig worstWebhook(Form form) {
        if (form.getWebhooks() == null) return null;
        WebhookConfig worst = null;
        for (WebhookConfig w : form.getWebhooks()) {
            if (w.getUrl() == null || w.getUrl().isBlank()) continue;
            if (worst == null || w.effectiveHealth().ordinal() > worst.effectiveHealth().ordinal()) worst = w;
        }
        return worst;
    }
}
