package me.marensovich.gta5rpformapp.backend.service.discord;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.database.entity.DiscordTokenSet;
import me.marensovich.gta5rpformapp.backend.database.repository.DiscordTokenSetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Optional;

/**
 * Stores a user's Discord OAuth2 tokens (encrypted) and keeps the access
 * token fresh via the refresh token (task #31).
 * <p>
 * Which Discord calls use which token is documented in the backend README
 * ("Discord tokens: bot vs user"). In short: everything guild-side goes
 * through the bot; only "what does Discord know about <i>this user</i>"
 * calls (currently {@code GET /users/@me/guilds}) use the user's own token.
 * </p>
 * <p>
 * Refresh failures:
 * <ul>
 *     <li><b>4xx from Discord</b> (refresh token revoked/expired, the user
 *     de-authorized the app) — the stored tokens are deleted; the user
 *     simply has to log in again next time a user-token call is needed.</li>
 *     <li><b>Anything else</b> (network, 5xx) — the stored tokens are kept
 *     and the refresh is retried on the next call / scheduled run.</li>
 * </ul>
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DiscordTokenService {

    /**
     * An access token this close to expiry is treated as expired, so a call
     * started just before expiry doesn't fail halfway through.
     */
    static final Duration EXPIRY_SKEW = Duration.ofMinutes(1);

    private final DiscordTokenSetRepository repository;
    private final TokenCipher cipher;
    private final DiscordApiClient discordApiClient;
    private final EntityManager entityManager;

    /**
     * Stores (or replaces) a user's token pair — called on every login.
     *
     * @param userId       the user's internal ID
     * @param accessToken  the Discord access token
     * @param refreshToken the Discord refresh token, may be {@code null}
     * @param expiresAt    when the access token expires; {@code null} means
     *                     unknown, treated as Discord's default one week
     * @param scopes       granted scopes, space-separated, may be {@code null}
     * @since v.0.1
     */
    @Transactional
    public void store(Long userId, String accessToken, String refreshToken, LocalDateTime expiresAt, String scopes) {
        DiscordTokenSet set = repository.findById(userId).orElseGet(DiscordTokenSet::new);
        set.setUserId(userId);
        set.setAccessTokenEncrypted(cipher.encrypt(accessToken));
        set.setRefreshTokenEncrypted(refreshToken != null ? cipher.encrypt(refreshToken) : null);
        set.setExpiresAt(expiresAt != null ? expiresAt : LocalDateTime.now().plusDays(7));
        set.setScopes(scopes);
        set.setUpdatedAt(LocalDateTime.now());
        repository.save(set);
    }

    /**
     * Returns a currently-valid access token for the user, refreshing it
     * first if it has expired (or is about to).
     *
     * @param userId the user's internal ID
     * @return the access token, or empty if the user has no stored tokens
     * or they could not be refreshed
     * @since v.0.1
     */
    @Transactional
    public Optional<String> getValidAccessToken(Long userId) {
        Optional<DiscordTokenSet> found = repository.findById(userId);
        if (found.isEmpty()) return Optional.empty();
        DiscordTokenSet set = found.get();

        if (set.getExpiresAt().isAfter(LocalDateTime.now().plus(EXPIRY_SKEW))) {
            return Optional.of(cipher.decrypt(set.getAccessTokenEncrypted()));
        }
        return refresh(set);
    }

    /**
     * Refreshes a token set right now via its refresh token.
     *
     * @param set the token set to refresh
     * @return the new access token, or empty if it could not be refreshed
     * @since v.0.1
     */
    @Transactional
    public synchronized Optional<String> refresh(DiscordTokenSet stale) {
        // Discord rotates refresh tokens: of two refreshes with the same one, the
        // second is rejected and used to wipe the user's tokens. Re-read the row
        // under a lock; if someone refreshed it meanwhile, use their result (#103).
        String seenRefreshToken = stale.getRefreshTokenEncrypted();
        DiscordTokenSet set = repository.findById(stale.getUserId()).orElse(null);
        if (set == null) return Optional.empty();
        entityManager.refresh(set, LockModeType.PESSIMISTIC_WRITE);
        if (!Objects.equals(set.getRefreshTokenEncrypted(), seenRefreshToken)) {
            return Optional.of(cipher.decrypt(set.getAccessTokenEncrypted()));
        }
        if (set.getRefreshTokenEncrypted() == null) {
            log.info("Discord access token for user {} expired and there is no refresh token", set.getUserId());
            return Optional.empty();
        }
        try {
            var response = discordApiClient.refreshAccessToken(cipher.decrypt(set.getRefreshTokenEncrypted()));
            set.setAccessTokenEncrypted(cipher.encrypt(response.accessToken()));
            if (response.refreshToken() != null) {
                set.setRefreshTokenEncrypted(cipher.encrypt(response.refreshToken()));
            }
            set.setExpiresAt(LocalDateTime.now().plusSeconds(response.expiresIn()));
            if (response.scope() != null) set.setScopes(response.scope());
            set.setUpdatedAt(LocalDateTime.now());
            repository.save(set);
            return Optional.of(response.accessToken());
        } catch (HttpClientErrorException e) {
            log.info("Discord rejected the refresh token for user {} ({}) — dropping stored tokens",
                    set.getUserId(), e.getStatusCode());
            repository.delete(set);
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Failed to refresh Discord token for user {}: {}", set.getUserId(), e.getMessage());
            return Optional.empty();
        }
    }
}
