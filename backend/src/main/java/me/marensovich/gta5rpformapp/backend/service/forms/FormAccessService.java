package me.marensovich.gta5rpformapp.backend.service.forms;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.service.BanListService;
import me.marensovich.gta5rpformapp.backend.service.GuildMembershipService;
import me.marensovich.gta5rpformapp.backend.service.UserService;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

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
 * </ul>
 * In either mode a logged-in user on the guild's ban list is refused
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
        BANNED
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
            // Cached for future role gating (#10); refreshed only once the TTL has lapsed.
            guildMembershipService.syncDiscordRolesIfStale(user.getDiscordId(), form.getServerId());
            return Access.GRANTED;
        }
        return form.getAccessMode() == FormAccessMode.OPEN ? Access.GRANTED : Access.NOT_IN_GUILD;
    }
}
