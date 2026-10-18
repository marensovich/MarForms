package me.marensovich.gta5rpformapp.backend.dto.form;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookUrl;
import org.springframework.beans.BeanUtils;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Data Transfer Object representing a full form response.
 * <p>
 * Contains all form details including the complete schema, webhook configurations,
 * metadata, and configuration. Used for retrieving and displaying forms.
 * </p>
 *
 * @param id          the unique identifier of the form
 * @param serverId    the Discord server (guild) ID the form belongs to (serialized as string)
 * @param channelsIds the set of Discord channel IDs where the form can be submitted (serialized as strings)
 * @param schema      the JSON schema defining the form structure
 * @param webhooks    the list of Discord webhook configurations for form notifications
 * @param active      indicates whether the form is active and accepting submissions
 * @param createdAt   the timestamp when the form was created
 * @param allowedRoleIds RoleGate allow list (serialized as strings, E2.1)
 * @param deniedRoleIds  RoleGate deny list (serialized as strings, E2.1)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record FormResponseDto(
        UUID id,
        @JsonSerialize(using = ToStringSerializer.class)
        Long serverId,
        @JsonSerialize(contentUsing = ToStringSerializer.class)
        Set<Long> channelsIds,
        FormSchema schema,
        List<WebhookConfig> webhooks,
        boolean active,
        LocalDateTime createdAt,
        FormStatus status,
        FormAccessMode accessMode,
        String slug,
        Integer submissionLimitPerUser,
        LocalDateTime opensAt,
        LocalDateTime closesAt,
        LocalDateTime updatedAt,
        Long version,
        @JsonSerialize(contentUsing = ToStringSerializer.class)
        Set<Long> allowedRoleIds,
        @JsonSerialize(contentUsing = ToStringSerializer.class)
        Set<Long> deniedRoleIds,
        /* Edits not yet published (ТЗ ФТ-5.6.2); null = none. The editor shows these. */
        FormSchema draftSchema,
        boolean hasUnpublishedChanges,
        @JsonSerialize(using = ToStringSerializer.class)
        Long updatedBy
) {
    /**
     * Converts a {@link Form} entity to a {@link FormResponseDto}.
     *
     * @param form the form entity to convert
     * @return a new {@link FormResponseDto} containing the form data
     * @since v.0.1
     */
    /** A form as the API shows it: webhook URLs masked for everyone (ТЗ 8.5, #140). */
    public static FormResponseDto from(Form form) {
        return unmasked(form).withMaskedWebhooks();
    }

    private static FormResponseDto unmasked(Form form) {
        return new FormResponseDto(
                form.getId(),
                form.getServerId(),
                form.getChannelsIds(),
                form.getSchema(),
                form.getWebhooks(),
                form.isActive(),
                form.getCreatedAt(),
                form.getStatus(),
                form.getAccessMode(),
                form.getSlug(),
                form.getSubmissionLimitPerUser(),
                form.getOpensAt(),
                form.getClosesAt(),
                form.getUpdatedAt(),
                form.getVersion(),
                form.getAllowedRoleIds(),
                form.getDeniedRoleIds(),
                form.getDraftSchema(),
                form.getDraftSchema() != null,
                form.getUpdatedBy()
        );
    }

    /**
     * The same form with each webhook's token hidden ({@code .../webhooks/<id>/***}),
     * for viewers who may see the form but not edit it — moderators. A webhook
     * URL is a credential: whoever holds it can post to the channel, also after
     * losing their role (#103).
     *
     * @return a copy with masked webhook URLs
     * @since v.0.1
     */
    public FormResponseDto withMaskedWebhooks() {
        List<WebhookConfig> masked = webhooks == null ? null : webhooks.stream().map(webhook -> {
            WebhookConfig copy = new WebhookConfig();
            BeanUtils.copyProperties(webhook, copy);
            // Already masked stays masked: callers may mask an answer that from() masked.
            copy.setUrl(DiscordWebhookUrl.parse(webhook.getUrl()).map(DiscordWebhookUrl::toString)
                    .orElse(webhook.getUrl() != null && webhook.getUrl().endsWith("/***") ? webhook.getUrl() : null));
            return copy;
        }).toList();
        return new FormResponseDto(id, serverId, channelsIds, schema, masked, active, createdAt, status, accessMode,
                slug, submissionLimitPerUser, opensAt, closesAt, updatedAt, version, allowedRoleIds, deniedRoleIds,
                draftSchema, hasUnpublishedChanges, updatedBy);
    }
}
