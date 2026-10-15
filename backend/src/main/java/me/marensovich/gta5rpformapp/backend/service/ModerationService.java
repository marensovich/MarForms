package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.submission.DecisionRequest;
import me.marensovich.gta5rpformapp.backend.dto.submission.MySubmissionCountsDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.MySubmissionDetailDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.MySubmissionDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionDetailDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionFileDto;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.files.FileService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The moderation module (E1.3): listing submissions with filters, the
 * moderation card, decisions, and a respondent's own submissions.
 * <p>
 * Authorization is enforced at the controllers through the shared guild
 * guard (#62). Per the Stage 1 role table, a moderator sees <i>every</i> form
 * of their guild — per-form moderator scopes are Stage 3 (E3.4).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class ModerationService {

    private final SubmissionRepository submissionRepository;
    private final FormRepository formRepository;
    private final UserRepository userRepository;
    private final GuildMembershipRepository guildMembershipRepository;
    private final GuildRepository guildRepository;
    private final DiscordBotClient discordBotClient;
    private final FileService fileService;
    private final AuditLogService auditLogService;

    /**
     * Filters for {@link #search}. Every field is optional.
     *
     * @param guildId restrict to this guild's forms
     * @param formId  restrict to one form
     * @param status  restrict to one moderation status
     * @param query   author search: an exact Discord ID if numeric, otherwise
     *                part of the username (case-insensitive)
     * @since v.0.1
     */
    public record Filters(@Nullable Long guildId, @Nullable UUID formId,
                          @Nullable SubmissionStatus status, @Nullable String query) {
    }

    /**
     * Paginated, filtered submission list (task #52), with authors' usernames
     * and form titles filled in.
     *
     * @param filters  the filters
     * @param pageable pagination and sorting
     * @return the matching submissions
     * @throws NotFoundException if {@code formId} isn't in {@code guildId}
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public Page<SubmissionDto> search(Filters filters, Pageable pageable) {
        Specification<Submission> spec = (root, q, cb) -> cb.conjunction();

        if (filters.guildId() != null) {
            if (filters.formId() != null) {
                Form form = formRepository.findById(filters.formId())
                        .filter(f -> filters.guildId().equals(f.getServerId()))
                        .orElseThrow(() -> new NotFoundException("Form not found: " + filters.formId()));
                spec = spec.and(formIs(form.getId()));
            } else {
                List<UUID> formIds = formRepository.findIdsByServerId(filters.guildId());
                if (formIds.isEmpty()) return Page.empty(pageable);
                spec = spec.and((root, q, cb) -> root.get("formId").in(formIds));
            }
        } else if (filters.formId() != null) {
            spec = spec.and(formIs(filters.formId()));
        }

        if (filters.status() != null) {
            SubmissionStatus status = filters.status();
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }

        String query = filters.query() == null ? "" : filters.query().trim();
        if (!query.isEmpty()) {
            if (query.matches("\\d+")) {
                long discordId = Long.parseLong(query);
                spec = spec.and((root, q, cb) -> cb.equal(root.get("discordId"), discordId));
            } else {
                Set<Long> ids = userRepository.findAllByDiscordUsernameContainingIgnoreCase(query).stream()
                        .map(User::getDiscordId).collect(Collectors.toSet());
                if (ids.isEmpty()) return Page.empty(pageable);
                spec = spec.and((root, q, cb) -> root.get("discordId").in(ids));
            }
        }

        Page<Submission> page = submissionRepository.findAll(spec, pageable);
        Map<Long, String> usernames = usernamesOf(page.getContent().stream().map(Submission::getDiscordId).toList());
        Map<UUID, String> titles = titlesOf(page.getContent().stream().map(Submission::getFormId).toList());
        return page.map(s -> SubmissionDto.from(s, usernames.get(s.getDiscordId()), titles.get(s.getFormId())));
    }

    private static Specification<Submission> formIs(UUID formId) {
        return (root, q, cb) -> cb.equal(root.get("formId"), formId);
    }

    /**
     * The moderation card for one submission (task #55).
     *
     * @param submissionId the submission's ID
     * @return the submission, its form schema and the author's guild profile
     * @throws NotFoundException if the submission doesn't exist
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public SubmissionDetailDto detail(UUID submissionId) {
        Submission submission = get(submissionId);
        Form form = formRepository.findById(submission.getFormId())
                .orElseThrow(() -> new NotFoundException("Form not found: " + submission.getFormId()));

        SubmissionDetailDto.Author author = null;
        if (submission.getDiscordId() != null) {
            Long discordId = submission.getDiscordId();
            User authorUser = userRepository.findByDiscordId(discordId).orElse(null);
            String username = authorUser != null ? authorUser.getDiscordUsername() : null;
            String avatarUrl = authorUser != null && authorUser.getDiscordAvatar() != null
                    ? "https://cdn.discordapp.com/avatars/" + discordId + "/" + authorUser.getDiscordAvatar() + ".png?size=128"
                    : null;
            var membership = guildMembershipRepository
                    .findByUser_DiscordIdAndGuild_DiscordGuildId(discordId, form.getServerId());
            List<Long> roleIds = membership.map(m -> m.getDiscordRoles()).orElse(null);
            List<DiscordBotClient.DiscordRole> roles = List.of();
            if (roleIds != null && !roleIds.isEmpty()) {
                Map<Long, DiscordBotClient.DiscordRole> known = discordBotClient.fetchRoles(form.getServerId());
                roles = roleIds.stream()
                        .map(id -> known.getOrDefault(id, new DiscordBotClient.DiscordRole(String.valueOf(id), null, 0)))
                        .toList();
            }
            author = new SubmissionDetailDto.Author(discordId, username, avatarUrl, roles,
                    membership.map(m -> m.getDiscordRolesSyncedAt()).orElse(null),
                    submissionRepository.countByFormIdAndDiscordId(form.getId(), discordId));
        }

        String username = author != null ? author.username() : null;
        return new SubmissionDetailDto(SubmissionDto.from(submission, username, form.getSchema().getTitle()),
                form.getId(), submission.questions(form), author,
                fileService.forSubmission(submission.getId()).stream().map(SubmissionFileDto::from).toList());
    }

    /**
     * Records a moderator's decision (task #53).
     * <p>
     * <b>Re-deciding is allowed</b>: a moderator can revise an earlier
     * decision (e.g. reverse a mistaken rejection, or approve after the
     * requested revision). Each decision overwrites status, comment,
     * moderator and time, and is audit-logged as old → new so the history
     * survives. Two moderators deciding at the same moment can't silently
     * overwrite each other: the entity is optimistically locked, and the
     * second write fails with 409.
     * </p>
     *
     * @param submissionId       the submission's ID
     * @param request            the decision
     * @param moderatorDiscordId the deciding moderator
     * @return the updated submission
     * @throws IllegalArgumentException if the target status is {@code PENDING}
     * @throws NotFoundException        if the submission doesn't exist
     * @since v.0.1
     */
    @Transactional
    public SubmissionDto decide(UUID submissionId, DecisionRequest request, Long moderatorDiscordId) {
        if (request.status() == SubmissionStatus.PENDING) {
            throw new IllegalArgumentException("A decision must be APPROVED, REJECTED or NEEDS_REVISION");
        }
        Submission submission = get(submissionId);
        SubmissionStatus old = submission.getStatus();
        if (request.expectedStatus() != null && request.expectedStatus() != old) {
            throw new InvalidStateException("Another moderator has already decided on this submission (" + old + ")");
        }

        String comment = request.comment() == null || request.comment().isBlank() ? null : request.comment().trim();
        submission.setStatus(request.status());
        submission.setModeratorComment(comment);
        submission.setModeratorDiscordId(moderatorDiscordId);
        submission.setDecidedAt(LocalDateTime.now());
        Submission saved = submissionRepository.saveAndFlush(submission);

        Form form = formRepository.findById(saved.getFormId()).orElse(null);
        String title = form != null ? form.getSchema().getTitle() : null;
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("formId", saved.getFormId().toString());
        metadata.put("from", old.name());
        metadata.put("to", saved.getStatus().name());
        if (comment != null) metadata.put("comment", comment);
        if (saved.getDiscordId() != null) metadata.put("authorDiscordId", saved.getDiscordId().toString());
        auditLogService.logGuildAction(form != null ? form.getServerId() : null, AuditAction.SUBMISSION_DECIDED,
                "SUBMISSION", saved.getId().toString(), title, metadata,
                "Status: " + old + " → " + saved.getStatus() + (comment != null ? "\nComment: " + comment : ""));

        String username = saved.getDiscordId() == null ? null
                : userRepository.findByDiscordId(saved.getDiscordId()).map(User::getDiscordUsername).orElse(null);
        return SubmissionDto.from(saved, username, title);
    }

    /**
     * A respondent's own submissions, newest first — how they learn the
     * outcome (task #54, platform-only variant).
     *
     * @param discordId the respondent
     * @param pageable  pagination
     * @return their submissions
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public Page<MySubmissionDto> mine(Long discordId, @Nullable MineFilter filter, Pageable pageable) {
        Page<Submission> page = filter == null
                ? submissionRepository.findAllByDiscordId(discordId, pageable)
                : submissionRepository.findAllByDiscordIdAndStatusIn(discordId, filter.statuses, pageable);
        List<Submission> rows = page.getContent();
        Map<UUID, Form> forms = formRepository.findAllById(rows.stream().map(Submission::getFormId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Form::getId, f -> f));
        Map<Long, Guild> guilds = guildRepository.findAllById(forms.values().stream().map(Form::getServerId)
                        .filter(Objects::nonNull).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Guild::getDiscordGuildId, g -> g));
        Map<Long, String> moderators = usernamesOf(rows.stream().map(Submission::getModeratorDiscordId).toList());
        return page.map(s -> mineRow(s, forms.get(s.getFormId()), guilds, moderators));
    }

    /**
     * Counters of the «Мои заявки» segments.
     *
     * @param discordId the respondent
     * @return all, pending and decided
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public MySubmissionCountsDto mineCounts(Long discordId) {
        long all = submissionRepository.countByDiscordId(discordId);
        long pending = submissionRepository.countByDiscordIdAndStatus(discordId, SubmissionStatus.PENDING);
        return new MySubmissionCountsDto(all, pending, all - pending);
    }

    /**
     * One of the respondent's own submissions with its answers (ТЗ ФТ-3.6.4).
     *
     * @param discordId    the respondent
     * @param submissionId the submission
     * @return the row, its questions as asked, answers and files
     * @throws NotFoundException if there is no such submission of theirs
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public MySubmissionDetailDto mineDetail(Long discordId, UUID submissionId) {
        Submission submission = submissionRepository.findById(submissionId)
                .filter(s -> discordId.equals(s.getDiscordId()))
                .orElseThrow(() -> new NotFoundException("Submission not found: " + submissionId));
        Form form = formRepository.findById(submission.getFormId()).orElse(null);
        Map<Long, Guild> guilds = form == null || form.getServerId() == null ? Map.of()
                : guildRepository.findById(form.getServerId()).map(g -> Map.of(g.getDiscordGuildId(), g)).orElse(Map.of());
        Map<Long, String> moderators = usernamesOf(Collections.singletonList(submission.getModeratorDiscordId()));
        return new MySubmissionDetailDto(mineRow(submission, form, guilds, moderators), submission.questions(form),
                submission.getAnswers() != null ? submission.getAnswers() : Map.of(),
                fileService.forSubmission(submission.getId()).stream().map(SubmissionFileDto::from).toList());
    }

    private static MySubmissionDto mineRow(Submission s, @Nullable Form form, Map<Long, Guild> guilds,
                                           Map<Long, String> moderators) {
        Guild guild = form != null && form.getServerId() != null ? guilds.get(form.getServerId()) : null;
        return MySubmissionDto.from(s, form, guild,
                s.getModeratorDiscordId() != null ? moderators.get(s.getModeratorDiscordId()) : null);
    }

    /** The «Мои заявки» segments besides «Все». */
    public enum MineFilter {
        PENDING(Set.of(SubmissionStatus.PENDING)),
        DECIDED(Set.of(SubmissionStatus.APPROVED, SubmissionStatus.REJECTED, SubmissionStatus.NEEDS_REVISION));

        private final Set<SubmissionStatus> statuses;

        MineFilter(Set<SubmissionStatus> statuses) {
            this.statuses = statuses;
        }
    }

    private Submission get(UUID id) {
        return submissionRepository.findById(id).orElseThrow(() -> new NotFoundException("Submission not found: " + id));
    }

    private Map<Long, String> usernamesOf(Collection<Long> discordIds) {
        Set<Long> ids = discordIds.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return userRepository.findAllByDiscordIdIn(ids).stream()
                .collect(Collectors.toMap(User::getDiscordId, User::getDiscordUsername, (a, b) -> a));
    }

    private Map<UUID, String> titlesOf(Collection<UUID> formIds) {
        Set<UUID> ids = Set.copyOf(formIds);
        if (ids.isEmpty()) return Map.of();
        return formRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Form::getId, f -> f.getSchema().getTitle(), (a, b) -> a, java.util.HashMap::new));
    }
}
