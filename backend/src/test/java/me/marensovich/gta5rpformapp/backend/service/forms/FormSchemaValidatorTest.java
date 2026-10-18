package me.marensovich.gta5rpformapp.backend.service.forms;

import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField.FieldType;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.exception.FieldValidationException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

class FormSchemaValidatorTest {

    static FormField field(String id, FieldType type, String label) {
        FormField f = new FormField();
        f.setId(id);
        f.setType(type);
        f.setLabel(label);
        return f;
    }

    static FormSchema schema(FormField... fields) {
        FormSchema s = new FormSchema();
        s.setTitle("Form");
        s.setFields(new ArrayList<>(List.of(fields)));
        return s;
    }

    private static FieldValidationException errorsFor(FormSchema schema) {
        return catchThrowableOfType(FieldValidationException.class, () -> FormSchemaValidator.validate(schema));
    }

    @Test
    void acceptsAValidSchemaOfEveryStage1Type() {
        FormField choice = field("c", FieldType.RADIO, "Pick");
        choice.setOptions(List.of("a", "b"));
        FormField rating = field("r", FieldType.RATING, "Rate");
        rating.setMax(10);

        assertThatCode(() -> FormSchemaValidator.validate(schema(
                field("t", FieldType.TEXT, "Name"),
                field("ta", FieldType.TEXTAREA, "Bio"),
                choice,
                field("n", FieldType.NUMBER, "Age"),
                field("d", FieldType.DATE, "When"),
                rating,
                field("s", FieldType.SECTION_BREAK, "Part 2")
        ))).doesNotThrowAnyException();
    }

    @Test
    void rejectsSingleChoiceWithFewerThanTwoOptions() {
        FormField choice = field("c", FieldType.SELECT, "Pick");
        choice.setOptions(List.of("only", " "));

        assertThat(errorsFor(schema(choice)).getErrors()).containsKey("fields[0].options");
    }

    @Test
    void rejectsDuplicateOptions() {
        FormField choice = field("c", FieldType.MULTI_SELECT, "Pick");
        choice.setOptions(List.of("a", "a"));

        assertThat(errorsFor(schema(choice)).getErrors()).containsEntry("fields[0].options", "Options must be unique");
    }

    @Test
    void rejectsDuplicateAndMissingIdsAndLabels() {
        var errors = errorsFor(schema(
                field("x", FieldType.TEXT, "A"),
                field("x", FieldType.TEXT, "B"),
                field("", FieldType.TEXT, " ")
        )).getErrors();

        assertThat(errors).containsKeys("fields[1].id", "fields[2].id", "fields[2].label");
    }

    @Test
    void rejectsARequiredSectionBreak() {
        FormField section = field("s", FieldType.SECTION_BREAK, "Part");
        section.setRequired(true);

        assertThat(errorsFor(schema(section)).getErrors()).containsKey("fields[0].required");
    }

    @Test
    void rejectsAnOutOfRangeRatingScale() {
        FormField rating = field("r", FieldType.RATING, "Rate");
        rating.setMax(11);

        assertThat(errorsFor(schema(rating)).getErrors()).containsKey("fields[0].max");
    }

    @Test
    void rejectsMinGreaterThanMax() {
        FormField text = field("t", FieldType.TEXT, "Name");
        text.setMin(10);
        text.setMax(5);

        assertThat(errorsFor(schema(text)).getErrors()).containsKey("fields[0].min");
    }

    @Test
    void rejectsAMissingTitle() {
        FormSchema s = schema(field("t", FieldType.TEXT, "Name"));
        s.setTitle(" ");

        assertThat(errorsFor(s).getErrors()).containsKey("title");
    }

    @Test
    void anEmptyDraftIsStructurallyValid() {
        assertThatCode(() -> FormSchemaValidator.validate(schema())).doesNotThrowAnyException();
    }

    @Test
    void theNewLimitsAreCheckedWhenTheFormIsSaved() {
        FormField nick = field("nick", FieldType.TEXT, "Nick");
        nick.setMinLength(10);
        nick.setMaxLength(5);
        FormField perks = field("perks", FieldType.MULTI_SELECT, "Perks");
        perks.setOptions(List.of("a", "b"));
        perks.setMinSelected(3);
        FormField day = field("day", FieldType.DATE, "Day");
        day.setMinDate("2026-11-01");
        day.setMaxDate("2026-10-01");
        FormField when = field("when", FieldType.TIME, "When");
        when.setMinDate("25:99");
        FormField shots = field("shots", FieldType.FILE_UPLOAD, "Shots");
        shots.setMaxFiles(11);

        var e = errorsFor(schema(nick, perks, day, when, shots));
        assertThat(e.getErrors()).containsKeys("fields[0].minLength", "fields[1].minSelected", "fields[2].minDate",
                "fields[3].minDate", "fields[4].maxFiles");
    }
}
