package me.marensovich.gta5rpformapp.backend.dto.submission;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

/**
 * Data Transfer Object for submitting a form response.
 * <p>
 * Contains the user's answers to the form fields.
 * </p>
 *
 * @param answers the submitted answers as a key-value map,
 *                where keys correspond to field IDs from the form schema
 *                (must not be null)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record SubmitFormRequest(
        @NotNull Map<String, Object> answers
) {
}