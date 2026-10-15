package me.marensovich.gta5rpformapp.backend.service.forms;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.AccessCode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.BanListRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.dto.form.AccessDetailsDto;
import me.marensovich.gta5rpformapp.backend.exception.FormAccessException;
import me.marensovich.gta5rpformapp.backend.service.GuildMembershipService;
import me.marensovich.gta5rpformapp.backend.service.SettingsService;
import me.marensovich.gta5rpformapp.backend.service.UserService;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Decides whether a viewer may fill a form in — shared by the public form
 * page, the access-check endpoint and submission intake, so they can never
 * disagree (task #50).
 * <ul>
 *     <li>{@code OPEN}: anyone, logged in or not. A logged-in respondent is
 *     still recorded — this is <b>not</b> the Stage 2 anonymous mode (E2.3).</li>
 *     <li>{@code AUTHENTICATED}: Discord login required, and the respondent
 *     must be a member of the form's guild. A failed membership check
 *     re-syncs the user's guild list with their stored Discord token first
 *     (they may have joined since logging in, #31).</li>
 *     <li>{@code ROLE_GATED}: as {@code AUTHENTICATED}, then the RoleGate
 *     (E2.1) on the member's Discord roles, refreshed once the TTL has
 *     lapsed (#64): any denied role refuses ({@code ROLE_DENIED}, deny wins),
 *     and a non-empty allow list needs one of its roles ({@code ROLE_REQUIRED}).
 *     If the roles were never fetched and the bot can't fetch them now,
 *     access is refused ({@code ROLE_CHECK_FAILED}) rather than guessed.</li>
 *     <li>{@code ANONYMOUS}: anyone; nothing about the viewer is looked at
 *     or recorded (E2.3), so no ban or membership checks either.</li>
 * </ul>
 * In the other modes a logged-in user on the guild's ban list is refused
 * ({@code GUILD_BANNED}, E2.2). Before any of this the form itself must take
 * submissions, and afterwards the per-person limit applies; the codes and
 * their order are those of ТЗ 3.5 ({@link AccessCode}, #110).
 * On success for a logged-in user, the {@code RESPONDENT} membership is
 * upserted and their Discord roles refreshed if stale (#34).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class FormAccessService {

    /**
     * An access outcome: the code of ТЗ 3.5 and what its screen shows.
     *
     * @param code    the first failing check, or GRANTED
     * @param details the code's details; {@link AccessDetailsDto#NONE} if it has none
     */
    public record Decision(AccessCode code, AccessDetailsDto details) {

        static Decision of(AccessCode code) {
            return new Decision(code, AccessDetailsDto.NONE);
        }

        public boolean granted() {
            return code == AccessCode.GRANTED;
        }
    }

    private final UserService userService;
    private final GuildMembershipService guildMembershipService;
    private final BanListRepository banListRepository;
    private final SubmissionRepository submissionRepository;
    private final SettingsService settingsService;
    private final DiscordBotClient discordBotClient;

    /**
     * Decides whether {@code user} may fill {@code form} in, checking in the
     * order of ТЗ 3.5: platform account → form status → login → membership →
     * server ban → roles → per-person limit.
     *
     * @param form               the form
     * @param user               the current user, or {@code null} if not logged in
     * @param anonymousTokenHash the browser's hashed Anonymous-Token for the
     *                           limit of an anonymous form, if sent
     * @return the outcome with its details
     * @since v.0.1
     */
    public Decision evaluate(Form form, @Nullable User user, @Nullable String anonymousTokenHash) {
        Decision blocked = checkWithoutLimit(form, user);
        if (!blocked.granted()) return blocked;
        return checkLimit(form, form.getAccessMode() == FormAccessMode.ANONYMOUS ? null : user, anonymousTokenHash);
    }

    /**
     * The outcome code only, without the per-person limit.
     *
     * @param form the form
     * @param user the current user, or {@code null}
     * @return the code
     * @since v.0.1
     */
    public AccessCode check(Form form, @Nullable User user) {
        return checkWithoutLimit(form, user).code();
    }

    /**
     * Throws unless the user may fill the form in — for the endpoints that
     * accept answers and files. The per-person limit is not checked here:
     * submission intake counts it under a row lock.
     *
     * @param form the form
     * @param user the current user, or {@code null} if not logged in
     * @throws FormAccessException with the refusal's code and details
     * @since v.0.1
     */
    public void requireAccess(Form form, @Nullable User user) {
        Decision decision = checkWithoutLimit(form, user);
        if (!decision.granted()) throw refusal(decision);
    }

    /**
     * The exception for a refused decision, with a message the respondent can act on.
     *
     * @param decision a refusal
     * @return the exception to throw
     * @since v.0.1
     */
    public static FormAccessException refusal(Decision decision) {
        String message = switch (decision.code()) {
            case ACCOUNT_RESTRICTED -> "Your MarForms account is restricted";
            case NOT_OPEN_YET -> "This form is not open yet";
            case FORM_CLOSED -> "This form is closed and no longer accepts submissions";
            case FORM_ARCHIVED -> "This form has been archived";
            case FORM_NOT_FOUND -> "Form not found";
            case AUTH_REQUIRED -> "Log in with Discord to fill in this form";
            case NOT_GUILD_MEMBER -> "You must be a member of this server to fill in this form";
            case GUILD_BANNED -> "You are banned from submitting forms on this server";
            case ROLE_REQUIRED -> "You don't have a Discord role this form requires";
            case ROLE_DENIED -> "One of your Discord roles is not allowed to fill in this form";
            case ROLE_CHECK_FAILED -> "We couldn't check your Discord roles — try again later";
            case LIMIT_REACHED -> "You have already used all your submissions for this form";
            case GRANTED -> throw new IllegalArgumentException("Not a refusal");
        };
        return new FormAccessException(decision.code(), message, decision.details());
    }

    private Decision checkWithoutLimit(Form form, @Nullable User user) {
        if (user != null && user.isCurrentlyBanned()) {
            // Normally unreachable: the JWT filter already refuses a restricted account.
            return new Decision(AccessCode.ACCOUNT_RESTRICTED, AccessDetailsDto.restriction(null, null,
                    user.isBannedPermanently() ? null : user.getBannedUntil(), settingsService.getSettings().banAdminContact()));
        }
        Decision status = checkStatus(form);
        if (status != null) return status;

        // Anonymous forms look at nothing about the viewer (E2.3).
        if (form.getAccessMode() == FormAccessMode.ANONYMOUS) return Decision.of(AccessCode.GRANTED);
        boolean open = form.getAccessMode() == FormAccessMode.OPEN;
        if (user == null) return Decision.of(open ? AccessCode.GRANTED : AccessCode.AUTH_REQUIRED);

        boolean member = user.isMemberOfGuild(form.getServerId());
        if (!member && userService.resyncGuildsWithStoredToken(user)) {
            member = user.isMemberOfGuild(form.getServerId());
        }
        if (!member && !open) return Decision.of(AccessCode.NOT_GUILD_MEMBER);

        var ban = banListRepository.findByGuildIdAndDiscordId(form.getServerId(), user.getDiscordId());
        if (ban.isPresent()) {
            return new Decision(AccessCode.GUILD_BANNED, AccessDetailsDto.restriction(ban.get().getReason(),
                    ban.get().getCreatedAt(), null, settingsService.getSettings().banAdminContact()));
        }
        if (!member) return Decision.of(AccessCode.GRANTED);

        guildMembershipService.ensureMembership(user.getDiscordId(), form.getServerId(), GuildRole.RESPONDENT);
        // Refreshed only once the TTL has lapsed (#64).
        List<Long> roles = guildMembershipService.syncDiscordRolesIfStale(user.getDiscordId(), form.getServerId())
                .map(GuildMembership::getDiscordRoles)
                .orElse(null);
        if (form.getAccessMode() != FormAccessMode.ROLE_GATED) return Decision.of(AccessCode.GRANTED);

        AccessCode gate = checkRoleGate(form, roles);
        return switch (gate) {
            case ROLE_REQUIRED -> new Decision(gate, AccessDetailsDto.roles(roleRefs(form.getServerId(), form.getAllowedRoleIds())));
            case ROLE_DENIED -> new Decision(gate, AccessDetailsDto.roles(roleRefs(form.getServerId(),
                    roles.stream().filter(form.getDeniedRoleIds()::contains).toList())));
            default -> Decision.of(gate);
        };
    }

    /** Form status and opening window; {@code null} when the form takes submissions. */
    private static @Nullable Decision checkStatus(Form form) {
        return switch (form.getStatus()) {
            case DRAFT -> Decision.of(AccessCode.FORM_NOT_FOUND);
            case ARCHIVED -> Decision.of(AccessCode.FORM_ARCHIVED);
            case CLOSED -> Decision.of(AccessCode.FORM_CLOSED);
            case PUBLISHED -> {
                LocalDateTime now = LocalDateTime.now();
                if (form.getOpensAt() != null && now.isBefore(form.getOpensAt())) {
                    yield new Decision(AccessCode.NOT_OPEN_YET, AccessDetailsDto.opening(form.getOpensAt()));
                }
                if (form.getClosesAt() != null && now.isAfter(form.getClosesAt())) {
                    yield new Decision(AccessCode.FORM_CLOSED, AccessDetailsDto.closing(form.getClosesAt()));
                }
                yield null;
            }
        };
    }

    /** LIMIT_REACHED once the user (or the anonymous browser) has used up the per-person limit. */
    private Decision checkLimit(Form form, @Nullable User user, @Nullable String anonymousTokenHash) {
        Integer limit = form.getSubmissionLimitPerUser();
        if (limit == null) return Decision.of(AccessCode.GRANTED);
        if (user != null) {
            if (submissionRepository.countByFormIdAndDiscordId(form.getId(), user.getDiscordId()) < limit) {
                return Decision.of(AccessCode.GRANTED);
            }
            UUID latest = submissionRepository
                    .findAllByFormIdAndDiscordId(form.getId(), user.getDiscordId(),
                            PageRequest.of(0, 1, Sort.by(Sort.Direction.DESC, "createdAt")))
                    .stream().findFirst().map(Submission::getId).orElse(null);
            return new Decision(AccessCode.LIMIT_REACHED, AccessDetailsDto.previous(latest));
        }
        if (anonymousTokenHash != null
                && submissionRepository.countByFormIdAndAnonymousToken(form.getId(), anonymousTokenHash) >= limit) {
            return Decision.of(AccessCode.LIMIT_REACHED);
        }
        return Decision.of(AccessCode.GRANTED);
    }

    /** Role chips for an access screen; names stay {@code null} if the bot can't read the server's roles. */
    private List<AccessDetailsDto.RoleRef> roleRefs(Long guildId, Collection<Long> roleIds) {
        Map<Long, DiscordBotClient.DiscordRole> known = discordBotClient.fetchRoles(guildId);
        return roleIds.stream()
                .sorted()
                .map(id -> {
                    var role = known.get(id);
                    return new AccessDetailsDto.RoleRef(Long.toUnsignedString(id),
                            role != null ? role.name() : null, role != null ? role.color() : 0);
                })
                .toList();
    }

    /**
     * Applies a form's RoleGate to a member's Discord roles; deny wins over allow.
     *
     * @param form  a ROLE_GATED form
     * @param roles the member's role IDs, or {@code null} if unknown
     * @return the outcome
     * @since v.0.1
     */
    static AccessCode checkRoleGate(Form form, @Nullable List<Long> roles) {
        if (roles == null) return AccessCode.ROLE_CHECK_FAILED;
        if (roles.stream().anyMatch(form.getDeniedRoleIds()::contains)) return AccessCode.ROLE_DENIED;
        Set<Long> allowed = form.getAllowedRoleIds();
        if (!allowed.isEmpty() && roles.stream().noneMatch(allowed::contains)) return AccessCode.ROLE_REQUIRED;
        return AccessCode.GRANTED;
    }
}
