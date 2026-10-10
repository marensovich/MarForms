package me.marensovich.gta5rpformapp.backend.service.forms;

import me.marensovich.gta5rpformapp.backend.data.forms.FieldCondition;
import me.marensovich.gta5rpformapp.backend.data.forms.FieldCondition.Operator;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField.FieldType;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.exception.FieldValidationException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static me.marensovich.gta5rpformapp.backend.service.forms.FormSchemaValidatorTest.field;
import static me.marensovich.gta5rpformapp.backend.service.forms.FormSchemaValidatorTest.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * Branching (E3.1): evaluation, schema validation and submission intake.
 */
class FormConditionsTest {

    private static FormField when(FormField f, String fieldId, Operator op, String value) {
        f.setCondition(new FieldCondition(fieldId, op, value));
        return f;
    }

    private static FormField choice(String id, FieldType type, String... options) {
        FormField f = field(id, type, id);
        f.setOptions(List.of(options));
        return f;
    }

    private static boolean matches(Operator op, String value, Object answer) {
        return FormConditions.matches(new FieldCondition("x", op, value), answer);
    }

    @Test
    void operatorsCompareAnswersAsStrings() {
        assertThat(matches(Operator.EQUALS, "Yes", "yes")).isTrue();
        assertThat(matches(Operator.EQUALS, "B", List.of("A", "B"))).isTrue();
        assertThat(matches(Operator.NOT_EQUALS, "B", List.of("A"))).isTrue();
        assertThat(matches(Operator.NOT_EQUALS, "B", null)).isTrue();
        assertThat(matches(Operator.CONTAINS, "disc", "My Discord")).isTrue();
        assertThat(matches(Operator.EMPTY, null, "  ")).isTrue();
        assertThat(matches(Operator.EMPTY, null, false)).isTrue();
        assertThat(matches(Operator.NOT_EMPTY, null, true)).isTrue();
        assertThat(matches(Operator.GREATER_THAN, "17", 18L)).isTrue();
        assertThat(matches(Operator.GREATER_THAN, "17", "abc")).isFalse();
        assertThat(matches(Operator.LESS_THAN, "3", 2)).isTrue();
        assertThat(matches(Operator.LESS_THAN, "3", null)).isFalse();
        assertThat(matches(Operator.EQUALS, "5", 5.0)).isTrue();
    }

    @Test
    void hidingAFieldAlsoHidesWhatDependsOnIt() {
        List<FormField> fields = List.of(
                choice("role", FieldType.RADIO, "Police", "Civilian"),
                when(field("badge", FieldType.TEXT, "Badge"), "role", Operator.EQUALS, "Police"),
                when(field("unit", FieldType.TEXT, "Unit"), "badge", Operator.NOT_EMPTY, null));

        assertThat(FormConditions.visibleFieldIds(fields, Map.of("role", "Police", "badge", "42")))
                .containsExactly("role", "badge", "unit");
        // The badge answer is stale once the role changes: unit must hide too.
        assertThat(FormConditions.visibleFieldIds(fields, Map.of("role", "Civilian", "badge", "42")))
                .containsExactly("role");
    }

    @Test
    void cyclesAreRejectedWithTheChain() {
        FormSchema s = schema(
                when(field("a", FieldType.TEXT, "A"), "b", Operator.NOT_EMPTY, null),
                when(field("b", FieldType.TEXT, "B"), "c", Operator.NOT_EMPTY, null),
                when(field("c", FieldType.TEXT, "C"), "a", Operator.NOT_EMPTY, null));

        var e = catchThrowableOfType(FieldValidationException.class, () -> FormSchemaValidator.validate(s));
        assertThat(e.getErrors()).hasSize(1);
        assertThat(e.getErrors().values().iterator().next()).startsWith("Conditions form a loop:").contains("→");
    }

    @Test
    void conditionsMustPointAtARealInputWithASensibleValue() {
        FormSchema s = schema(
                choice("role", FieldType.SELECT, "Police", "Civilian"),
                field("section", FieldType.SECTION_BREAK, "Section"),
                when(field("a", FieldType.TEXT, "A"), "a", Operator.NOT_EMPTY, null),
                when(field("b", FieldType.TEXT, "B"), "missing", Operator.NOT_EMPTY, null),
                when(field("c", FieldType.TEXT, "C"), "section", Operator.NOT_EMPTY, null),
                when(field("d", FieldType.TEXT, "D"), "role", Operator.EQUALS, "Medic"),
                when(field("e", FieldType.TEXT, "E"), "role", Operator.GREATER_THAN, "1"),
                when(field("f", FieldType.TEXT, "F"), "role", Operator.EQUALS, " "),
                when(field("g", FieldType.TEXT, "G"), "role", null, "Police"));

        var e = catchThrowableOfType(FieldValidationException.class, () -> FormSchemaValidator.validate(s));
        assertThat(e.getErrors()).containsOnlyKeys(
                "fields[2].condition", "fields[3].condition", "fields[4].condition", "fields[5].condition",
                "fields[6].condition", "fields[7].condition", "fields[8].condition");

        assertThatCode(() -> FormSchemaValidator.validate(schema(
                choice("role", FieldType.SELECT, "Police", "Civilian"),
                when(field("badge", FieldType.TEXT, "Badge"), "role", Operator.EQUALS, "police"))))
                .doesNotThrowAnyException();
    }

    @Test
    void aHiddenRequiredFieldDoesNotBlockSubmissionAndItsAnswerIsDropped() {
        FormField badge = when(field("badge", FieldType.TEXT, "Badge"), "role", Operator.EQUALS, "Police");
        badge.setRequired(true);
        FormSchema s = schema(choice("role", FieldType.RADIO, "Police", "Civilian"), badge);

        assertThat(SubmissionAnswerValidator.validate(s, Map.of("role", "Civilian", "badge", "stale")))
                .containsOnlyKeys("role");

        var e = catchThrowableOfType(FieldValidationException.class,
                () -> SubmissionAnswerValidator.validate(s, Map.of("role", "Police")));
        assertThat(e.getErrors()).containsOnlyKeys("badge");

        assertThat(SubmissionAnswerValidator.validate(s, Map.of("role", "Police", "badge", "A-1")))
                .containsEntry("badge", "A-1");
    }
}
