package me.marensovich.gta5rpformapp.backend.service.jobs;

import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;

import java.util.UUID;

/**
 * A queued direct message to a submission's author about a decision (#120).
 * The decision is copied in when queued, so a later change doesn't alter what
 * this message says.
 *
 * @param submissionId  the submission decided
 * @param recipientId   its author's Discord ID
 * @param guildId       the form's server, for the server log
 * @param guildName     that server's name
 * @param formTitle     the form's title
 * @param status        the decision
 * @param comment       the moderator's comment, if any
 * @param moderatorName who decided
 * @since v.0.1
 */
public record DecisionDmPayload(
        UUID submissionId,
        Long recipientId,
        Long guildId,
        String guildName,
        String formTitle,
        SubmissionStatus status,
        String comment,
        String moderatorName
) {
}
