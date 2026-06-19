package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.form.CreateFormRequest;
import me.marensovich.gta5rpformapp.backend.dto.form.FormResponseDto;
import me.marensovich.gta5rpformapp.backend.dto.form.FormSummaryDto;
import me.marensovich.gta5rpformapp.backend.dto.form.UpdateFormRequest;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller for managing forms.
 * <p>
 * Provides endpoints for retrieving, creating, updating, and deleting forms.
 * Public endpoint for form rendering is available without authentication,
 * while administrative operations require specific authorities.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/forms")
@RequiredArgsConstructor
public class FormController {

    private final FormService formService;

    /**
     * Retrieves a form by its ID for rendering on the form-filling page.
     * <p>
     * This is a public endpoint that returns the form schema without performing
     * access or guild membership checks. Access control is delegated to the
     * client-side and validated at submission time.
     * </p>
     *
     * @param formId the UUID of the form to retrieve
     * @return a {@link FormResponseDto} containing the form data and schema
     * @since v.0.1
     */
    @GetMapping("/{formId}")
    public FormResponseDto get(@PathVariable UUID formId) {
        return FormResponseDto.from(formService.getById(formId));
    }

    /**
     * Retrieves a paginated list of all forms for the admin dashboard.
     * <p>
     * Requires the {@code FORM_READ} authority.
     * </p>
     *
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link FormSummaryDto} containing form summaries
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORM_READ')")
    @GetMapping
    public Page<FormSummaryDto> list(Pageable pageable) {
        return formService.listForDashboard(pageable);
    }

    /**
     * Creates a new form.
     * <p>
     * Requires the {@code FORM_CREATE} authority.
     * </p>
     *
     * @param request the {@link CreateFormRequest} containing form details
     * @return a {@link ResponseEntity} with status 201 (Created) containing the created form
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORM_CREATE')")
    @PostMapping
    public ResponseEntity<FormResponseDto> create(@Valid @RequestBody CreateFormRequest request) {
        var form = formService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(FormResponseDto.from(form));
    }

    /**
     * Updates an existing form.
     * <p>
     * Requires the {@code FORM_UPDATE} authority.
     * </p>
     *
     * @param formId  the UUID of the form to update
     * @param request the {@link UpdateFormRequest} containing updated form details
     * @return a {@link FormResponseDto} containing the updated form
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORM_UPDATE')")
    @PutMapping("/{formId}")
    public FormResponseDto update(@PathVariable UUID formId, @Valid @RequestBody UpdateFormRequest request) {
        return FormResponseDto.from(formService.update(formId, request));
    }

    /**
     * Deletes a form by its ID.
     * <p>
     * Requires the {@code FORM_DELETE} authority.
     * </p>
     *
     * @param formId the UUID of the form to delete
     * @return a {@link ResponseEntity} with status 204 (No Content)
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORM_DELETE')")
    @DeleteMapping("/{formId}")
    public ResponseEntity<Void> delete(@PathVariable UUID formId) {
        formService.delete(formId);
        return ResponseEntity.noContent().build();
    }
}