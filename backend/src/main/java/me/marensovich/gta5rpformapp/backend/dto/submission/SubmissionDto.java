package me.marensovich.gta5rpformapp.backend.dto.submission;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Data Transfer Object representing a form submission.
 * <p>
 * Contains the full submission data including the submitted answers
 * and submission metadata.
 * </p>
 *
 * @param id        the unique identifier of the submission
 * @param formId    the ID of the form that was submitted
 * @param discordId the Discord ID of the user who submitted the form (serialized as string)
 * @param createdAt the timestamp when the submission was created
 * @param answers   the submitted answers as a key-value map
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record SubmissionDto(
        UUID id,
        UUID formId,
        @JsonSerialize(using = ToStringSerializer.class)
        Long discordId,
        LocalDateTime createdAt,
        Map<String, Object> answers
) {
    /**
     * Converts a {@link Submission} entity to a {@link SubmissionDto}.
     *
     * @param submission the submission entity to convert
     * @return a new {@link SubmissionDto} containing the submission data
     * @since v.0.1
     */
    public static SubmissionDto from(Submission submission) {
        return new SubmissionDto(
                submission.getId(),
                submission.getFormId(),
                submission.getDiscordId(),
                submission.getCreatedAt(),
                submission.getAnswers()
        );
    }
}