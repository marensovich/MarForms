package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.dto.form.FormResponseDto;
import me.marensovich.gta5rpformapp.backend.dto.form.ReorderFieldsRequest;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Per-field editing of a form (task #42). Each call returns the whole
 * updated form, so the client never has to re-fetch.
 * <p>
 * Owner of the form's guild, or a platform admin with {@code FORMS_MANAGE}.
 * Configuration errors come back as 400 with a per-field breakdown (see
 * {@code FormSchemaValidator}).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/forms/{formId}/fields")
@RequiredArgsConstructor
public class FormFieldController {

    private final FormService formService;

    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRoleForForm(#formId, 'OWNER')")
    @PostMapping
    public ResponseEntity<FormResponseDto> add(@PathVariable UUID formId, @RequestBody FormField field) {
        return ResponseEntity.status(HttpStatus.CREATED).body(FormResponseDto.from(formService.addField(formId, field)));
    }

    // A literal segment always outranks {fieldId} in Spring MVC matching, so
    // this route is unambiguous (generated field ids are "f_..." anyway).
    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRoleForForm(#formId, 'OWNER')")
    @PutMapping("/reorder")
    public FormResponseDto reorder(@PathVariable UUID formId, @Valid @RequestBody ReorderFieldsRequest request) {
        return FormResponseDto.from(formService.reorderFields(formId, request.fieldIds()));
    }

    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRoleForForm(#formId, 'OWNER')")
    @PutMapping("/{fieldId}")
    public FormResponseDto update(@PathVariable UUID formId, @PathVariable String fieldId,
                                  @RequestBody FormField field) {
        return FormResponseDto.from(formService.updateField(formId, fieldId, field));
    }

    @PreAuthorize("hasAuthority('FORMS_MANAGE') or @guildAccess.hasRoleForForm(#formId, 'OWNER')")
    @DeleteMapping("/{fieldId}")
    public FormResponseDto delete(@PathVariable UUID formId, @PathVariable String fieldId) {
        return FormResponseDto.from(formService.deleteField(formId, fieldId));
    }
}
