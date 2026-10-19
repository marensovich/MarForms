package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.search.SearchResultsDto;
import me.marensovich.gta5rpformapp.backend.dto.search.SearchResultsDto.FormHit;
import me.marensovich.gta5rpformapp.backend.dto.search.SearchResultsDto.SubmissionHit;
import me.marensovich.gta5rpformapp.backend.dto.search.SearchResultsDto.UserHit;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The ⌘K command-palette search (ТЗ ФТ-4.1.3, #107).
 * <p>
 * Every hit is something the caller could open anyway: forms and submissions of
 * servers where they are owner or moderator (staff rights re-confirmed with
 * Discord, as for the workspace itself), or of every server with the platform
 * FORMS_MANAGE / RESPONSES_MANAGE permission; users only with USERS_MODERATE.
 * Anonymous submissions have no author and are never found by one.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class SearchService {

    /** Hits per type. */
    public static final int LIMIT = 5;
    /** Shorter queries return nothing: too broad to be useful. */
    public static final int MIN_QUERY = 2;
    private static final int MAX_QUERY = 100;
    /** Authors considered when searching submissions by nick. */
    private static final int AUTHOR_CANDIDATES = 50;
    /** JPQL "in" can't take an empty list; no guild has this ID. */
    private static final List<Long> NO_GUILDS = List.of(-1L);

    private final FormRepository formRepository;
    private final SubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final GuildRepository guildRepository;
    private final GuildMembershipRepository guildMembershipRepository;
    private final GuildMembershipService guildMembershipService;

    /**
     * Searches forms, submissions and users for the caller.
     *
     * @param caller      the signed-in user
     * @param permissions the caller's platform permissions
     * @param query       the typed text
     * @return up to {@link #LIMIT} hits per type
     */
    @Transactional
    public SearchResultsDto search(User caller, Set<Permission> permissions, String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() > MAX_QUERY) q = q.substring(0, MAX_QUERY);
        if (q.length() < MIN_QUERY) return new SearchResultsDto(List.of(), List.of(), List.of());

        boolean platform = permissions.contains(Permission.DASHBOARD_ACCESS);
        boolean allForms = platform && permissions.contains(Permission.FORMS_MANAGE);
        boolean allSubmissions = platform && permissions.contains(Permission.RESPONSES_MANAGE);
        boolean users = platform && permissions.contains(Permission.USERS_MODERATE);

        Set<Long> staffGuilds = staffGuilds(caller);
        Collection<Long> scope = staffGuilds.isEmpty() ? NO_GUILDS : staffGuilds;
        Pageable limit = PageRequest.of(0, LIMIT);
        String pattern = "%" + escapeLike(q.toLowerCase()) + "%";

        // A moderator the owner narrowed to some forms finds only those (#18).
        Map<Long, Set<UUID>> narrowed = narrowedForms(caller);
        List<Form> forms = allForms || !staffGuilds.isEmpty()
                ? formRepository.search(allForms, scope, pattern, limit) : List.of();
        if (!allForms) forms = forms.stream().filter(f -> reaches(narrowed, f)).toList();

        List<Submission> submissions = List.of();
        Map<Long, User> authors = Map.of();
        if (allSubmissions || !staffGuilds.isEmpty()) {
            authors = matchingUsers(q, AUTHOR_CANDIDATES);
            if (!authors.isEmpty()) {
                submissions = submissionRepository.searchByAuthors(authors.keySet(), allSubmissions, scope, limit);
            }
        }

        Map<UUID, Form> submissionForms = formRepository.findAllById(
                        submissions.stream().map(Submission::getFormId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Form::getId, Function.identity()));
        if (!allSubmissions) {
            submissions = submissions.stream()
                    .filter(s -> submissionForms.containsKey(s.getFormId()) && reaches(narrowed, submissionForms.get(s.getFormId())))
                    .toList();
        }
        Set<Long> guildIds = new LinkedHashSet<>();
        forms.forEach(f -> guildIds.add(f.getServerId()));
        submissionForms.values().forEach(f -> guildIds.add(f.getServerId()));
        guildIds.remove(null);
        Map<Long, String> guildNames = guildRepository.findAllById(guildIds).stream()
                .collect(Collectors.toMap(Guild::getDiscordGuildId, Guild::getName));

        List<FormHit> formHits = forms.stream()
                .map(f -> new FormHit(f.getId(), f.getTitle(), f.getSlug(), f.getStatus(), id(f.getServerId()),
                        guildNames.get(f.getServerId()), staffGuilds.contains(f.getServerId())))
                .toList();

        Map<Long, User> authorMap = authors;
        List<SubmissionHit> submissionHits = submissions.stream()
                .map(s -> {
                    Form form = submissionForms.get(s.getFormId());
                    Long guildId = form != null ? form.getServerId() : null;
                    User author = authorMap.get(s.getDiscordId());
                    return new SubmissionHit(s.getId(), s.getFormId(), form != null ? form.getTitle() : null,
                            id(guildId), guildNames.get(guildId), id(s.getDiscordId()),
                            author != null ? author.getDiscordUsername() : null, s.getStatus(), s.getCreatedAt(),
                            guildId != null && staffGuilds.contains(guildId));
                })
                .toList();

        List<UserHit> userHits = users
                ? matchingUsers(q, LIMIT).values().stream()
                .map(u -> new UserHit(id(u.getDiscordId()), u.getDiscordUsername(), avatarUrl(u)))
                .toList()
                : List.of();

        return new SearchResultsDto(formHits, submissionHits, userHits);
    }

    /** Servers where the caller is owner or moderator, re-confirmed with Discord when stale. */
    private Set<Long> staffGuilds(User caller) {
        return guildMembershipRepository.findAllByUser_Id(caller.getId()).stream()
                .filter(m -> m.getRole() == GuildRole.OWNER || m.getRole() == GuildRole.MODERATOR)
                .map(guildMembershipService::verifyStaffIfStale)
                .filter(m -> m.getRole() == GuildRole.OWNER || m.getRole() == GuildRole.MODERATOR)
                .map(m -> m.getGuild().getDiscordGuildId())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    /** The forms of each server where the caller is a moderator narrowed by the owner (#18). */
    private Map<Long, Set<UUID>> narrowedForms(User caller) {
        Map<Long, Set<UUID>> narrowed = new HashMap<>();
        for (GuildMembership m : guildMembershipRepository.findAllByUser_Id(caller.getId())) {
            if (m.getRole() == GuildRole.MODERATOR && m.isFormsRestricted()) {
                narrowed.put(m.getGuild().getDiscordGuildId(), guildMembershipRepository.findFormIds(m.getId()));
            }
        }
        return narrowed;
    }

    private static boolean reaches(Map<Long, Set<UUID>> narrowed, Form form) {
        Set<UUID> forms = narrowed.get(form.getServerId());
        return forms == null || forms.contains(form.getId());
    }

    /** Users by exact Discord ID (all digits) or by part of the nick, keyed by Discord ID. */
    private Map<Long, User> matchingUsers(String q, int limit) {
        Map<Long, User> found = new LinkedHashMap<>();
        if (q.chars().allMatch(Character::isDigit) && q.length() <= 20) {
            try {
                userRepository.findByDiscordId(Long.parseUnsignedLong(q)).ifPresent(u -> found.put(u.getDiscordId(), u));
            } catch (NumberFormatException ignored) {
                // Longer than a snowflake: nick search only.
            }
        }
        userRepository.findByDiscordUsernameContainingIgnoreCase(q, PageRequest.of(0, limit))
                .forEach(u -> found.putIfAbsent(u.getDiscordId(), u));
        return found;
    }

    private static String avatarUrl(User user) {
        return user.getDiscordAvatar() == null ? null
                : "https://cdn.discordapp.com/avatars/" + user.getDiscordId() + "/" + user.getDiscordAvatar() + ".png?size=64";
    }

    /** Snowflakes go to the client as strings (JavaScript numbers lose precision). */
    private static String id(Long value) {
        return value == null ? null : Long.toUnsignedString(value);
    }

    /** Typed % and _ are matched literally ("!" is the LIKE escape character of the queries). */
    static String escapeLike(String text) {
        return text.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }
}
