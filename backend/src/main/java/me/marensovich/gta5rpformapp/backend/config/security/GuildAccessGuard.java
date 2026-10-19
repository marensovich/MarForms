package me.marensovich.gta5rpformapp.backend.config.security;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionFileRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.service.GuildMembershipService;
import org.springframework.lang.Nullable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The single point of authorization for per-guild roles (task #62).
 * <p>
 * Exposed as the {@code guildAccess} bean so endpoints can declare their
 * requirement in {@code @PreAuthorize}, resolving the guild from whatever
 * the URL identifies:
 * </p>
 * <pre>{@code
 * @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
 * @PreAuthorize("@guildAccess.hasRoleForForm(#formId, 'MODERATOR')")
 * @PreAuthorize("@guildAccess.hasRoleForSubmission(#id, 'MODERATOR')")
 * }</pre>
 * <p>
 * Roles are hierarchical: {@code OWNER} satisfies a {@code MODERATOR}
 * requirement, and both satisfy {@code RESPONDENT}. No membership row (or
 * no authenticated user) means no access. A moderator the owner narrowed to
 * some forms (#18) reaches only those through the form, submission and file
 * checks; guild-wide lists narrow themselves with {@link #formScope}. A guard
 * returning {@code false}
 * makes Spring Security answer 403.
 * </p>
 * <p>
 * Platform-admin access (the global {@code Role}/{@code Permission} RBAC)
 * is a separate layer and is combined explicitly in the expression where it
 * applies, e.g. {@code hasAuthority('FORMS_MANAGE') or @guildAccess...}.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Component("guildAccess")
@RequiredArgsConstructor
public class GuildAccessGuard {

    private final GuildMembershipRepository guildMembershipRepository;
    private final FormRepository formRepository;
    private final SubmissionRepository submissionRepository;
    private final SubmissionFileRepository submissionFileRepository;
    private final GuildMembershipService guildMembershipService;

    /**
     * Whether the current user holds at least {@code minimumRole} on a guild.
     *
     * @param guildId     the Discord guild snowflake ID, as a {@code Long} or
     *                    numeric {@code String} (request bodies carry it as a string)
     * @param minimumRole the required role name ({@code OWNER}, {@code MODERATOR}, {@code RESPONDENT})
     * @return {@code true} if access is granted
     * @since v.0.1
     */
    public boolean hasRole(Object guildId, String minimumRole) {
        return granted(guildId, GuildRole.valueOf(minimumRole)).isPresent();
    }

    /**
     * Same as {@link #hasRole}, for the guild a form belongs to. A moderator
     * the owner narrowed to some forms reaches only those (#18).
     *
     * @param formId      the form's ID
     * @param minimumRole the required role name
     * @return {@code true} if access is granted; {@code false} if the form doesn't exist
     * @since v.0.1
     */
    public boolean hasRoleForForm(UUID formId, String minimumRole) {
        if (formId == null) return false;
        GuildRole required = GuildRole.valueOf(minimumRole);
        return formRepository.findById(formId)
                .flatMap(form -> granted(form.getServerId(), required))
                .filter(membership -> required == GuildRole.RESPONDENT || reaches(membership, formId))
                .isPresent();
    }

    /**
     * The forms of a guild the current user may work with as its moderator (#18).
     *
     * @param guildId the Discord guild snowflake ID
     * @return the forms of a moderator the owner narrowed; {@code null} = no
     * narrowing (owners, moderators of all forms, and anyone else)
     * @since v.0.1
     */
    public @Nullable Set<UUID> formScope(Object guildId) {
        Long userId = currentUserId();
        Long guild = toGuildId(guildId);
        if (userId == null || guild == null) return null;
        return guildMembershipRepository.findByUser_IdAndGuild_DiscordGuildId(userId, guild)
                .filter(m -> m.getRole() == GuildRole.MODERATOR && m.isFormsRestricted())
                .map(m -> guildMembershipRepository.findFormIds(m.getId()))
                .orElse(null);
    }

    /**
     * Same as {@link #hasRole}, for the guild a submission's form belongs to.
     *
     * @param submissionId the submission's ID
     * @param minimumRole  the required role name
     * @return {@code true} if access is granted; {@code false} if the submission doesn't exist
     * @since v.0.1
     */
    public boolean hasRoleForSubmission(UUID submissionId, String minimumRole) {
        if (submissionId == null) return false;
        return submissionRepository.findById(submissionId)
                .map(submission -> hasRoleForForm(submission.getFormId(), minimumRole))
                .orElse(false);
    }

    /**
     * Same as {@link #hasRole}, for an uploaded file: only files already
     * attached to a submission, via that submission's form (E3.2).
     *
     * @param fileId      the file's ID
     * @param minimumRole the required role name
     * @return {@code true} if access is granted; {@code false} if the file doesn't exist or is unattached
     * @since v.0.1
     */
    public boolean hasRoleForFile(UUID fileId, String minimumRole) {
        if (fileId == null) return false;
        return submissionFileRepository.findById(fileId)
                .filter(file -> file.getSubmissionId() != null)
                .map(file -> hasRoleForForm(file.getFormId(), minimumRole))
                .orElse(false);
    }

    /**
     * Role hierarchy check — lower ordinal means more privilege.
     *
     * @param actual   the role the user holds
     * @param required the role the endpoint requires
     * @return {@code true} if {@code actual} is at least {@code required}
     * @since v.0.1
     */
    public static boolean satisfies(GuildRole actual, GuildRole required) {
        return actual.ordinal() <= required.ordinal();
    }

    /** The current user's membership if it holds at least {@code required} on the guild. */
    private Optional<GuildMembership> granted(Object guildId, GuildRole required) {
        Long userId = currentUserId();
        Long guild = toGuildId(guildId);
        if (userId == null || guild == null) return Optional.empty();
        return guildMembershipRepository.findByUser_IdAndGuild_DiscordGuildId(userId, guild)
                // Staff rights are re-confirmed with Discord on use (TTL-cached, #103).
                .map(membership -> required == GuildRole.RESPONDENT ? membership
                        : guildMembershipService.verifyStaffIfStale(membership))
                .filter(membership -> satisfies(membership.getRole(), required));
    }

    /** Owners reach every form of their guild; a narrowed moderator only the listed ones. */
    private boolean reaches(GuildMembership membership, UUID formId) {
        return membership.getRole() != GuildRole.MODERATOR || !membership.isFormsRestricted()
                || guildMembershipRepository.findFormIds(membership.getId()).contains(formId);
    }

    private static Long toGuildId(Object guildId) {
        if (guildId instanceof Long l) return l;
        if (guildId instanceof Number n) return n.longValue();
        if (guildId instanceof String s && !s.isBlank()) {
            try {
                return Long.parseUnsignedLong(s.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof CustomUserDetails details)) return null;
        return details.getUser().getId();
    }
}
