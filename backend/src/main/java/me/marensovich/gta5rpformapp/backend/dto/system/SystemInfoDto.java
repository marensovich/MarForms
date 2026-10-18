package me.marensovich.gta5rpformapp.backend.dto.system;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The state of the application server for «Платформа → Система» (ТЗ 6.6),
 * read every 3 seconds.
 *
 * @param cpu      processor load
 * @param ram      memory of the machine and the JVM heap
 * @param disk     the disk the uploads live on, the uploads and the database
 * @param about    OS, JVM, version with commit, uptime
 * @param jobs     the outbound queue
 * @param webhooks forms' webhooks by health
 * @param at       when this was measured
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record SystemInfoDto(Cpu cpu, Ram ram, Disk disk, About about, Jobs jobs, Webhooks webhooks, LocalDateTime at) {

    /**
     * @param usage       percent, 0–100
     * @param cores       processors available to the JVM
     * @param loadAverage the 1, 5 and 15 minute load averages where the OS gives them
     */
    public record Cpu(double usage, int cores, List<Double> loadAverage) {
    }

    /** Bytes. */
    public record Ram(long used, long total, long heapUsed, long heapMax) {
    }

    /**
     * Bytes.
     *
     * @param uploads  what the submissions' files take
     * @param database the database's size, {@code null} if it can't be read
     */
    public record Disk(long used, long total, long uploads, Long database) {
    }

    /**
     * @param commit the build's commit, {@code null} if unknown
     */
    public record About(String os, String jvm, String version, String commit, long uptimeSeconds) {
    }

    /**
     * @param queued        waiting to be sent or retried
     * @param failed        given up after every attempt
     * @param succeeded24h  delivered in the last 24 hours
     */
    public record Jobs(long queued, long failed, long succeeded24h) {
    }

    public record Webhooks(long healthy, long degraded, long invalid) {
    }
}
