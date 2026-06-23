package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.dto.form.CreateFormRequest;
import me.marensovich.gta5rpformapp.backend.dto.form.FormSummaryDto;
import me.marensovich.gta5rpformapp.backend.dto.form.UpdateFormRequest;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Service for managing forms.
 * <p>
 * Provides business logic for creating, retrieving, updating, and deleting forms,
 * as well as listing forms with submission statistics.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class FormService {

    private final FormRepository formRepository;
    private final SubmissionRepository submissionRepository;

    /**
     * Retrieves a form by its ID.
     *
     * @param formId the UUID of the form to retrieve
     * @return the {@link Form} entity
     * @throws NotFoundException if the form does not exist
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public Form getById(UUID formId) {
        return formRepository.findById(formId)
                .orElseThrow(() -> new NotFoundException("Form not found: " + formId));
    }

    /**
     * Creates a new form.
     *
     * @param request the {@link CreateFormRequest} containing form details
     * @return the created {@link Form} entity
     * @since v.0.1
     */
    @Transactional
    public Form create(CreateFormRequest request) {
        Form form = new Form();
        form.setServerId(Long.parseUnsignedLong(request.serverId()));
        if (request.channelsIds() != null) {
            form.setChannelsIds(
                request.channelsIds().stream()
                    .map(Long::parseUnsignedLong)
                    .collect(java.util.stream.Collectors.toSet())
            );
        }
        form.setSchema(request.schema());
        return formRepository.save(form);
    }

    /**
     * Updates an existing form.
     * <p>
     * Only fields that are not {@code null} in the request will be updated.
     * </p>
     *
     * @param formId  the UUID of the form to update
     * @param request the {@link UpdateFormRequest} containing updated fields
     * @return the updated {@link Form} entity
     * @throws NotFoundException if the form does not exist
     * @since v.0.1
     */
    @Transactional
    public Form update(UUID formId, UpdateFormRequest request) {
        Form form = getById(formId);

        if (request.channelsIds() != null) {
            form.setChannelsIds(
                request.channelsIds().stream()
                    .map(Long::parseUnsignedLong)
                    .collect(java.util.stream.Collectors.toSet())
            );
        }
        if (request.schema() != null) {
            form.setSchema(request.schema());
        }
        if (request.active() != null) {
            form.setActive(request.active());
        }

        return formRepository.save(form);
    }

    /**
     * Deletes a form by its ID.
     *
     * @param formId the UUID of the form to delete
     * @throws NotFoundException if the form does not exist
     * @since v.0.1
     */
    @Transactional
    public void delete(UUID formId) {
        if (!formRepository.existsById(formId)) {
            throw new NotFoundException("Form not found: " + formId);
        }
        formRepository.deleteById(formId);
    }

    /**
     * Retrieves a paginated list of all forms for the dashboard.
     * <p>
     * Each form entry includes the total number of submissions for that form.
     * </p>
     *
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link FormSummaryDto} containing form summaries with submission counts
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public Page<FormSummaryDto> listForDashboard(Pageable pageable) {
        return formRepository.findAll(pageable)
                .map(form -> FormSummaryDto.from(form, submissionRepository.countByFormId(form.getId())));
    }
}