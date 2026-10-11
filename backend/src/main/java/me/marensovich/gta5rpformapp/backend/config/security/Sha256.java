package me.marensovich.gta5rpformapp.backend.config.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Hashing and random values for one-time secrets stored server-side
 * (bot-install state, sign-in codes): only the hash is kept.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class Sha256 {

    private static final SecureRandom RANDOM = new SecureRandom();

    private Sha256() {
    }

    /** @return the SHA-256 of a value, as lowercase hex */
    public static String hex(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** @return 256 random bits, URL-safe base64 */
    public static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
