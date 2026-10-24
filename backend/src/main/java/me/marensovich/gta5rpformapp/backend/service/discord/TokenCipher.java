package me.marensovich.gta5rpformapp.backend.service.discord;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM encryption for secrets stored at rest (Discord user tokens).
 * <p>
 * Output format: {@code base64(iv[12] || ciphertext+tag)}. A fresh random IV
 * is used for every value, so encrypting the same token twice yields
 * different ciphertexts.
 * </p>
 * <p>
 * The key comes from {@code app.token-encryption-key} (base64, 32 bytes).
 * If it isn't set, a key is derived from the JWT secret instead and a
 * warning is logged — fine for local development, but production should set
 * a dedicated key so rotating the JWT secret doesn't make stored tokens
 * unreadable.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
public class TokenCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public TokenCipher(@Value("${app.token-encryption-key:}") String encodedKey,
                       @Value("${jwt.secret}") String jwtSecret) {
        this.key = new SecretKeySpec(resolveKey(encodedKey, jwtSecret), "AES");
    }

    private static byte[] resolveKey(String encodedKey, String jwtSecret) {
        if (encodedKey != null && !encodedKey.isBlank()) {
            byte[] raw = Base64.getDecoder().decode(encodedKey.trim());
            if (raw.length != 32) {
                throw new IllegalStateException("app.token-encryption-key must be 32 bytes (base64-encoded)");
            }
            return raw;
        }
        log.warn("app.token-encryption-key is not set — deriving the token encryption key from jwt.secret. " +
                "Set TOKEN_ENCRYPTION_KEY in production.");
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(("marforms-token-key:" + jwtSecret).getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Encrypts a value.
     *
     * @param plaintext the value to encrypt
     * @return the encoded ciphertext
     * @since v.0.1
     */
    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            int payloadLength = Math.addExact(iv.length, encrypted.length);
            return Base64.getEncoder().encodeToString(
                    ByteBuffer.allocate(payloadLength).put(iv).put(encrypted).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Token encryption failed", e);
        }
    }

    /**
     * Decrypts a value produced by {@link #encrypt}.
     *
     * @param encoded the encoded ciphertext
     * @return the original value
     * @throws IllegalStateException if the value was tampered with or
     *                               encrypted under a different key
     * @since v.0.1
     */
    public String decrypt(String encoded) {
        try {
            byte[] data = Base64.getDecoder().decode(encoded);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, data, 0, IV_LENGTH));
            byte[] plain = cipher.doFinal(data, IV_LENGTH, data.length - IV_LENGTH);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Token decryption failed", e);
        }
    }
}
