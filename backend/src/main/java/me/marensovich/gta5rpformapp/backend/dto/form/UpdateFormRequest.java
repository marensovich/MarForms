package me.marensovich.gta5rpformapp.backend.dto.form;

import jakarta.validation.Valid;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;

import java.util.List;
import java.util.Set;

/**
 * Data Transfer Object for updating an existing form.
 * <p>
 * All fields are optional, allowing partial updates to the form configuration.
 * Only provided fields will be updated.
 * </p>
 *
 * @param channelsIds the updated set of Discord channel IDs where the form can be submitted (optional)
 * @param webhooks    the updated list of Discord webhook configurations for notifications (optional)
 * @param schema      the updated JSON schema defining the form structure (optional, validated if provided)
 * @param active      the updated active status of the form (optional)
 * @param settings    access settings to save in the same transaction (optional)
 * @param version     the form version the client edited; a mismatch is a 409 (optional)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record UpdateFormRequest(
        Set<String> channelsIds,
        List<WebhookConfig> webhooks,
        @Valid FormSchema schema,
        Boolean active,
        @Valid FormSettingsRequest settings,
        Long version,
        /* A new address (ТЗ 5.2): the old link stops working. */
        String slug,
        /* Review responses on the site (2026-10-19); null = unchanged. */
        Boolean reviewEnabled,
        /* The text above the report in Discord, for every channel; null = unchanged, "" = none. */
        @jakarta.validation.constraints.Size(max = 2000) String discordMessage
) {
}