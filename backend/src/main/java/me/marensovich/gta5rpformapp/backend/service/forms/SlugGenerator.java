package me.marensovich.gta5rpformapp.backend.service.forms;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Map;

/**
 * Builds public form slugs: a readable prefix from the title (Cyrillic
 * transliterated) plus a random suffix, e.g. {@code "zayavka-v-sostav-k3x9qa"}.
 * The random part keeps slugs unguessable and makes collisions negligible;
 * {@code FormService} still checks uniqueness before saving.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class SlugGenerator {

    static final int MAX_PREFIX_LENGTH = 40;
    static final int SUFFIX_LENGTH = 6;
    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final Map<Character, String> CYRILLIC = Map.ofEntries(
            Map.entry('а', "a"), Map.entry('б', "b"), Map.entry('в', "v"), Map.entry('г', "g"),
            Map.entry('д', "d"), Map.entry('е', "e"), Map.entry('ё', "e"), Map.entry('ж', "zh"),
            Map.entry('з', "z"), Map.entry('и', "i"), Map.entry('й', "y"), Map.entry('к', "k"),
            Map.entry('л', "l"), Map.entry('м', "m"), Map.entry('н', "n"), Map.entry('о', "o"),
            Map.entry('п', "p"), Map.entry('р', "r"), Map.entry('с', "s"), Map.entry('т', "t"),
            Map.entry('у', "u"), Map.entry('ф', "f"), Map.entry('х', "h"), Map.entry('ц', "ts"),
            Map.entry('ч', "ch"), Map.entry('ш', "sh"), Map.entry('щ', "sch"), Map.entry('ъ', ""),
            Map.entry('ы', "y"), Map.entry('ь', ""), Map.entry('э', "e"), Map.entry('ю', "yu"),
            Map.entry('я', "ya")
    );

    private SlugGenerator() {
    }

    /**
     * Generates a fresh slug candidate for a title.
     *
     * @param title the form title (may be {@code null})
     * @return a URL-safe slug: {@code [a-z0-9-]+}
     * @since v.0.1
     */
    public static String generate(String title) {
        String prefix = prefix(title);
        StringBuilder suffix = new StringBuilder(SUFFIX_LENGTH);
        for (int i = 0; i < SUFFIX_LENGTH; i++) suffix.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return prefix.isEmpty() ? "form-" + suffix : prefix + "-" + suffix;
    }

    static String prefix(String title) {
        if (title == null) return "";
        StringBuilder out = new StringBuilder();
        for (char c : title.toLowerCase(Locale.ROOT).toCharArray()) {
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) out.append(c);
            else if (CYRILLIC.containsKey(c)) out.append(CYRILLIC.get(c));
            else out.append('-');
        }
        String slug = out.toString().replaceAll("-+", "-").replaceAll("^-|-$", "");
        if (slug.length() > MAX_PREFIX_LENGTH) slug = slug.substring(0, MAX_PREFIX_LENGTH).replaceAll("-$", "");
        return slug;
    }
}
