package me.marensovich.gta5rpformapp.backend.dto.submission;

import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * What a respondent gets back after submitting — enough for the
 * "thank you" screen, nothing about other submissions.
 *
 * @param id        the submission's ID
 * @param status    its moderation status (starts as {@code PENDING})
 * @param createdAt when it was received
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record SubmissionReceiptDto(UUID id, SubmissionStatus status, LocalDateTime createdAt) {
    public static SubmissionReceiptDto from(Submission submission) {
        return new SubmissionReceiptDto(submission.getId(), submission.getStatus(), submission.getCreatedAt());
    }
}
