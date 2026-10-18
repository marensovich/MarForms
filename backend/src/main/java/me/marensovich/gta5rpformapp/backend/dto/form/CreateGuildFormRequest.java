package me.marensovich.gta5rpformapp.backend.dto.form;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;

import java.util.List;
import java.util.Set;

/**
 * Request to create a form in a guild ({@code POST /api/v1/guilds/{guildId}/forms}).
 * The guild comes from the URL; the form starts as a {@code DRAFT}.
 *
 * @param schema      title, description and fields (fields may be empty for a draft)
 * @param channelsIds optional channel restriction
 * @param webhooks    optional notification webhooks
 * @param accessMode     optional; defaults to {@code AUTHENTICATED}
 * @param allowedRoleIds RoleGate allow list, Discord role IDs (optional, E2.1)
 * @param deniedRoleIds  RoleGate deny list, Discord role IDs (optional, E2.1)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record CreateGuildFormRequest(
        @NotNull @Valid FormSchema schema,
        Set<String> channelsIds,
        List<WebhookConfig> webhooks,
        FormAccessMode accessMode,
        Set<String> allowedRoleIds,
        Set<String> deniedRoleIds,
        /* The form's address chosen in the wizard (ТЗ 5.2); generated on first publish when absent. */
        String slug
) {
}
