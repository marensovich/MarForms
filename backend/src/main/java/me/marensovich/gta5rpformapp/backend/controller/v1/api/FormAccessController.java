package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.forms.AccessCode;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import me.marensovich.gta5rpformapp.backend.service.forms.FormAccessService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * REST controller for checking form access permissions.
 * <p>
 * Kept for older clients — the public form endpoint
 * ({@code GET /api/v1/public/forms/{slug}}) already reports the same
 * answer as {@code viewerAccess}. Both delegate to {@link FormAccessService}.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/forms/{formId}/access")
@RequiredArgsConstructor
public class FormAccessController {

    private final FormService formService;
    private final FormAccessService formAccessService;

    /**
     * Checks if the authenticated user has access to the specified form.
     *
     * @param formId    the UUID of the form to check
     * @param principal the currently authenticated user details
     * @return {@code {"hasAccess": boolean}}
     * @since v.0.1
     */
    @GetMapping
    public Map<String, Boolean> checkAccess(
            @PathVariable UUID formId,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        var form = formService.getById(formId);
        var access = formAccessService.check(form, principal != null ? principal.getUser() : null);
        return Map.of("hasAccess", access == AccessCode.GRANTED);
    }
}
