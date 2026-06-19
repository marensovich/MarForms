package me.marensovich.gta5rpformapp.backend.config;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Security configuration class for the application.
 * <p>
 * Configures HTTP security, authentication mechanisms, authorization rules,
 * session management, and password encoding. This class sets up:
 * <ul>
 *     <li>CORS and CSRF configuration</li>
 *     <li>OAuth2 login with a custom success handler</li>
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

    /**
     * Configures the security filter chain.
     * <p>
     * Sets up the following security configurations:
     * <ul>
     *     <li>Enables CORS with default configuration</li>
     *     <li>Disables CSRF protection (stateless API)</li>
     *     <li>Configures OAuth2 login with custom success handler</li>
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
                .csrf(csrf -> csrf.disable())

                .oauth2Login(oauth2 -> oauth2
                        .successHandler(oAuthSuccessHandler)
                )

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/oauth2/**", "/login/**").permitAll()
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers("/api/v1/**").authenticated()
                        .anyRequest().permitAll()
                )

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