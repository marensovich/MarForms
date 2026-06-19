package me.marensovich.gta5rpformapp.backend.dto.form;

import jakarta.validation.Valid;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;

import java.util.Set;

/**
 * Data Transfer Object for updating an existing form.
 * <p>
 * All fields are optional, allowing partial updates to the form configuration.
 * Only provided fields will be updated.
 * </p>
 *
 * @param channelsIds the updated set of Discord channel IDs where the form can be submitted (optional)
 * @param schema      the updated JSON schema defining the form structure (optional, validated if provided)
 * @param active      the updated active status of the form (optional)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record UpdateFormRequest(
        Set<Long> channelsIds,
        @Valid FormSchema schema,
        Boolean active
) {
}