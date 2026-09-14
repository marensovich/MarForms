package me.marensovich.gta5rpformapp.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Liveness check for load balancers / uptime monitoring.
 * <p>
 * Deliberately outside the {@code /api/v1} prefix and unauthenticated (see
 * {@code SecurityConfig}'s trailing {@code anyRequest().permitAll()}) — a
 * health check has to work before a caller has any credentials.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
