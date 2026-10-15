package me.marensovich.gta5rpformapp.backend.dto.form;

import me.marensovich.gta5rpformapp.backend.data.forms.AccessCode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.service.forms.FormAccessService;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * What a respondent may see of a form (task #48) — the schema and its
 * state, never its webhooks (their URLs embed a secret token) or channel
 * configuration.
 *
 * @param id                     the form's ID
 * @param slug                   the public slug
 * @param schema                 title, description and fields
 * @param status                 lifecycle status
 * @param active                 legacy alias for "accepting submissions"
 * @param accessMode             who may fill it in
 * @param acceptingSubmissions   whether a submission would be accepted now
 * @param notAcceptingReason     why not, in respondent-facing words ({@code null} if accepting)
 * @param opensAt                opening time, if scheduled
 * @param closesAt               closing time, if scheduled
 * @param submissionLimitPerUser per-respondent limit, if any
 * @param guildId                the server's Discord ID, as a string ("Вернуться в Discord")
 * @param guildName              the server the form belongs to, if known
 * @param guildIconUrl           that server's icon, if it has one
 * @param viewerAccess           whether the current viewer may fill it in: GRANTED or the
 *                               refusal code of ТЗ 3.5 (#110)
 * @param access                 what the refusal's screen shows (opening time, roles, ban…)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record PublicFormDto(
        UUID id,
        String slug,
        FormSchema schema,
        FormStatus status,
        boolean active,
        FormAccessMode accessMode,
        boolean acceptingSubmissions,
        String notAcceptingReason,
        LocalDateTime opensAt,
        LocalDateTime closesAt,
        Integer submissionLimitPerUser,
        String guildId,
        String guildName,
        String guildIconUrl,
        AccessCode viewerAccess,
        AccessDetailsDto access
) {
    public static PublicFormDto from(Form form, String notAcceptingReason, String guildName, String guildIconUrl,
                                     FormAccessService.Decision decision) {
        return new PublicFormDto(
                form.getId(),
                form.getSlug(),
                form.getSchema(),
                form.getStatus(),
                form.isAcceptingSubmissions(),
                form.getAccessMode(),
                form.isAcceptingSubmissions(),
                notAcceptingReason,
                form.getOpensAt(),
                form.getClosesAt(),
                form.getSubmissionLimitPerUser(),
                form.getServerId() != null ? Long.toUnsignedString(form.getServerId()) : null,
                guildName,
                guildIconUrl,
                decision.code(),
                decision.details()
        );
    }
}
