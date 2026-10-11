package me.marensovich.gta5rpformapp.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.web.config.EnableSpringDataWebSupport;
import org.springframework.scheduling.annotation.EnableAsync;

import static org.springframework.data.web.config.EnableSpringDataWebSupport.PageSerializationMode.VIA_DTO;

/**
 * Main application class for the GTA5 RP Form App backend.
 * <p>
 * This is the entry point for the Spring Boot application, responsible for
 * bootstrapping and starting the entire application context.
 * </p>
 * <p>
 * Features enabled:
 * <ul>
 *     <li><b>Async Processing</b> — {@code @EnableAsync} enables asynchronous
 *     method execution for webhook notifications and other background tasks</li>
 *     <li><b>Page Serialization</b> — {@code @EnableSpringDataWebSupport} with
 *     {@code VIA_DTO} mode ensures Spring Data Page objects are serialized
 *     as DTOs for better API contract stability</li>
 *     <li><b>Scheduling</b> — {@code @EnableScheduling} ({@code SchedulingConfig}) powers periodic
 *     background jobs such as {@code GuildStatusReconciler}</li>
 * </ul>
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableAsync
@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)
public class BackendApplication {

    /**
     * The main method that starts the Spring Boot application.
     *
     * @param args command-line arguments passed to the application
     * @since v.0.1
     */
    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }
}