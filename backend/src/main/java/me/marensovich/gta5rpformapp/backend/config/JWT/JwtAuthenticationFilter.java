package me.marensovich.gta5rpformapp.backend.config.JWT;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
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

                if (!userDetails.isEnabled()) {
                    SystemSettings settings = settingsService.getSettings();
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write(String.format(
                            "{\"banned\":true,\"message\":\"%s\",\"contact\":\"%s\"}",
                            settings.banMessage().replace("\"", "\\\""),
                            settings.banAdminContact().replace("\"", "\\\"")
                    ));
                    return;
                }

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
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