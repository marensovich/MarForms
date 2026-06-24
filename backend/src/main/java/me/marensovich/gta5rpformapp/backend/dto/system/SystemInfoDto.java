package me.marensovich.gta5rpformapp.backend.dto.system;

/**
 * Data Transfer Object representing system information and metrics.
 * <p>
 * Contains system resource usage, uptime, and environment information.
 * Used for monitoring and administrative purposes.
 * </p>
 *
 * @param cpuUsage        current CPU usage as a percentage (0-100)
 * @param ramUsed         used RAM in bytes
 * @param ramTotal        total available RAM in bytes
 * @param diskUsed        used disk space in bytes
 * @param diskTotal       total disk space in bytes
 * @param uptimeSeconds   application uptime in seconds
 * @param osName          operating system name
 * @param osVersion       operating system version
 * @param javaVersion     Java runtime version
 * @param appVersion      application version
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record SystemInfoDto(
        double cpuUsage,
        long ramUsed,
        long ramTotal,
        long diskUsed,
        long diskTotal,
        long uptimeSeconds,
        String osName,
        String osVersion,
        String javaVersion,
        String appVersion
) {}