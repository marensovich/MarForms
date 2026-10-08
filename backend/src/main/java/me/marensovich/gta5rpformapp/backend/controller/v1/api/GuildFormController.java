package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.form.CreateGuildFormRequest;
import me.marensovich.gta5rpformapp.backend.dto.form.FormResponseDto;
import me.marensovich.gta5rpformapp.backend.dto.form.FormSettingsRequest;
import me.marensovich.gta5rpformapp.backend.dto.form.FormStatusRequest;
import me.marensovich.gta5rpformapp.backend.dto.form.FormSummaryDto;
import me.marensovich.gta5rpformapp.backend.dto.form.UpdateFormRequest;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Guild-scoped form management for the owner panel (task #41).
 * <p>
 * Per the Stage 1 role table, creating, editing, publishing and deleting a
 * form is Owner-only; moderators may read forms (they need them to review
 * submissions). Every endpoint resolves the form through
 * {@link FormService#getInGuild}, so a form of another guild is a 404.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/guilds/{guildId}/forms")
@RequiredArgsConstructor
public class GuildFormController {

    private final FormService formService;

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'MODERATOR')")
    @GetMapping
    public Page<FormSummaryDto> list(@PathVariable Long guildId,
                                     @RequestParam(defaultValue = "false") boolean includeArchived,
                                     @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC)
                                     Pageable pageable) {
        return formService.listByGuild(guildId, includeArchived, pageable);
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping
    public ResponseEntity<FormResponseDto> create(@PathVariable Long guildId,
                                                  @Valid @RequestBody CreateGuildFormRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(FormResponseDto.from(formService.createInGuild(guildId, request)));
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'MODERATOR')")
    @GetMapping("/{formId}")
    public FormResponseDto get(@PathVariable Long guildId, @PathVariable UUID formId) {
        return FormResponseDto.from(formService.getInGuild(guildId, formId));
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PutMapping("/{formId}")
    public FormResponseDto update(@PathVariable Long guildId, @PathVariable UUID formId,
                                  @Valid @RequestBody UpdateFormRequest request) {
        formService.getInGuild(guildId, formId);
        return FormResponseDto.from(formService.update(formId, request));
    }

    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRole(#guildId, 'OWNER')")
    @PutMapping("/{formId}/settings")
    public FormResponseDto updateSettings(@PathVariable Long guildId, @PathVariable UUID formId,
                                          @Valid @RequestBody FormSettingsRequest request) {
        formService.getInGuild(guildId, formId);
        return FormResponseDto.from(formService.updateSettings(formId, request));
    }

    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping("/{formId}/publish")
    public FormResponseDto publish(@PathVariable Long guildId, @PathVariable UUID formId) {
        formService.getInGuild(guildId, formId);
        return FormResponseDto.from(formService.publish(formId));
    }

    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRole(#guildId, 'OWNER')")
    @PutMapping("/{formId}/status")
    public FormResponseDto changeStatus(@PathVariable Long guildId, @PathVariable UUID formId,
                                        @Valid @RequestBody FormStatusRequest request) {
        formService.getInGuild(guildId, formId);
        return FormResponseDto.from(formService.changeStatus(formId, request.status()));
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @DeleteMapping("/{formId}")
    public ResponseEntity<Void> delete(@PathVariable Long guildId, @PathVariable UUID formId) {
        formService.getInGuild(guildId, formId);
        formService.delete(formId);
        return ResponseEntity.noContent().build();
    }
}
