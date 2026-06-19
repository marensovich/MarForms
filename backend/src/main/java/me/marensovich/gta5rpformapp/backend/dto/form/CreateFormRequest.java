package me.marensovich.gta5rpformapp.backend.dto.form;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;

import java.util.Set;

/**
 * Data Transfer Object for creating a new form.
 * <p>
 * Contains the necessary information to create a form, including the
 * Discord server ID, optional channel restrictions, and the form schema.
 * </p>
 *
 * @param serverId    the Discord server (guild) ID the form belongs to (must not be null)
 * @param channelsIds an optional set of Discord channel IDs where the form can be submitted
 * @param schema      the JSON schema defining the form structure (must not be null and valid)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record CreateFormRequest(
        @NotNull Long serverId,
        Set<Long> channelsIds,
        @NotNull @Valid FormSchema schema
) {
}