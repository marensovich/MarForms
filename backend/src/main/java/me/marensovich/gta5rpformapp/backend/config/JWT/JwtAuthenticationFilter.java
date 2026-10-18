package me.marensovich.gta5rpformapp.backend.config.JWT;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.forms.AccessCode;
import me.marensovich.gta5rpformapp.backend.data.settings.SystemSettings;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.SettingsService;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * The type Jwt authentication filter.
 * <p>
 * This filter intercepts each incoming HTTP request and performs JWT-based authentication.
 * It extracts the JWT token from the Authorization header, validates it,
 * and sets the authentication context if the token is valid and the user exists.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final SettingsService settingsService;

    /**
     * Instantiates a new Jwt authentication filter.
     *
     * @param jwtUtil        the JWT utility service for token operations
     * @param userRepository the repository for user data access
     * @since v.0.1
     */
    public JwtAuthenticationFilter(JwtUtil jwtUtil, UserRepository userRepository, SettingsService settingsService) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
        this.settingsService = settingsService;
    }

    /**
     * Performs JWT authentication filtering for each request.
     * <p>
     * This method extracts the JWT token from the request, validates it,
     * retrieves the associated user from the database, checks if the account
     * is enabled (not banned), and sets the authentication context.
     * If the account is banned, it returns a 403 Forbidden error.
     * </p>
     *
     * @param request     the HTTP request containing the JWT token
     * @param response    the HTTP response for sending errors
     * @param filterChain the filter chain to continue processing
     * @throws ServletException if a servlet error occurs
     * @throws IOException      if an I/O error occurs
     * @since v.0.1
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = extractToken(request);

        if (token != null && jwtUtil.validateToken(token)) {
            Long discordId = jwtUtil.getUserIdFromToken(token);

            Optional<User> userOpt = userRepository.findByDiscordId(discordId);

            // A token from before the user's last logout (or before versions existed) is dead (#103).
            Integer version = jwtUtil.getTokenVersion(token);
            if (userOpt.isPresent() && (version == null || version != userOpt.get().getTokenVersion())) {
                userOpt = Optional.empty();
            }

            if (userOpt.isPresent()) {
                User user = userOpt.get();
                CustomUserDetails userDetails = new CustomUserDetails(user);

                // A ban closes everything; a time-out only the panel and sending submissions (ТЗ 6.3, #144).
                if (user.isBanned() || (user.isTimedOut() && !openWhileTimedOut(request))) {
                    SystemSettings settings = settingsService.getSettings();
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json;charset=UTF-8");
                    // ACCOUNT_RESTRICTED of ТЗ 3.5 (#110): the client shows it as an access screen.
                    Map<String, Object> body = new LinkedHashMap<>();
                    body.put("banned", true);
                    body.put("code", AccessCode.ACCOUNT_RESTRICTED.name());
                    body.put("message", settings.banMessage());
                    body.put("contact", settings.banAdminContact());
                    body.put("permanent", user.isBannedPermanently());
                    body.put("until", user.isBannedPermanently() || user.getBannedUntil() == null
                            ? null : user.getBannedUntil().toString());
                    body.put("timeout", user.isTimedOut());
                    body.put("reason", user.getRestrictionReason());
                    response.getWriter().write(JSON.writeValueAsString(body));
                    return;
                }

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authToken);

                // «Активные за 30 дней» (ТЗ 6.3): the latest request, at most once in five minutes.
                LocalDateTime now = LocalDateTime.now();
                if (user.getLastSeenAt() == null || user.getLastSeenAt().isBefore(now.minusMinutes(5))) {
                    userRepository.touch(user.getId(), now);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * What a timed-out user still reaches (ТЗ 6.3): signing in and out, public
     * form pages (sending is refused there with the reason), their own profile,
     * submissions and notifications. Everything else is the panel.
     */
    static boolean openWhileTimedOut(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return path.startsWith("/api/v1/auth/") || path.startsWith("/api/v1/public/") || path.equals("/api/v1/settings/public")
                || path.equals("/api/v1/me") || path.startsWith("/api/v1/me/submissions") || path.startsWith("/api/v1/me/notifications");
    }

    /**
     * Extracts the JWT token from the Authorization header.
     * <p>
     * This method retrieves the Authorization header from the request,
     * checks if it starts with the "Bearer " prefix, and returns the token
     * without the prefix. If the header is missing or invalid, returns null.
     * </p>
     *
     * @param request the HTTP request containing the Authorization header
     * @return the extracted JWT token, or {@code null} if not present or invalid
     * @since v.0.1
     */
    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}