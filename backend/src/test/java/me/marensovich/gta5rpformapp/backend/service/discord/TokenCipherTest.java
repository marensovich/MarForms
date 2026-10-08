package me.marensovich.gta5rpformapp.backend.service.discord;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TokenCipherTest {

    private final TokenCipher cipher = new TokenCipher("", "some-jwt-secret");

    @Test
    void roundTripsAValue() {
        assertThat(cipher.decrypt(cipher.encrypt("discord-access-token"))).isEqualTo("discord-access-token");
    }

    @Test
    void neverStoresThePlaintextAndUsesAFreshIvEachTime() {
        String first = cipher.encrypt("discord-access-token");
        String second = cipher.encrypt("discord-access-token");

        assertThat(first).doesNotContain("discord-access-token");
        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void rejectsCiphertextFromADifferentKey() {
        String encrypted = new TokenCipher("", "another-secret").encrypt("token");

        assertThatThrownBy(() -> cipher.decrypt(encrypted)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void acceptsAnExplicit32ByteKey() {
        String key = Base64.getEncoder().encodeToString(new byte[32]);
        TokenCipher explicit = new TokenCipher(key, "ignored");

        assertThat(explicit.decrypt(explicit.encrypt("x"))).isEqualTo("x");
    }

    @Test
    void rejectsAWronglySizedExplicitKey() {
        String key = Base64.getEncoder().encodeToString(new byte[16]);

        assertThatThrownBy(() -> new TokenCipher(key, "ignored")).isInstanceOf(IllegalStateException.class);
    }
}
