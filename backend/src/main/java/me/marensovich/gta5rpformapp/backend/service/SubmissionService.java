package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
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

import java.util.HashMap;
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
    private final UserRepository userRepository;
    private final FormService formService;
    private final WebhookService webhookService;
    private final AuditLogService auditLogService;
    private final OutboundJobService outboundJobService;

    /**
     * Submits a response to a form.
     * <p>
     * Validates that the form is active, saves the submission, and enqueues
     * webhook-notification jobs for it (one per configured webhook — see
     * {@code WebhookDeliveryProcessor}) in the same transaction as the save,
     * so a submission is never persisted without its notifications durably
     * queued. Delivery itself happens out-of-band; this method never makes a
     * Discord API call.
     * </p>
     *
     * @param formId    the UUID of the form being submitted
     * @param discordId the Discord ID of the user submitting the form
     * @param request   the {@link SubmitFormRequest} containing the form answers
     * @return the created {@link Submission} entity
     * @throws IllegalArgumentException if the form is not active
     * @since v.0.1
     */
    @Transactional
    public Submission submit(UUID formId, Long discordId, SubmitFormRequest request) {
        Form form = formService.getById(formId);
        if (!form.isAcceptingSubmissions()) {
            throw new IllegalArgumentException("This form is not accepting submissions");
        }
        Submission submission = new Submission();
        submission.setFormId(formId);
        submission.setDiscordId(discordId);
        submission.setAnswers(request.answers());
        Submission saved = submissionRepository.save(submission);

        String discordUsername = userRepository.findByDiscordId(discordId)
                .map(me.marensovich.gta5rpformapp.backend.database.entity.User::getDiscordUsername)
                .orElse(null);

        enqueueWebhookDeliveries(form, saved, discordUsername, discordId);

        auditLogService.log(AuditAction.SUBMISSION_CREATED,
                discordId, discordUsername,
                saved.getId().toString(), form.getSchema().getTitle(),
                "Form: " + form.getSchema().getTitle() + " (" + formId + ")\nSubmission ID: " + saved.getId());

        return saved;
    }

    private void enqueueWebhookDeliveries(Form form, Submission submission, String discordUsername, Long discordId) {
        if (form.getWebhooks() == null) return;
        for (WebhookConfig webhook : form.getWebhooks()) {
            if (webhook.getUrl() == null || webhook.getUrl().isBlank()) continue;
            if (Boolean.TRUE.equals(webhook.getInvalid())) continue;

            var payload = new WebhookDeliveryPayload(
                    form.getId(), submission.getId(), webhook.getUrl(),
                    submission.getAnswers(), discordUsername, discordId);
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
            ids.put(webhookUrl, messageId);
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
        submissionRepository.delete(submission);
        auditLogService.logByCurrentUser(AuditAction.SUBMISSION_DELETED,
                id.toString(), "Submission by discordId=" + submission.getDiscordId(), null);
    }
}