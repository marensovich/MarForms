package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.exception.FormAccessDeniedException;
import me.marensovich.gta5rpformapp.backend.exception.LoginRequiredException;
import me.marensovich.gta5rpformapp.backend.database.entity.SubmissionFile;
import me.marensovich.gta5rpformapp.backend.service.discord.WebhookUrlCipher;
import me.marensovich.gta5rpformapp.backend.service.files.FileService;
import me.marensovich.gta5rpformapp.backend.service.forms.FormAccessService;
import me.marensovich.gta5rpformapp.backend.service.forms.SubmissionAnswerValidator;
import org.springframework.lang.Nullable;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmitFormRequest;
import me.marensovich.gta5rpformapp.backend.dto.submission.UserSubmissionCountDto;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.jobs.OutboundJobService;
import me.marensovich.gta5rpformapp.backend.service.jobs.WebhookDeliveryPayload;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing form submissions.
 * <p>
 * Provides business logic for submitting responses to forms, retrieving
 * submissions with various filters, and managing submission data.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final me.marensovich.gta5rpformapp.backend.database.repository.FormRepository formRepository;
    private final UserRepository userRepository;
    private final FormService formService;
    private final WebhookService webhookService;
    private final AuditLogService auditLogService;
    private final OutboundJobService outboundJobService;
    private final FormAccessService formAccessService;
    private final FileService fileService;
    private final WebhookUrlCipher webhookUrlCipher;

    /**
     * Submits a response to a form, by form ID and submitter Discord ID —
     * a convenience wrapper over {@link #submit(Form, User, Map, String)}
     * (no idempotency key), which documents every check applied.
     *
     * @param formId    the UUID of the form being submitted
     * @param discordId the Discord ID of the user submitting the form, may be {@code null}
     * @param request   the {@link SubmitFormRequest} containing the form answers
     * @return the created {@link Submission} entity
     * @since v.0.1
     */
    @Transactional
    public Submission submit(UUID formId, Long discordId, SubmitFormRequest request) {
        Form form = formService.getById(formId);
        User user = discordId == null ? null : userRepository.findByDiscordId(discordId).orElse(null);
        return submit(form, user, request.answers(), null, null).submission();
    }

    /**
     * Result of {@link #submit(Form, User, Map, String)}.
     *
     * @param submission the stored submission
     * @param created    {@code false} if this was a replay of an earlier
     *                   request with the same idempotency key
     * @since v.0.1
     */
    public record SubmitResult(Submission submission, boolean created) {
    }

    /**
     * The single submission intake path (task #49), used by both the public
     * slug endpoint and the legacy one. In order:
     * <ol>
     *     <li><b>Idempotency</b> — a known {@code idempotencyKey} returns the
     *     submission it created, without creating another (product spec раздел 8).</li>
     *     <li><b>Form state</b> — published and inside its opening window,
     *     otherwise a readable 409 ({@link InvalidStateException}).</li>
     *     <li><b>Access</b> — {@link FormAccessService}: 401 if login is
     *     required, 403 if not a member of the form's guild or on its ban list.</li>
     *     <li><b>Per-user limit</b> — {@code submissionLimitPerUser}, counted
     *     per Discord account (can't apply to logged-out OPEN respondents), or
     *     per browser on an ANONYMOUS form, via {@code anonymousToken}.</li>
     *     <li><b>Answers</b> — {@link SubmissionAnswerValidator}: 400 with an
     *     error per field; only the cleaned answers are stored.</li>
     * </ol>
     * Then the submission is saved and its webhook deliveries are enqueued in
     * the same transaction, so a submission is never persisted without its
     * notifications durably queued. Delivery itself happens out-of-band; this
     * method never makes a Discord API call.
     *
     * @param form           the form being submitted
     * @param user           the respondent, or {@code null} if not logged in
     * @param answers        raw answers keyed by field id
     * @param idempotencyKey client-generated key, may be {@code null}
     * @param anonymousToken the browser's random token, used only on ANONYMOUS
     *                       forms (required there if the form has a per-user limit)
     * @return the stored submission, and whether it was created by this call
     * @since v.0.1
     */
    @Transactional
    public SubmitResult submit(Form form, @Nullable User user, Map<String, Object> answers,
                               @Nullable String idempotencyKey, @Nullable String anonymousToken) {
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? null : idempotencyKey.trim();
        if (key != null) {
            var existing = submissionRepository.findByIdempotencyKey(key);
            if (existing.isPresent()) {
                if (!existing.get().getFormId().equals(form.getId())) {
                    throw new InvalidStateException("This idempotency key was already used for another form");
                }
                return new SubmitResult(existing.get(), false);
            }
        }

        String notAccepting = notAcceptingReason(form);
        if (notAccepting != null) throw new InvalidStateException(notAccepting);

        switch (formAccessService.check(form, user)) {
            case LOGIN_REQUIRED -> throw new LoginRequiredException("Log in with Discord to fill in this form");
            case NOT_IN_GUILD -> throw new FormAccessDeniedException("You must be a member of this server to fill in this form");
            case BANNED -> throw new FormAccessDeniedException("You are banned from submitting forms on this server");
            case GRANTED -> {
            }
        }

        // Anonymous forms never record who submitted, even if they are logged in.
        boolean anonymous = form.getAccessMode() == FormAccessMode.ANONYMOUS;
        User author = anonymous ? null : user;
        Long discordId = author != null ? author.getDiscordId() : null;
        String tokenHash = anonymous ? hashAnonymousToken(form, anonymousToken) : null;
        if (anonymous && tokenHash == null && form.getSubmissionLimitPerUser() != null) {
            throw new IllegalArgumentException("Missing or invalid Anonymous-Token header");
        }
        // Two concurrent submissions (two tabs, a script) must not both pass the
        // count below: with a limit, they queue on the form's row (#103).
        if (form.getSubmissionLimitPerUser() != null && (discordId != null || tokenHash != null)) {
            formRepository.lockById(form.getId());
        }
        long previous = discordId != null ? submissionRepository.countByFormIdAndDiscordId(form.getId(), discordId)
                : tokenHash != null ? submissionRepository.countByFormIdAndAnonymousToken(form.getId(), tokenHash)
                : 0;
        if (form.getSubmissionLimitPerUser() != null && (discordId != null || tokenHash != null)
                && previous >= form.getSubmissionLimitPerUser()) {
            throw new InvalidStateException(form.getSubmissionLimitPerUser() == 1
                    ? "You have already submitted this form"
                    : "You have reached the limit of " + form.getSubmissionLimitPerUser() + " submissions for this form");
        }

        Map<String, Object> clean = SubmissionAnswerValidator.validate(form.getSchema(), answers);
        List<SubmissionFile> files = fileService.resolveAnswerFiles(form, clean);

        Submission submission = new Submission();
        submission.setFormId(form.getId());
        submission.setDiscordId(discordId);
        submission.setAnswers(clean);
        submission.setIdempotencyKey(key);
        submission.setAnonymousToken(tokenHash);
        Submission saved = submissionRepository.save(submission);
        fileService.attach(files, saved.getId());

        String discordUsername = author != null ? author.getDiscordUsername() : null;
        enqueueWebhookDeliveries(form, saved, withFileNames(clean, files), discordUsername, discordId);

        auditLogService.log(AuditAction.SUBMISSION_CREATED,
                discordId, discordUsername,
                saved.getId().toString(), form.getSchema().getTitle(),
                "Form: " + form.getSchema().getTitle() + " (" + form.getId() + ")\nSubmission ID: " + saved.getId());

        return new SubmitResult(saved, true);
    }

    /**
     * Why a form doesn't accept submissions right now, in words a respondent
     * understands — or {@code null} if it does.
     *
     * @param form the form
     * @return the reason, or {@code null} if submissions are accepted
     * @since v.0.1
     */
    public static @Nullable String notAcceptingReason(Form form) {
        if (form.isAcceptingSubmissions()) return null;
        LocalDateTime now = LocalDateTime.now();
        if (form.getStatus() == FormStatus.PUBLISHED && form.getOpensAt() != null && now.isBefore(form.getOpensAt())) {
            return "This form opens on " + form.getOpensAt().format(DISPLAY_TIME);
        }
        if (form.getStatus() == FormStatus.PUBLISHED && form.getClosesAt() != null && now.isAfter(form.getClosesAt())) {
            return "This form closed on " + form.getClosesAt().format(DISPLAY_TIME);
        }
        return "This form is closed and no longer accepts submissions";
    }

    /**
     * SHA-256 of the form ID and the browser's token, hex, or {@code null}
     * if no usable token was sent. Salting with the form ID keeps one
     * browser's submissions to different forms unlinkable.
     */
    private static @Nullable String hashAnonymousToken(Form form, @Nullable String token) {
        if (token == null) return null;
        String t = token.trim();
        if (t.length() < 16 || t.length() > 128) return null;
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
                    .digest((form.getId() + ":" + t).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static final DateTimeFormatter DISPLAY_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /** Answers for notifications: a file answer shows the file's name, not its ID. */
    private static Map<String, Object> withFileNames(Map<String, Object> answers, List<SubmissionFile> files) {
        if (files.isEmpty()) return answers;
        Map<String, Object> display = new LinkedHashMap<>(answers);
        for (SubmissionFile file : files) {
            display.put(file.getFieldId(), "📎 " + file.getOriginalName());
        }
        return display;
    }

    private void enqueueWebhookDeliveries(Form form, Submission submission, Map<String, Object> answers,
                                          String discordUsername, Long discordId) {
        if (form.getWebhooks() == null) return;
        for (WebhookConfig webhook : form.getWebhooks()) {
            if (webhook.getUrl() == null || webhook.getUrl().isBlank()) continue;
            if (Boolean.TRUE.equals(webhook.getInvalid())) continue;

            var payload = new WebhookDeliveryPayload(
                    form.getId(), submission.getId(), webhookUrlCipher.seal(webhook.getUrl()),
                    answers, discordUsername, discordId);
            outboundJobService.enqueue(OutboundJobService.JOB_TYPE_WEBHOOK_DELIVERY, payload);
        }
    }

    /**
     * Records the Discord message ID a queued webhook delivery produced, so
     * it can be deleted later if the submission is deleted (see {@link #delete}).
     * <p>
     * Called by {@code WebhookDeliveryProcessor} after a successful delivery —
     * merges into whatever's already recorded, since each webhook on a form
     * delivers (and thus calls this) independently.
     * </p>
     *
     * @param submissionId the submission the message belongs to
     * @param webhookUrl   the webhook that delivered it
     * @param messageId    the Discord message ID
     * @since v.0.1
     */
    @Transactional
    public void recordWebhookMessageId(UUID submissionId, String webhookUrl, String messageId) {
        submissionRepository.findById(submissionId).ifPresent(submission -> {
            Map<String, String> ids = submission.getWebhookMessageIds() != null
                    ? new HashMap<>(submission.getWebhookMessageIds())
                    : new HashMap<>();
            ids.put(webhookUrlCipher.seal(webhookUrl), messageId);
            submission.setWebhookMessageIds(ids);
            submissionRepository.save(submission);
        });
    }

    /**
     * Retrieves a paginated list of submissions for a specific form.
     * <p>
     * Validates that the form exists before retrieving submissions.
     * </p>
     *
     * @param formId   the UUID of the form to retrieve submissions for
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link Submission} entities for the specified form
     * @throws NotFoundException if the form does not exist
     * @since v.0.1
     */
    public Page<Submission> listByForm(UUID formId, Pageable pageable) {
        formService.getById(formId);
        return submissionRepository.findAllByFormId(formId, pageable);
    }

    /**
     * Lists submissions filtered by optional form ID and freetext search.
     * <p>
     * Supports intelligent search behavior:
     * <ul>
     *     <li><b>Numeric search</b> — if the search string consists only of digits,
     *     it's treated as an exact Discord ID match</li>
     *     <li><b>Text search</b> — otherwise, it's matched against {@code discordUsername}
     *     (case-insensitive, partial match)</li>
     * </ul>
     * If no search string is provided, all submissions are returned (optionally filtered by form ID).
     * </p>
     *
     * @param formId   optional UUID to filter submissions by form
     * @param search   optional search string (numeric for Discord ID, text for username)
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link Submission} entities matching the filters
     * @since v.0.1
     */
    public Page<Submission> listAll(UUID formId, String search, Pageable pageable) {
        if (search == null || search.isBlank()) {
            return formId != null
                    ? submissionRepository.findAllByFormId(formId, pageable)
                    : submissionRepository.findAll(pageable);
        }

        if (search.matches("\\d+")) {
            Long discordId = Long.parseLong(search);
            return formId != null
                    ? submissionRepository.findAllByFormIdAndDiscordId(formId, discordId, pageable)
                    : submissionRepository.findAllByDiscordId(discordId, pageable);
        }

        Set<Long> discordIds = userRepository
                .findAllByDiscordUsernameContainingIgnoreCase(search)
                .stream()
                .map(u -> u.getDiscordId())
                .collect(Collectors.toSet());

        if (discordIds.isEmpty()) {
            return Page.empty(pageable);
        }

        return formId != null
                ? submissionRepository.findAllByFormIdAndDiscordIdIn(formId, discordIds, pageable)
                : submissionRepository.findAllByDiscordIdIn(discordIds, pageable);
    }

    /**
     * Retrieves a list of submission counts grouped by user.
     * <p>
     * Returns the total number of submissions each user has made across all forms,
     * ordered by count descending (highest first).
     * </p>
     *
     * @return a {@link List} of {@link UserSubmissionCountDto} containing user submission statistics
     * @since v.0.1
     */
    public List<UserSubmissionCountDto> listByUser() {
        return submissionRepository.findUserSubmissionCounts();
    }

    /**
     * Deletes a submission by its ID.
     * <p>
     * Also deletes the corresponding Discord messages that were posted via webhooks
     * when this submission was created.
     * </p>
     *
     * @param id the UUID of the submission to delete
     * @throws NotFoundException if the submission does not exist
     * @since v.0.1
     */
    @Transactional
    public void delete(UUID id) {
        Submission submission = submissionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Submission not found: " + id));
        webhookService.deleteMessages(submission.getWebhookMessageIds());
        fileService.deleteForSubmission(id);
        submissionRepository.delete(submission);
        auditLogService.logByCurrentUser(AuditAction.SUBMISSION_DELETED,
                id.toString(), "Submission by discordId=" + submission.getDiscordId(), null);
    }
}