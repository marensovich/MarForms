package me.marensovich.gta5rpformapp.backend.service.forms;

import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField.FieldType;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.exception.FieldValidationException;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static me.marensovich.gta5rpformapp.backend.service.forms.FormSchemaValidatorTest.field;
import static me.marensovich.gta5rpformapp.backend.service.forms.FormSchemaValidatorTest.schema;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

class SubmissionAnswerValidatorTest {

    private static Map<String, String> errors(FormSchema schema, Map<String, Object> answers) {
        return catchThrowableOfType(FieldValidationException.class,
                () -> SubmissionAnswerValidator.validate(schema, answers)).getErrors();
    }

    private static FormField required(FormField f) {
        f.setRequired(true);
        return f;
    }

    @Test
    void reportsEveryMissingRequiredFieldByItsId() {
        FormSchema s = schema(required(field("name", FieldType.TEXT, "Name")),
                required(field("agree", FieldType.BOOLEAN, "Agree")),
                field("bio", FieldType.TEXTAREA, "Bio"));

        assertThat(errors(s, Map.of("name", "  ", "agree", false))).containsOnlyKeys("name", "agree");
    }

    @Test
    void dropsUnknownKeysAndSectionBreaksAndTrimsText() {
        FormSchema s = schema(field("name", FieldType.TEXT, "Name"), field("sec", FieldType.SECTION_BREAK, "Part"));

        var clean = SubmissionAnswerValidator.validate(s, Map.of("name", "  Bob ", "sec", "x", "hacker", "x"));

        assertThat(clean).containsExactly(Map.entry("name", "Bob"));
    }

    @Test
    void enforcesTextLengthIncludingTheDefaultMax() {
        FormField name = field("name", FieldType.TEXT, "Name");
        name.setMin(3);
        FormSchema s = schema(name);

        assertThat(errors(s, Map.of("name", "ab"))).containsKey("name");
        assertThat(errors(s, Map.of("name", "a".repeat(256)))).containsKey("name");
    }

    @Test
    void choicesMustBeAmongTheOptions() {
        FormField pick = field("pick", FieldType.RADIO, "Pick");
        pick.setOptions(List.of("a", "b"));
        FormField many = field("many", FieldType.MULTI_SELECT, "Many");
        many.setOptions(List.of("x", "y"));
        FormSchema s = schema(pick, many);

        assertThat(errors(s, Map.of("pick", "c", "many", List.of("x", "z")))).containsOnlyKeys("pick", "many");
        assertThat(SubmissionAnswerValidator.validate(s, Map.of("pick", "a", "many", List.of("y")))).hasSize(2);
    }

    @Test
    void numbersAreRangeCheckedAndNormalised() {
        FormField age = field("age", FieldType.NUMBER, "Age");
        age.setMin(18);
        age.setMax(99);
        FormSchema s = schema(age);

        assertThat(errors(s, Map.of("age", "17"))).containsKey("age");
        assertThat(errors(s, Map.of("age", "abc"))).containsKey("age");
        assertThat(SubmissionAnswerValidator.validate(s, Map.of("age", "21"))).containsEntry("age", 21L);
    }

    @Test
    void ratingMustBeAWholeNumberWithinTheScale() {
        FormField rate = field("rate", FieldType.RATING, "Rate");
        rate.setMax(5);
        FormSchema s = schema(rate);

        assertThat(errors(s, Map.of("rate", 6))).containsKey("rate");
        assertThat(errors(s, Map.of("rate", 2.5))).containsKey("rate");
        assertThat(SubmissionAnswerValidator.validate(s, Map.of("rate", 4))).containsEntry("rate", 4);
    }

