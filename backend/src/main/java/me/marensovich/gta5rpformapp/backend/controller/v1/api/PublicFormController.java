package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.dto.form.PublicFormDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionReceiptDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmitFormRequest;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import me.marensovich.gta5rpformapp.backend.service.forms.FormAccessService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * The respondent-facing form API, addressed by public slug (E1.2).
 * <p>
 * Reachable without a session ({@code /api/v1/public/**} is permitted in
 * {@code SecurityConfig}); when the request does carry a valid JWT, the
 * filter still authenticates it, so a logged-in respondent is recognised
 * even on an {@code OPEN} form. Drafts are invisible here (404).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/public/forms/{slug}")
@RequiredArgsConstructor
public class PublicFormController {

    private final FormRepository formRepository;
    private final GuildRepository guildRepository;
    private final FormAccessService formAccessService;
    private final SubmissionService submissionService;

    /**
     * The form as a respondent sees it (task #48), plus whether the current
     * viewer may fill it in.
     *
     * @param slug      the public slug
     * @param principal the logged-in user, or {@code null}
     * @return the public view of the form
     * @throws NotFoundException if no published-at-some-point form has this slug
     * @since v.0.1
     */
    @GetMapping
    public PublicFormDto get(@PathVariable String slug, @AuthenticationPrincipal CustomUserDetails principal) {
        Form form = findVisible(slug);
        String guildName = guildRepository.findById(form.getServerId()).map(Guild::getName).orElse(null);
        return PublicFormDto.from(form, SubmissionService.notAcceptingReason(form), guildName,
                formAccessService.check(form, principal != null ? principal.getUser() : null));
    }

    /**
     * Submits answers (task #49). Send a client-generated
     * {@code Idempotency-Key} header and reuse it on retries: a repeat
     * returns the original submission ({@code 200}) instead of creating a
     * second one ({@code 201}).
     *
     * @param slug           the public slug
     * @param idempotencyKey the client-generated key, optional
     * @param request        the answers
     * @param principal      the logged-in user, or {@code null}
     * @return the receipt for the stored submission
     * @since v.0.1
     */
    @PostMapping("/submissions")
    public ResponseEntity<SubmissionReceiptDto> submit(
            @PathVariable String slug,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody SubmitFormRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        Form form = findVisible(slug);
        var result = submissionService.submit(form, principal != null ? principal.getUser() : null,
                request.answers(), idempotencyKey);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(SubmissionReceiptDto.from(result.submission()));
    }

    private Form findVisible(String slug) {
        return formRepository.findBySlug(slug)
                .filter(f -> f.getStatus() != FormStatus.DRAFT)
                .orElseThrow(() -> new NotFoundException("Form not found"));
    }
}
