package me.marensovich.gta5rpformapp.backend.dto.submission;

import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A respondent's own submission, as listed by {@code GET /api/v1/me/submissions}
 * — its status and the moderator's comment, which is how a respondent
 * learns the outcome (task #54, "platform only" variant). Never exposes who
 * moderated it.
 *
 * @param id               the submission's ID
 * @param formId           the form it was submitted to
 * @param formTitle        that form's title
 * @param status           moderation status
 * @param moderatorComment the moderator's comment, if any
 * @param createdAt        when it was submitted
 * @param decidedAt        when it was decided, if it was
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record MySubmissionDto(
        UUID id,
        UUID formId,
        String formTitle,
        SubmissionStatus status,
        String moderatorComment,
        LocalDateTime createdAt,
        LocalDateTime decidedAt
) {
    public static MySubmissionDto from(Submission submission, String formTitle) {
        return new MySubmissionDto(submission.getId(), submission.getFormId(), formTitle, submission.getStatus(),
                submission.getModeratorComment(), submission.getCreatedAt(), submission.getDecidedAt());
    }
}
