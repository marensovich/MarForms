package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmitFormRequest;
import me.marensovich.gta5rpformapp.backend.dto.submission.UserSubmissionCountDto;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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

    /**
     * Submits a response to a form.
     * <p>
     * Validates that the form is active, saves the submission, and triggers
     * webhook notifications for the submission.
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
        if (!form.isActive()) {
            throw new IllegalArgumentException("This form is no longer accepting submissions");
        }
        Submission submission = new Submission();
        submission.setFormId(formId);
        submission.setDiscordId(discordId);
        submission.setAnswers(request.answers());
        Submission saved = submissionRepository.save(submission);

        String discordUsername = userRepository.findByDiscordId(discordId)
                .map(me.marensovich.gta5rpformapp.backend.database.entity.User::getDiscordUsername)
                .orElse(null);
        webhookService.sendSubmissionNotifications(form, request.answers(), discordUsername);

        return saved;
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
     *
     * @param id the UUID of the submission to delete
     * @throws NotFoundException if the submission does not exist
     * @since v.0.1
     */
    @Transactional
    public void delete(UUID id) {
        if (!submissionRepository.existsById(id)) {
            throw new NotFoundException("Submission not found: " + id);
        }
        submissionRepository.deleteById(id);
    }
}