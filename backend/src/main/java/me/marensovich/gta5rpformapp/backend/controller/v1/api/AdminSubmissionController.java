package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.UserSubmissionCountDto;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for administrative submission management operations.
 * <p>
 * Provides endpoints for viewing and managing form submissions with administrative privileges.
 * All endpoints require the {@code RESPONSES_MANAGE} authority.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/admin/submissions")
@RequiredArgsConstructor
public class AdminSubmissionController {

    private final SubmissionService submissionService;

    /**
     * Retrieves a paginated list of all submissions with optional filters.
     * <p>
     * Supports filtering by:
     * <ul>
     *     <li><b>Form ID</b> — filter submissions for a specific form</li>
     *     <li><b>Search</b> — search by user Discord ID or username</li>
     * </ul>
     * </p>
     * <p>
     * Requires the {@code RESPONSES_MANAGE} authority.
     * </p>
     *
     * @param formId  optional UUID to filter submissions by form
     * @param search  optional search string for user Discord ID or username
     * @param page    page number (default: 0)
     * @param size    page size (default: 15)
     * @param sortBy  field to sort by (default: "createdAt")
     * @param sortDir sort direction (default: "DESC")
     * @return a {@link Page} of {@link SubmissionDto} containing submission data
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE')")
    @GetMapping
    public Page<SubmissionDto> listAll(
            @RequestParam(required = false) UUID formId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDir
    ) {
        Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
        return submissionService.listAll(formId, search, PageRequest.of(page, size, sort))
                .map(SubmissionDto::from);
    }

    /**
     * Retrieves a list of submission counts grouped by user.
     * <p>
     * Returns the total number of submissions each user has made across all forms.
     * Useful for administrative dashboards and user activity tracking.
     * </p>
     * <p>
     * Requires the {@code RESPONSES_MANAGE} authority.
     * </p>
     *
     * @return a {@link List} of {@link UserSubmissionCountDto} containing user submission statistics
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE')")
    @GetMapping("/by-user")
    public List<UserSubmissionCountDto> listByUser() {
        return submissionService.listByUser();
    }

    /**
     * Deletes a submission by its ID.
     * <p>
     * Permanently removes the specified submission from the system.
     * </p>
     * <p>
     * Requires the {@code RESPONSES_MANAGE} authority.
     * </p>
     *
     * @param id the UUID of the submission to delete
     * @return a {@link ResponseEntity} with status 204 (No Content)
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE') or @guildAccess.hasRoleForSubmission(#id, 'MODERATOR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        submissionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}