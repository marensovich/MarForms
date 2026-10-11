package me.marensovich.gta5rpformapp.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Configuration class for enabling Cross-Origin Resource Sharing (CORS).
 * <p>
 * Configures allowed origins, methods, headers, and credentials for all endpoints.
 * This allows the frontend application (running on a different origin) to communicate
 * with the backend API.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Configuration
public class CorsConfig {

    /**
     * Configures CORS mappings for the entire application.
     * <p>
     * Creates a CORS configuration that allows requests from the specified origin
     * with the specified HTTP methods and headers. Credentials (cookies, authorization
     * headers) are also allowed.
     * </p>
     * <p>
     * The configuration is applied to all endpoints ({@code /**}).
     * </p>
     *
     * @return a {@link CorsConfigurationSource} containing the CORS settings
     * @since v.0.1
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:${app.frontend-url:http://localhost:5173}}") List<String> allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();

        // The SPA's origin(s), comma-separated in CORS_ALLOWED_ORIGINS; defaults to app.frontend-url.
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return source;
    }
}