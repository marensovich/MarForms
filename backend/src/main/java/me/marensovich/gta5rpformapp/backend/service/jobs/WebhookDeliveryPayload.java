package me.marensovich.gta5rpformapp.backend.service.jobs;

import java.util.Map;
import java.util.UUID;

/**
 * Payload of an {@code OutboundJobService#JOB_TYPE_WEBHOOK_DELIVERY} job.
 * <p>
 * Deliberately self-contained enough to survive sitting in the queue for a
 * while: {@code formId} + {@code webhookUrl} are resolved back to a live
 * {@code WebhookConfig} at delivery time (so an edited embed color, or the
 * webhook being removed entirely, is reflected in what actually gets sent),
 * rather than snapshotting the whole webhook config at enqueue time.
 * </p>
 *
 * @param formId          the form the submission belongs to
 * @param submissionId     the submission to notify about
 * @param webhookUrl       identifies which of the form's webhooks this job is for
 * @param answers          the submitted answers
 * @param discordUsername  the submitter's Discord username, or {@code null}
 * @param discordId        the submitter's Discord ID, or {@code null}
 * @since v.0.1
 */
public record WebhookDeliveryPayload(
        UUID formId,
        UUID submissionId,
        String webhookUrl,
        Map<String, Object> answers,
        String discordUsername,
        Long discordId
) {
}
