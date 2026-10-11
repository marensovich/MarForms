package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.config.security.Sha256;
import me.marensovich.gta5rpformapp.backend.database.entity.LoginCode;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.LoginCodeRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Hands the session over from the OAuth redirect to the SPA without putting
 * the JWT in a URL (security audit, #103).
 * <p>
 * The redirect carries a one-time code, valid for a minute; the same response
 * sets an HttpOnly cookie with a second secret. The SPA exchanges the code
 * for a JWT, and the exchange only succeeds with both — so a code leaked
 * through logs or history is useless, and a code an attacker obtained for
 * their own account can't sign a victim into it (login CSRF).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class LoginCodeService {

    static final Duration CODE_TTL = Duration.ofSeconds(60);

    private final LoginCodeRepository loginCodeRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    /** A freshly issued code and the browser-binding secret that goes with it. */
    public record Issued(String code, String nonce) {
    }

    /**
     * @param discordId who signed in
     * @return the code for the redirect and the nonce for the cookie
     * @since v.0.1
     */
    public Issued issue(Long discordId) {
        loginCodeRepository.deleteExpired(LocalDateTime.now());
        Issued issued = new Issued(Sha256.randomToken(), Sha256.randomToken());
        LoginCode row = new LoginCode();
        row.setCodeHash(Sha256.hex(issued.code()));
        row.setNonceHash(Sha256.hex(issued.nonce()));
        row.setDiscordId(discordId);
        row.setExpiresAt(LocalDateTime.now().plus(CODE_TTL));
        loginCodeRepository.save(row);
        return issued;
    }

    /**
     * Exchanges a code for a session token. The code is consumed whatever
     * the outcome.
     *
     * @param code  the code from the redirect
     * @param nonce the cookie's value, may be {@code null}
     * @return the JWT, or empty if the code is unknown, used, expired or the
     * cookie doesn't match
     * @since v.0.1
     */
    @Transactional
    public Optional<String> exchange(String code, String nonce) {
        if (code == null || code.isBlank()) return Optional.empty();
        String codeHash = Sha256.hex(code);
        LoginCode row = loginCodeRepository.findById(codeHash).orElse(null);
        if (row == null || loginCodeRepository.consume(codeHash) == 0) return Optional.empty();
        if (row.getExpiresAt().isBefore(LocalDateTime.now())) return Optional.empty();
        if (nonce == null || !Sha256.hex(nonce).equals(row.getNonceHash())) return Optional.empty();
        return userRepository.findByDiscordId(row.getDiscordId())
                .map(user -> jwtUtil.generateToken(user.getDiscordId(), user.getTokenVersion()));
    }

    /**
     * Signs a user out everywhere: every token issued so far stops working.
     *
     * @param user the signed-in user
     * @since v.0.1
     */
    @Transactional
    public void revokeAllTokens(User user) {
        userRepository.findById(user.getId()).ifPresent(u -> {
            u.setTokenVersion(u.getTokenVersion() + 1);
            userRepository.save(u);
        });
    }
}
