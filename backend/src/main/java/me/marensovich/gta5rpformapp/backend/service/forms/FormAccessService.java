package me.marensovich.gta5rpformapp.backend.service.forms;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.exception.FormAccessDeniedException;
import me.marensovich.gta5rpformapp.backend.exception.LoginRequiredException;
import me.marensovich.gta5rpformapp.backend.service.BanListService;
import me.marensovich.gta5rpformapp.backend.service.GuildMembershipService;
import me.marensovich.gta5rpformapp.backend.service.UserService;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

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
 *     access is refused ({@code ROLES_UNAVAILABLE}) rather than guessed.</li>
 *     <li>{@code ANONYMOUS}: anyone; nothing about the viewer is looked at
 *     or recorded (E2.3), so no ban or membership checks either.</li>
 * </ul>
 * In the other modes a logged-in user on the guild's ban list is refused
 * ({@code BANNED}, E2.2) before anything else is checked.
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
     * Outcome of an access check.
     */
    public enum Access {
        GRANTED,
        LOGIN_REQUIRED,
        NOT_IN_GUILD,
        BANNED,
        /** ROLE_GATED: the member has none of the allowed roles. */
        ROLE_REQUIRED,
        /** ROLE_GATED: the member has a denied role. */
        ROLE_DENIED,
        /** ROLE_GATED: the member's roles couldn't be determined. */
        ROLES_UNAVAILABLE
    }

    private final UserService userService;
    private final GuildMembershipService guildMembershipService;
    private final BanListService banListService;

    /**
     * Checks whether {@code user} may fill {@code form} in.
     *
     * @param form the form
     * @param user the current user, or {@code null} if not logged in
     * @return the outcome
     * @since v.0.1
     */
    public Access check(Form form, @Nullable User user) {
        if (form.getAccessMode() == FormAccessMode.ANONYMOUS) {
            return Access.GRANTED;
        }
        if (user == null) {
            return form.getAccessMode() == FormAccessMode.OPEN ? Access.GRANTED : Access.LOGIN_REQUIRED;
        }

        if (banListService.isBanned(form.getServerId(), user.getDiscordId())) {
            return Access.BANNED;
        }

        boolean member = user.isMemberOfGuild(form.getServerId());
        if (!member && userService.resyncGuildsWithStoredToken(user)) {
            member = user.isMemberOfGuild(form.getServerId());
        }

        if (member) {
            guildMembershipService.ensureMembership(user.getDiscordId(), form.getServerId(), GuildRole.RESPONDENT);
            // Refreshed only once the TTL has lapsed (#64).
            List<Long> roles = guildMembershipService.syncDiscordRolesIfStale(user.getDiscordId(), form.getServerId())
                    .map(GuildMembership::getDiscordRoles)
                    .orElse(null);
            return form.getAccessMode() == FormAccessMode.ROLE_GATED ? checkRoleGate(form, roles) : Access.GRANTED;
        }
        return form.getAccessMode() == FormAccessMode.OPEN ? Access.GRANTED : Access.NOT_IN_GUILD;
    }

    /**
     * Like {@link #check}, but throws unless access is granted — for the
     * endpoints that accept answers and files.
     *
     * @param form the form
     * @param user the current user, or {@code null} if not logged in
     * @throws LoginRequiredException     if the form needs a Discord login
     * @throws FormAccessDeniedException  for any other refusal, with a message
     *                                    the respondent can act on
     * @since v.0.1
     */
    public void requireAccess(Form form, @Nullable User user) {
        switch (check(form, user)) {
            case LOGIN_REQUIRED -> throw new LoginRequiredException("Log in with Discord to fill in this form");
            case NOT_IN_GUILD -> throw new FormAccessDeniedException("You must be a member of this server to fill in this form");
            case BANNED -> throw new FormAccessDeniedException("You are banned from submitting forms on this server");
            case ROLE_REQUIRED -> throw new FormAccessDeniedException("You don't have a Discord role this form requires");
            case ROLE_DENIED -> throw new FormAccessDeniedException("One of your Discord roles is not allowed to fill in this form");
            case ROLES_UNAVAILABLE -> throw new FormAccessDeniedException("We couldn't check your Discord roles — try again later");
            case GRANTED -> {
            }
        }
    }

    /**
     * Applies a form's RoleGate to a member's Discord roles; deny wins over allow.
     *
     * @param form  a ROLE_GATED form
     * @param roles the member's role IDs, or {@code null} if unknown
     * @return the outcome
     * @since v.0.1
     */
    static Access checkRoleGate(Form form, @Nullable List<Long> roles) {
        if (roles == null) return Access.ROLES_UNAVAILABLE;
        if (roles.stream().anyMatch(form.getDeniedRoleIds()::contains)) return Access.ROLE_DENIED;
        Set<Long> allowed = form.getAllowedRoleIds();
        if (!allowed.isEmpty() && roles.stream().noneMatch(allowed::contains)) return Access.ROLE_REQUIRED;
        return Access.GRANTED;
    }
}
