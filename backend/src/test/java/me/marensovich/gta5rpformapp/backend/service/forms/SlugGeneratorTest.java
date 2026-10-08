package me.marensovich.gta5rpformapp.backend.service.forms;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SlugGeneratorTest {

    @Test
    void transliteratesCyrillicAndAddsARandomSuffix() {
        String slug = SlugGenerator.generate("Заявка в состав!");

        assertThat(slug).matches("zayavka-v-sostav-[a-z0-9]{6}");
    }

    @Test
    void isAlwaysUrlSafe() {
        assertThat(SlugGenerator.generate("  Hello, World / 2026 ✨ ")).matches("[a-z0-9-]+");
    }

    @Test
    void fallsBackToAGenericPrefixForTitlesWithNoUsableCharacters() {
        assertThat(SlugGenerator.generate("✨✨✨")).matches("form-[a-z0-9]{6}");
        assertThat(SlugGenerator.generate(null)).matches("form-[a-z0-9]{6}");
    }

    @Test
    void capsThePrefixLength() {
        assertThat(SlugGenerator.prefix("a".repeat(100))).hasSize(SlugGenerator.MAX_PREFIX_LENGTH);
    }

    @Test
    void producesDifferentSlugsForTheSameTitle() {
        assertThat(SlugGenerator.generate("Form")).isNotEqualTo(SlugGenerator.generate("Form"));
    }
}
