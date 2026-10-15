package me.marensovich.gta5rpformapp.backend.dto.form;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * What the access screen of ТЗ 3.5 shows besides its code (#110); only the
 * fields of the current code are set.
 *
 * @param opensAt              NOT_OPEN_YET: when the form opens
 * @param closesAt             FORM_CLOSED: when it closed, if by its deadline
 * @param reason               GUILD_BANNED / ACCOUNT_RESTRICTED: the reason, if recorded
 * @param since                GUILD_BANNED: when the ban was issued
 * @param until                GUILD_BANNED / ACCOUNT_RESTRICTED: end of the restriction, {@code null} = permanent
 * @param appealsContact       GUILD_BANNED / ACCOUNT_RESTRICTED: where to appeal (platform settings)
 * @param roles                ROLE_REQUIRED: the allowed roles; ROLE_DENIED: the viewer's denied roles
 * @param previousSubmissionId LIMIT_REACHED: the viewer's latest submission to this form
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AccessDetailsDto(
        LocalDateTime opensAt,
        LocalDateTime closesAt,
        String reason,
        LocalDateTime since,
        LocalDateTime until,
        String appealsContact,
        List<RoleRef> roles,
        UUID previousSubmissionId
) {

    public static final AccessDetailsDto NONE = new AccessDetailsDto(null, null, null, null, null, null, null, null);

    /**
     * A Discord role as shown in a chip.
     *
     * @param id    role snowflake, as a string
     * @param name  role name; {@code null} if the bot can't read the server's roles
     * @param color Discord colour, 0 = none
     */
    public record RoleRef(String id, String name, int color) {
    }

    public static AccessDetailsDto opening(LocalDateTime opensAt) {
        return new AccessDetailsDto(opensAt, null, null, null, null, null, null, null);
    }

    public static AccessDetailsDto closing(LocalDateTime closesAt) {
        return new AccessDetailsDto(null, closesAt, null, null, null, null, null, null);
    }

    public static AccessDetailsDto restriction(String reason, LocalDateTime since, LocalDateTime until, String appealsContact) {
        return new AccessDetailsDto(null, null, reason, since, until, appealsContact, null, null);
    }

    public static AccessDetailsDto roles(List<RoleRef> roles) {
        return new AccessDetailsDto(null, null, null, null, null, null, roles, null);
    }

    public static AccessDetailsDto previous(UUID submissionId) {
        return new AccessDetailsDto(null, null, null, null, null, null, null, submissionId);
    }
}
