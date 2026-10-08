package me.marensovich.gta5rpformapp.backend.service.discord;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.database.repository.DiscordTokenSetRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Planned refresh of stored Discord user tokens (task #31): every run,
 * refreshes the access tokens that expire within {@link #LOOKAHEAD}, so a
 * token is renewed before it lapses rather than only on next use.
 * <p>
 * {@link DiscordTokenService#getValidAccessToken} also refreshes lazily on
 * demand, so this is a safety net, not the only path.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DiscordTokenRefresher {

    static final Duration LOOKAHEAD = Duration.ofHours(1);

    private final DiscordTokenSetRepository repository;
    private final DiscordTokenService discordTokenService;

    @Scheduled(fixedDelay = 30 * 60 * 1000L, initialDelay = 60 * 1000L)
    public void refreshExpiringTokens() {
        var expiring = repository.findAllByRefreshTokenEncryptedIsNotNullAndExpiresAtBefore(
                LocalDateTime.now().plus(LOOKAHEAD));
        if (expiring.isEmpty()) return;
        log.info("Refreshing {} Discord user token(s) close to expiry", expiring.size());
        expiring.forEach(discordTokenService::refresh);
    }
}
