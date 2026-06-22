package me.marensovich.gta5rpformapp.backend.config;

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
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(List.of("http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return source;
    }
}