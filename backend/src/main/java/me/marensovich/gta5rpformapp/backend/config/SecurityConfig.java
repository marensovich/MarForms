package me.marensovich.gta5rpformapp.backend.config;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Security configuration class for the application.
 * <p>
 * Configures HTTP security, authentication mechanisms, authorization rules,
 * session management, and password encoding. This class sets up:
 * <ul>
 *     <li>CORS and CSRF configuration</li>
 *     <li>OAuth2 login with a custom success handler and PKCE-disabled resolver</li>
 *     <li>Endpoint authorization rules</li>
 *     <li>Stateless session management</li>
 *     <li>JWT authentication filter</li>
 * </ul>
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final OAuthSuccessHandler oAuthSuccessHandler;
    private final OAuthFailureHandler oAuthFailureHandler;
    private final NoPkceAuthorizationRequestResolver noPkceResolver;

    /**
     * Configures the security filter chain.
     * <p>
     * Sets up the following security configurations:
     * <ul>
     *     <li>Enables CORS with default configuration</li>
     *     <li>Disables CSRF protection (stateless API)</li>
     *     <li>Configures OAuth2 login with custom authorization request resolver (PKCE disabled) and success handler</li>
     *     <li>Defines authorization rules for endpoints</li>
     *     <li>Sets session creation policy to STATELESS (JWT-based)</li>
     *     <li>Adds JWT authentication filter before standard authentication</li>
     * </ul>
     * </p>
     *
     * @param http the {@link HttpSecurity} to configure
     * @return the built {@link SecurityFilterChain}
     * @throws Exception if an error occurs during configuration
     * @since v.0.1
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .cors(Customizer.withDefaults())
                // API authentication is stateless and uses an explicit Bearer token,
                // so browser-managed credentials cannot authenticate forged requests.
                // Keep CSRF protection enabled everywhere else, including any future
                // session- or cookie-authenticated endpoints.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))

                .oauth2Login(oauth2 -> oauth2
                        // The SPA's own sign-in page: without it Spring draws one at
                        // GET /login, over the app's page in the single image.
                        .loginPage("/login")
                        .authorizationEndpoint(auth -> auth
                                .authorizationRequestResolver(noPkceResolver)
                        )
                        .successHandler(oAuthSuccessHandler)
                        .failureHandler(oAuthFailureHandler)
                )

                .authorizeHttpRequests(auth -> auth
                        // The journal's Live stream (SSE, #146) ends on an async dispatch of a request
                        // already authorized; the JWT filter doesn't run again there.
                        .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ASYNC).permitAll()
                        .requestMatchers("/oauth2/**", "/login/**").permitAll()
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers("/api/v1/settings/public").permitAll()
                        // Respondent-facing form API: OPEN forms work without a
                        // session; access to others is decided per form by
                        // FormAccessService (401/403), not by this filter.
                        .requestMatchers("/api/v1/public/**").permitAll()
                        // Discord redirects the browser here directly after a bot
                        // install — no Authorization header to check; the acting
                        // user is identified by the one-time `state` nonce and
                        // verified through the bot (GuildConnectService).
                        .requestMatchers("/api/v1/guilds/connect/callback").permitAll()
                        .requestMatchers("/api/v1/**").authenticated()
                        .anyRequest().permitAll()
                )

                // The API answers 401, not a redirect to Discord's login page:
                // a fetch can't follow that redirect, and the SPA needs to know
                // the session is gone (#103).
                .exceptionHandling(ex -> ex.defaultAuthenticationEntryPointFor(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                        request -> request.getRequestURI().startsWith("/api/")))

                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)

                .build();
    }

    /**
     * Provides a password encoder bean.
     * <p>
     * Uses BCrypt hashing algorithm for secure password storage.
     * </p>
     *
     * @return a {@link PasswordEncoder} instance using BCrypt
     * @since v.0.1
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
