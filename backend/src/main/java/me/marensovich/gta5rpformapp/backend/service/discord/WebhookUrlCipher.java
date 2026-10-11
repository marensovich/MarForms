package me.marensovich.gta5rpformapp.backend.service.discord;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Keeps Discord webhook URLs encrypted wherever they are stored (#57, NFR
 * section 8): a webhook URL embeds its token, and anyone holding it can post
 * to the channel.
 * <p>
 * Sealed values are {@code enc:v1:} followed by {@link TokenCipher} output.
 * {@link #open} passes anything without that prefix through unchanged, so
 * rows written before encryption (or by a test with no cipher in the path)
 * still read correctly.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Component
public class WebhookUrlCipher {

    static final String PREFIX = "enc:v1:";

    private static final Pattern TOKEN = Pattern.compile("(webhooks/\\d+/)[\\w-]+");

    private final TokenCipher cipher;

    public WebhookUrlCipher(TokenCipher cipher) {
        this.cipher = cipher;
    }

    /**
     * Encrypts a webhook URL for storage.
     *
     * @param url the plain URL; {@code null} and blank values are returned as is. A
     *            value that merely looks sealed is encrypted again, so user input
     *            can never be mistaken for ciphertext on the way back
     * @return the sealed value
     * @since v.0.1
     */
    public String seal(String url) {
        if (url == null || url.isBlank()) return url;
        return PREFIX + cipher.encrypt(url);
    }

    /**
     * Decrypts a value produced by {@link #seal}.
     *
     * @param stored the stored value; one without the prefix is returned as is
     * @return the plain URL
     * @since v.0.1
     */
    public String open(String stored) {
        if (!isSealed(stored)) return stored;
        return cipher.decrypt(stored.substring(PREFIX.length()));
    }

    /**
     * @param value a stored value
     * @return whether it was produced by {@link #seal}
     * @since v.0.1
     */
    public static boolean isSealed(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    /**
     * Hides webhook tokens in text meant for logs or error fields — a URL,
     * or an HTTP client error message that quotes one.
     *
     * @param text any text, may be {@code null}
     * @return the text with every webhook token replaced by {@code ***}
     * @since v.0.1
     */
    public static String redact(String text) {
        if (text == null) return null;
        return TOKEN.matcher(text).replaceAll("$1***");
    }
}
