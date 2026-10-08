package me.marensovich.gta5rpformapp.backend.dto.form;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * New field order ({@code PUT /api/v1/forms/{formId}/fields/reorder}).
 * Must contain exactly the form's current field ids, each once.
 *
 * @param fieldIds the field ids in their new order
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record ReorderFieldsRequest(@NotNull List<String> fieldIds) {
}
