package me.marensovich.gta5rpformapp.backend.dto.form;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;

import java.util.List;
import java.util.Set;

/**
 * Data Transfer Object for creating a new form.
 * <p>
 * Contains the necessary information to create a form, including the
 * Discord server ID, optional channel restrictions, webhook configurations,
 * and the form schema.
 * </p>
 *
 * @param serverId    the Discord server (guild) ID the form belongs to (must not be blank)
 * @param channelsIds an optional set of Discord channel IDs where the form can be submitted
 * @param webhooks    an optional list of Discord webhook configurations for notifications
 * @param schema      the JSON schema defining the form structure (must not be null and valid)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record CreateFormRequest(
        @NotBlank String serverId,
        Set<String> channelsIds,
        List<WebhookConfig> webhooks,
        @NotNull @Valid FormSchema schema
) {
}