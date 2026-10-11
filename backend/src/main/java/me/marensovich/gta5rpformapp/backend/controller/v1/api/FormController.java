package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.form.CreateFormRequest;
import me.marensovich.gta5rpformapp.backend.dto.form.FormResponseDto;
import me.marensovich.gta5rpformapp.backend.dto.form.FormSummaryDto;
import me.marensovich.gta5rpformapp.backend.dto.form.UpdateFormRequest;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.config.security.GuildAccessGuard;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.dto.form.PublicFormDto;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import me.marensovich.gta5rpformapp.backend.service.forms.FormAccessService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    private final GuildAccessGuard guildAccessGuard;
    private final FormAccessService formAccessService;

    /**
     * Retrieves a form by its ID.
     * <p>
     * Managers of the form (platform admins with {@code FORMS_MANAGE}, or a
     * moderator/owner of its guild) get the full {@link FormResponseDto},
     * webhooks included, for the editor. Everyone else gets only the
     * {@link PublicFormDto} — the webhook URLs embed secret tokens and must
     * never reach respondents. Drafts are 404 for non-managers.
     * </p>
     *
     * @param formId         the UUID of the form to retrieve
     * @param authentication the caller
     * @param principal      the logged-in user, for the public view's access check
     * @return the full or the public view of the form
     * @since v.0.1
     */
    @GetMapping("/{formId}")
    public Object get(@PathVariable UUID formId, Authentication authentication,
                      @AuthenticationPrincipal CustomUserDetails principal) {
        Form form = formService.getById(formId);
        boolean platformManager = authentication != null
                && authentication.getAuthorities().stream().anyMatch(a -> "FORMS_MANAGE".equals(a.getAuthority()));
        boolean manager = authentication != null && (platformManager || guildAccessGuard.hasRoleForForm(formId, "MODERATOR"));
        if (manager) {
            // Only those who may edit the form see webhook tokens (#103).
            FormResponseDto full = FormResponseDto.from(form);
            return platformManager || guildAccessGuard.hasRoleForForm(formId, "OWNER") ? full : full.withMaskedWebhooks();
        }
        if (form.getStatus() == FormStatus.DRAFT) throw new NotFoundException("Form not found: " + formId);
        return PublicFormDto.from(form, SubmissionService.notAcceptingReason(form), null,
                formAccessService.check(form, principal != null ? principal.getUser() : null));
    }

    /**
     * Retrieves a paginated list of all forms for the admin dashboard.
     * <p>
     * Requires the {@code FORMS_VIEW} authority.
     * </p>
     *
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link FormSummaryDto} containing form summaries
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORMS_MANAGE')")
    @GetMapping
    public Page<FormSummaryDto> list(Pageable pageable) {
        return formService.listForDashboard(pageable);
    }

    /**
     * Creates a new form.
     * <p>
     * Requires the {@code FORMS_MANAGE} authority.
     * </p>
     *
     * @param request the {@link CreateFormRequest} containing form details
     * @return a {@link ResponseEntity} with status 201 (Created) containing the created form
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRole(#request.serverId(), 'OWNER')")
    @PostMapping
    public ResponseEntity<FormResponseDto> create(@Valid @RequestBody CreateFormRequest request) {
        var form = formService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(FormResponseDto.from(form));
    }

    /**
     * Updates an existing form.
     * <p>
     * Requires the {@code FORMS_MANAGE} authority.
     * </p>
     *
     * @param formId  the UUID of the form to update
     * @param request the {@link UpdateFormRequest} containing updated form details
     * @return a {@link FormResponseDto} containing the updated form
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRoleForForm(#formId, 'OWNER')")
    @PutMapping("/{formId}")
    public FormResponseDto update(@PathVariable UUID formId, @Valid @RequestBody UpdateFormRequest request) {
        return FormResponseDto.from(formService.update(formId, request));
    }

    /**
     * Deletes a form by its ID.
     * <p>
     * Requires the {@code FORMS_MANAGE} authority.
     * </p>
     *
     * @param formId the UUID of the form to delete
     * @return a {@link ResponseEntity} with status 204 (No Content)
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRoleForForm(#formId, 'OWNER')")
    @DeleteMapping("/{formId}")
    public ResponseEntity<Void> delete(@PathVariable UUID formId) {
        formService.delete(formId);
        return ResponseEntity.noContent().build();
    }
}