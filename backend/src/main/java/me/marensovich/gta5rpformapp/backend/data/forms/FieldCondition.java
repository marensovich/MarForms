package me.marensovich.gta5rpformapp.backend.data.forms;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * When a field is shown (E3.1, branching): only if another field's answer
 * matches. A field without a condition is always shown.
 * <p>
 * Stored inside {@code FormField} in the form's JSON schema, so no migration
 * is needed and existing forms (no condition) behave as before. Evaluated
 * by {@code FormConditions} on the server and by its mirror in the
 * frontend renderer: keep the two in step.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FieldCondition {

    /**
     * The id of the field whose answer decides.
     */
    private String fieldId;

    /**
     * How the answer is compared.
     */
    private Operator operator;

    /**
     * The value compared against; unused by {@code EMPTY} / {@code NOT_EMPTY}.
     */
    private String value;

    /**
     * Comparison operators. An answer is seen as a list of strings: one
     * for a single value, several for a multi-choice, none when empty
     * (a blank text, an unticked checkbox, nothing chosen).
     */
    public enum Operator {
        /** One of the answer's values equals {@code value} (case-insensitive). */
        EQUALS,
        /** The opposite of {@link #EQUALS}; true for an empty answer. */
        NOT_EQUALS,
        /** One of the answer's values contains {@code value} (case-insensitive). */
        CONTAINS,
        /** The answer is empty. */
        EMPTY,
        /** The answer is not empty (for a checkbox: ticked). */
        NOT_EMPTY,
        /** The answer is a number greater than {@code value}. */
        GREATER_THAN,
        /** The answer is a number less than {@code value}. */
        LESS_THAN;

        /**
         * @return whether this operator compares against a {@code value}
         */
        public boolean needsValue() {
            return this != EMPTY && this != NOT_EMPTY;
        }
    }
}