    @Test
    void validatesFormats() {
        FormSchema s = schema(field("e", FieldType.EMAIL, "E"), field("u", FieldType.URL, "U"),
                field("d", FieldType.DATE, "D"), field("t", FieldType.TIME, "T"), field("dt", FieldType.DATETIME, "DT"));

        Map<String, Object> bad = new HashMap<>();
        bad.put("e", "nope");
        bad.put("u", "javascript:alert(1)");
        bad.put("d", "2026-13-40");
        bad.put("t", "25:99");
        bad.put("dt", "yesterday");
        assertThat(errors(s, bad)).containsOnlyKeys("e", "u", "d", "t", "dt");

        Map<String, Object> good = Map.of("e", "a@b.co", "u", "https://example.com", "d", "2026-10-08",
                "t", "12:30", "dt", "2026-10-08T12:30");
        assertThat(SubmissionAnswerValidator.validate(s, good)).hasSize(5);
    }

    @Test
    void acceptsCheckboxAsASingleTickOrAListOfOptions() {
        FormField box = field("box", FieldType.CHECKBOX, "Box");
        box.setOptions(List.of("a", "b"));
        FormSchema s = schema(box);

        assertThat(SubmissionAnswerValidator.validate(s, Map.of("box", true))).hasSize(1);
        assertThat(SubmissionAnswerValidator.validate(s, Map.of("box", List.of("a")))).hasSize(1);
        assertThat(errors(s, Map.of("box", List.of("zzz")))).containsKey("box");
    }

    @Test
    void textLengthIsApartFromANumbersValueAndOldFormsStillWork() {
        FormField nick = field("nick", FieldType.TEXT, "Nick");
        nick.setMinLength(3);
        nick.setMaxLength(5);
        FormField age = field("age", FieldType.NUMBER, "Age");
        age.setMin(18);
        FormField legacy = field("bio", FieldType.TEXT, "Bio");
        legacy.setMin(4);
        FormSchema s = schema(nick, age, legacy);

        assertThat(errors(s, Map.of("nick", "ab", "age", 17, "bio", "abc"))).containsOnlyKeys("nick", "age", "bio");
        assertThat(errors(s, Map.of("nick", "abcdef"))).containsEntry("nick", "At most 5 characters");
        assertThat(SubmissionAnswerValidator.validate(s, Map.of("nick", "abc", "age", 18, "bio", "abcd"))).hasSize(3);
    }

    @Test
    void checkboxesCountTheChoicesAndDatesStayInTheirRange() {
        FormField perks = field("perks", FieldType.MULTI_SELECT, "Perks");
        perks.setOptions(List.of("a", "b", "c"));
        perks.setMinSelected(2);
        perks.setMaxSelected(2);
        FormField day = field("day", FieldType.DATE, "Day");
        day.setMinDate("2026-10-01");
        day.setMaxDate("2026-10-31");
        FormSchema s = schema(perks, day);

        assertThat(errors(s, Map.of("perks", List.of("a"), "day", "2026-09-30")))
                .containsEntry("perks", "Choose at least 2").containsEntry("day", "Not before 2026-10-01");
        assertThat(errors(s, Map.of("perks", List.of("a", "b", "c")))).containsEntry("perks", "Choose at most 2");
        assertThat(SubmissionAnswerValidator.validate(s, Map.of("perks", List.of("a", "c"), "day", "2026-10-31"))).hasSize(2);
    }

    @Test
    void aFileFieldTakesUpToItsNumberOfFiles() {
        FormField shots = field("shots", FieldType.FILE_UPLOAD, "Shots");
        FormSchema s = schema(shots);
        String a = "00000000-0000-0000-0000-00000000000a";
        String b = "00000000-0000-0000-0000-00000000000b";
        String c = "00000000-0000-0000-0000-00000000000c";
        String d = "00000000-0000-0000-0000-00000000000d";

        assertThat(SubmissionAnswerValidator.validate(s, Map.of("shots", List.of(a, b, c)))).containsKey("shots");
        assertThat(errors(s, Map.of("shots", List.of(a, b, c, d)))).containsEntry("shots", "At most 3 files");
        shots.setMaxFiles(1);
        assertThat(errors(s, Map.of("shots", List.of(a, b)))).containsEntry("shots", "At most 1 files");
        assertThat(SubmissionAnswerValidator.validate(s, Map.of("shots", a))).containsEntry("shots", a);
    }
}
