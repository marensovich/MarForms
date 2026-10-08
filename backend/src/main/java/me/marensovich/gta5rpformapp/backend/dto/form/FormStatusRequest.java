package me.marensovich.gta5rpformapp.backend.dto.form;

import jakarta.validation.constraints.NotNull;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;

/**
 * Moves a form to another lifecycle status ({@code PUT .../forms/{formId}/status}).
 *
 * @param status the target status
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record FormStatusRequest(@NotNull FormStatus status) {
}
