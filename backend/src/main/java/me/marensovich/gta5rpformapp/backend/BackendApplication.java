package me.marensovich.gta5rpformapp.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.web.config.EnableSpringDataWebSupport;

import static org.springframework.data.web.config.EnableSpringDataWebSupport.PageSerializationMode.VIA_DTO;

/**
 * Main application class for the GTA5 RP Form App backend.
 * <p>
 * This is the entry point for the Spring Boot application, responsible for
 * bootstrapping and starting the entire application context.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@SpringBootApplication
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