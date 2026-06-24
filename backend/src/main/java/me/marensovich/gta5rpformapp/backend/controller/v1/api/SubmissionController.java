package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmitFormRequest;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller for managing form submissions.
 * <p>
 * Provides endpoints for submitting responses to forms and retrieving
 * submissions for administrative purposes.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/forms/{formId}/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;

    /**
     * Submits a response to a form.
     * <p>
     * This endpoint is available to authenticated users. It validates the form
     * data, checks that the user has access to the form, and creates a new
     * submission record.
     * </p>
     *
     * @param formId    the UUID of the form being submitted
     * @param request   the {@link SubmitFormRequest} containing the form response data
     * @param principal the currently authenticated user details
     * @return a {@link ResponseEntity} with status 201 (Created) containing the created submission
     * @since v.0.1
     */
    @PostMapping
    public ResponseEntity<SubmissionDto> submit(
            @PathVariable UUID formId,
            @Valid @RequestBody SubmitFormRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        var submission = submissionService.submit(formId, principal.getDiscordId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(SubmissionDto.from(submission));
    }

    /**
     * Retrieves a paginated list of submissions for a specific form.
     * <p>
     * Requires the {@code RESPONSE_READ} authority.
     * </p>
     *
     * @param formId   the UUID of the form to retrieve submissions for
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link SubmissionDto} containing submission data
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE')")
    @GetMapping
    public Page<SubmissionDto> list(@PathVariable UUID formId, Pageable pageable) {
        return submissionService.listByForm(formId, pageable).map(SubmissionDto::from);
    }
}