package me.marensovich.gta5rpformapp.backend.service.billing;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;

/**
 * Verifies a Stripe webhook's {@code Stripe-Signature} header (E4.2):
 * {@code t=<unix time>,v1=<hex HMAC-SHA256 of "t.payload">}, signed with the
 * endpoint's secret, within a tolerance against replays. Same scheme the
 * Stripe SDKs implement.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class StripeWebhookVerifier {

    /** Stripe's default tolerance. */
    public static final long TOLERANCE_SECONDS = 300;

    private StripeWebhookVerifier() {
    }

    /**
     * @param payload   the raw request body, exactly as received
     * @param header    the {@code Stripe-Signature} header
     * @param secret    the endpoint's signing secret
     * @param now       the current time
     * @return whether the signature is valid and fresh
     */
    public static boolean isValid(String payload, String header, String secret, Instant now) {
        if (payload == null || header == null || secret == null || secret.isBlank()) return false;
        Long timestamp = null;
        String expected = null;
        try {
            for (String part : header.split(",")) {
                String[] kv = part.trim().split("=", 2);
                if (kv.length != 2) continue;
                if (kv[0].equals("t")) timestamp = Long.parseLong(kv[1]);
                if (kv[0].equals("v1") && expected == null) expected = kv[1];
            }
        } catch (NumberFormatException e) {
            return false;
        }
        if (timestamp == null || expected == null) return false;
        if (Math.abs(now.getEpochSecond() - timestamp) > TOLERANCE_SECONDS) return false;

        // Any of several v1 signatures may match (Stripe sends more while rotating secrets).
        String computed = sign(timestamp + "." + payload, secret);
        for (String part : header.split(",")) {
            String[] kv = part.trim().split("=", 2);
            if (kv.length == 2 && kv[0].equals("v1")
                    && MessageDigest.isEqual(computed.getBytes(StandardCharsets.UTF_8), kv[1].getBytes(StandardCharsets.UTF_8))) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param signedPayload {@code "<t>.<payload>"}
     * @param secret        the signing secret
     * @return the hex HMAC-SHA256
     */
    public static String sign(String signedPayload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
