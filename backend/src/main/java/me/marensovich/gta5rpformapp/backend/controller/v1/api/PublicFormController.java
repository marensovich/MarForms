package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.forms.AccessCode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.dto.form.AccessDetailsDto;
import me.marensovich.gta5rpformapp.backend.dto.form.PublicFormDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionFileDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionReceiptDto;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmitFormRequest;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import me.marensovich.gta5rpformapp.backend.service.files.FileService;
import me.marensovich.gta5rpformapp.backend.service.forms.FormAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

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
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicFormController {

    private final FormRepository formRepository;
    private final GuildRepository guildRepository;
    private final FormAccessService formAccessService;
    private final SubmissionService submissionService;
    private final FileService fileService;

    /**
     * The form as a respondent sees it (task #48), plus whether the current
     * viewer may fill it in.
     *
     * @param slug      the public slug
     * @param principal the logged-in user, or {@code null}
     * @return the public view of the form
     * @throws me.marensovich.gta5rpformapp.backend.exception.FormAccessException FORM_NOT_FOUND if no
     *                                                                         published-at-some-point form has this slug
     * @since v.0.1
     */
    @GetMapping("/forms/{slug}")
    public PublicFormDto get(@PathVariable String slug,
                             @RequestHeader(value = "Anonymous-Token", required = false) String anonymousToken,
                             @AuthenticationPrincipal CustomUserDetails principal) {
        Form form = findVisible(slug);
        String guildName = guildRepository.findById(form.getServerId()).map(Guild::getName).orElse(null);
        return PublicFormDto.from(form, SubmissionService.notAcceptingReason(form), guildName,
                formAccessService.evaluate(form, principal != null ? principal.getUser() : null,
                        SubmissionService.hashAnonymousToken(form, anonymousToken)));
    }

    /**
     * Submits answers (task #49). Send a client-generated
     * {@code Idempotency-Key} header and reuse it on retries: a repeat
     * returns the original submission ({@code 200}) instead of creating a
     * second one ({@code 201}).
     *
     * @param slug           the public slug
     * @param idempotencyKey the client-generated key, optional
     * @param anonymousToken a random per-browser token, used by ANONYMOUS forms only
     * @param request        the answers
     * @param principal      the logged-in user, or {@code null}
     * @return the receipt for the stored submission
     * @since v.0.1
     */
    @PostMapping("/forms/{slug}/submissions")
    public ResponseEntity<SubmissionReceiptDto> submit(
            @PathVariable String slug,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader(value = "Anonymous-Token", required = false) String anonymousToken,
            @Valid @RequestBody SubmitFormRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        Form form = findVisible(slug);
        var result = submissionService.submit(form, principal != null ? principal.getUser() : null,
                request.answers(), idempotencyKey, anonymousToken);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(SubmissionReceiptDto.from(result.submission()));
    }

    /**
     * Uploads a file for a {@code FILE_UPLOAD} field while the form is being
     * filled in (E3.2, ADR 0003); the returned {@code id} is that field's
     * answer on submit. Same access rules as submitting.
     *
     * @param slug      the public slug
     * @param fieldId   the field the file is for
     * @param file      the file
     * @param principal the logged-in user, or {@code null}
     * @return the stored file
     * @since v.0.1
     */
    @PostMapping(value = "/forms/{slug}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SubmissionFileDto> upload(
            @PathVariable String slug,
            @RequestParam("fieldId") String fieldId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        Form form = findVisible(slug);
        var stored = fileService.upload(form, fieldId, file, principal != null ? principal.getUser() : null);
        return ResponseEntity.status(HttpStatus.CREATED).body(SubmissionFileDto.from(stored));
    }

    /**
     * Resolves an old by-ID form link ({@code /forms/{id}}) to its public
     * slug, so the client can redirect without needing a session.
     *
     * @param formId the form's ID
     * @return {@code {"slug": "..."}}
     * @throws NotFoundException if the form doesn't exist, is a draft or has no slug
     * @since v.0.1
     */
    @GetMapping("/form-links/{formId}")
    public Map<String, String> resolveLink(@PathVariable UUID formId) {
        return formRepository.findById(formId)
                .filter(f -> f.getStatus() != FormStatus.DRAFT && f.getSlug() != null)
                .map(f -> Map.of("slug", f.getSlug()))
                .orElseThrow(() -> new NotFoundException("Form not found"));
    }

    private Form findVisible(String slug) {
        return formRepository.findBySlug(slug)
                .filter(f -> f.getStatus() != FormStatus.DRAFT)
                .orElseThrow(() -> FormAccessService.refusal(new FormAccessService.Decision(AccessCode.FORM_NOT_FOUND, AccessDetailsDto.NONE)));
    }
}
