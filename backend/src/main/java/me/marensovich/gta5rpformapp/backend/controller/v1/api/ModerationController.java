package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.dto.submission.DecisionRequest;
import me.marensovich.gta5rpformapp.backend.dto.submission.MySubmissionDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionDetailDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionDto;
import me.marensovich.gta5rpformapp.backend.service.ModerationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Moderation endpoints (E1.3). Owner and Moderator of the submission's
 * guild — or a platform admin with {@code RESPONSES_MANAGE} — via the
 * shared guild guard; respondents get 403.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ModerationController {

    private final ModerationService moderationService;

    /**
     * Every submission of a guild's forms, filterable (task #52) — the
     * moderation panel's main list. In Stage 1 a moderator sees all forms
     * of their guild (spec раздел 10).
     *
     * @param guildId  the Discord guild snowflake ID
     * @param formId   optional: one form only
     * @param status   optional: one moderation status
     * @param query    optional: author Discord ID (exact) or part of the username
     * @param pageable pagination, newest first by default
     * @return the matching submissions
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE') or @guildAccess.hasRole(#guildId, 'MODERATOR')")
    @GetMapping("/guilds/{guildId}/submissions")
    public Page<SubmissionDto> listForGuild(
            @PathVariable Long guildId,
            @RequestParam(required = false) UUID formId,
            @RequestParam(required = false) SubmissionStatus status,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return moderationService.search(new ModerationService.Filters(guildId, formId, status, query), pageable);
    }

    /**
     * The moderation card for one submission (task #55).
     *
     * @param id the submission's ID
     * @return answers, form schema and the author's guild profile
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE') or @guildAccess.hasRoleForSubmission(#id, 'MODERATOR')")
    @GetMapping("/submissions/{id}")
    public SubmissionDetailDto detail(@PathVariable UUID id) {
        return moderationService.detail(id);
    }

    /**
     * Approves, rejects or sends back a submission (task #53). Re-deciding
     * is allowed — see {@link ModerationService#decide}.
     *
     * @param id        the submission's ID
     * @param request   the decision
     * @param principal the deciding moderator
     * @return the updated submission
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE') or @guildAccess.hasRoleForSubmission(#id, 'MODERATOR')")
    @PostMapping("/submissions/{id}/decision")
    public SubmissionDto decide(@PathVariable UUID id, @Valid @RequestBody DecisionRequest request,
                                @AuthenticationPrincipal CustomUserDetails principal) {
        return moderationService.decide(id, request, principal.getDiscordId());
    }

    /**
     * The current user's own submissions with their status and moderator
     * comment — how a respondent learns the outcome (task #54, platform-only).
     *
     * @param principal the current user
     * @param pageable  pagination, newest first by default
     * @return their submissions
     * @since v.0.1
     */
    @GetMapping("/me/submissions")
    public Page<MySubmissionDto> mine(
            @AuthenticationPrincipal CustomUserDetails principal,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return moderationService.mine(principal.getDiscordId(), pageable);
    }
}
