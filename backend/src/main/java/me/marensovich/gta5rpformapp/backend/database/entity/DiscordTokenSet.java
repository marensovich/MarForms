package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * A user's own Discord OAuth2 token pair, stored encrypted.
 * <p>
 * Lets the backend call the Discord API on the user's behalf after login
 * (see {@code DiscordTokenService}). The token values are never stored in
 * plaintext — both columns hold {@code TokenCipher} output.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "discord_token_sets")
public class DiscordTokenSet {

    /**
     * The owning user's internal ID — one token set per user.
     *
     * @since v.0.1
     */
    @Id
    @Column(name = "user_id", updatable = false, nullable = false)
    private Long userId;

    /**
     * The encrypted Discord access token.
     *
     * @since v.0.1
     */
    @Column(name = "access_token_encrypted", nullable = false, columnDefinition = "TEXT")
    private String accessTokenEncrypted;

    /**
     * The encrypted Discord refresh token ({@code null} if Discord didn't
     * issue one).
     *
     * @since v.0.1
     */
    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT")
    private String refreshTokenEncrypted;

    /**
     * When the access token expires, as reported by Discord at issue time.
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /**
     * The space-separated OAuth2 scopes the token was granted.
     *
     * @since v.0.1
     */
    private String scopes;

    /**
     * When this row was last written (login or refresh).
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
