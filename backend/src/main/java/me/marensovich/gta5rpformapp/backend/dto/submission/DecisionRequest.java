package me.marensovich.gta5rpformapp.backend.dto.submission;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;

/**
 * A moderator's decision on a submission ({@code POST /api/v1/submissions/{id}/decision}).
 *
 * @param status  {@code APPROVED}, {@code REJECTED} or {@code NEEDS_REVISION}
 *                ({@code PENDING} is not a decision)
 * @param comment optional note for the respondent / other moderators
 * @param expectedStatus the status the moderator saw; if the submission has
 *                       moved on since (another moderator decided), the
 *                       decision is refused with 409 instead of overwriting
 *                       theirs (optional, #103)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record DecisionRequest(
        @NotNull SubmissionStatus status,
        @Size(max = 2000) String comment,
        SubmissionStatus expectedStatus
) {
}
