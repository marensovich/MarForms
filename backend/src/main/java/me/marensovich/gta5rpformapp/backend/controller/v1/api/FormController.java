package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.form.FormResponseDto;
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
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * A form by its ID, for the editor and old by-ID links, and whether an address is free.
 * <p>
 * Creating, changing and deleting a form go through the guild-scoped
 * {@link GuildFormController} only (#103: one API for forms).
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

    /** Whether an address is free for a form (ТЗ 5.2): {@code reason} is FORMAT or TAKEN when it isn't. */
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    @GetMapping("/slug-available")
    public java.util.Map<String, Object> slugAvailable(@RequestParam String slug, @RequestParam(required = false) UUID formId) {
        String problem = formService.slugProblem(slug, formId);
        java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("available", problem == null);
        body.put("reason", problem);
        return body;
    }

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
        return PublicFormDto.from(form, SubmissionService.notAcceptingReason(form), null, null,
                formAccessService.evaluate(form, principal != null ? principal.getUser() : null, null));
    }
}
