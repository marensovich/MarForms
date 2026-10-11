package me.marensovich.gta5rpformapp.backend.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on the {@code @Scheduled} jobs. Tests switch it off
 * ({@code app.scheduling.enabled=false}) and run jobs by hand, so a job on
 * the scheduler's pool can't race the test's own call.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}
