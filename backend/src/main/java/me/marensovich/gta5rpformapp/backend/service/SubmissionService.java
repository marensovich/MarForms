package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmitFormRequest;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Service for managing form submissions.
 * <p>
 * Provides business logic for submitting responses to forms and
 * retrieving submissions for administrative review.
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
    private final FormService formService;

    /**
     * Submits a response to a form.
     * <p>
     * Validates that the form is active before allowing submission.
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

        return submissionRepository.save(submission);
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
}