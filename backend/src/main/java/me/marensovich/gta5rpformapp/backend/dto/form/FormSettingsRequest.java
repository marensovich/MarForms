package me.marensovich.gta5rpformapp.backend.dto.form;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;

import java.time.LocalDateTime;

/**
 * Replaces a form's access settings ({@code PUT .../forms/{formId}/settings}).
 * <p>
 * Full-replacement semantics, unlike {@link UpdateFormRequest}: a
 * {@code null} limit/date <b>clears</b> it rather than meaning "unchanged",
 * so the UI can remove a deadline.
 * </p>
 *
 * @param accessMode             who may fill the form in; only {@code OPEN}
 *                               and {@code AUTHENTICATED} are accepted in Stage 1
 * @param submissionLimitPerUser max submissions per respondent, {@code null} = unlimited
 * @param opensAt                accept submissions from, {@code null} = immediately
 * @param closesAt               accept submissions until, {@code null} = no deadline
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record FormSettingsRequest(
        @NotNull FormAccessMode accessMode,
        @Min(1) Integer submissionLimitPerUser,
        LocalDateTime opensAt,
        LocalDateTime closesAt
) {
}
