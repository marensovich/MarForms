package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.dto.system.SystemInfoDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.OperatingSystemMXBean;

/**
 * REST controller for system information endpoints.
 * <p>
 * Provides endpoints for retrieving system metrics and information.
 * All endpoints require the {@code SYSTEM_ADMIN} authority.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/system")
public class SystemInfoController {

    /**
     * The current application version.
     */
    private static final String APP_VERSION = "1.0.0";

    /**
     * Retrieves comprehensive system information.
     * <p>
     * Returns metrics including:
     * <ul>
     *     <li><b>CPU</b> — current CPU usage percentage</li>
     *     <li><b>RAM</b> — used and total memory in bytes</li>
     *     <li><b>Disk</b> — used and total disk space in bytes</li>
     *     <li><b>Uptime</b> — application uptime in seconds</li>
     *     <li><b>OS</b> — operating system name and version</li>
     *     <li><b>Java</b> — Java runtime version</li>
     *     <li><b>Version</b> — application version</li>
     * </ul>
     * </p>
     * <p>
     * Requires the {@code SYSTEM_ADMIN} authority.
     * </p>
     *
     * @return a {@link SystemInfoDto} containing system metrics and information
     * @since v.0.1
     */
    @GetMapping("/info")
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public SystemInfoDto getSystemInfo() {
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();

        double cpuUsage = 0.0;
        long ramUsed = 0L;
        long ramTotal = 0L;

        if (osBean instanceof com.sun.management.OperatingSystemMXBean sunOs) {
            double load = sunOs.getCpuLoad();
            cpuUsage = load < 0 ? 0.0 : Math.round(load * 1000.0) / 10.0;
            ramTotal = sunOs.getTotalMemorySize();
            ramUsed = ramTotal - sunOs.getFreeMemorySize();
        }

        File root = new File("/");
        long diskTotal = root.getTotalSpace();
        long diskUsed = diskTotal - root.getFreeSpace();

        long uptimeSeconds = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;

        return new SystemInfoDto(
                cpuUsage,
                ramUsed,
                ramTotal,
                diskUsed,
                diskTotal,
                uptimeSeconds,
                System.getProperty("os.name"),
                System.getProperty("os.version"),
                System.getProperty("java.version"),
                APP_VERSION
        );
    }
}