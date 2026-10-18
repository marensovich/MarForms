package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookHealth;
import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionFileRepository;
import me.marensovich.gta5rpformapp.backend.dto.system.SystemInfoDto;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.info.GitProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryUsage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Measures the application server for «Система» (ТЗ 6.6). The machine is
 * read on every call (the page asks every 3 seconds); what costs a query —
 * the queue, webhooks, storage — is kept for {@link #SLOW_TTL}.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class SystemStatusService {

    static final Duration SLOW_TTL = Duration.ofSeconds(30);

    private final OutboundJobRepository outboundJobRepository;
    private final FormRepository formRepository;
    private final SubmissionFileRepository submissionFileRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectProvider<BuildProperties> buildProperties;
    private final ObjectProvider<GitProperties> gitProperties;

    @Value("${app.files.dir:./data/uploads}")
    private String filesDir;

    private volatile Slow slow;

    private record Slow(Instant at, SystemInfoDto.Jobs jobs, SystemInfoDto.Webhooks webhooks, long uploads, Long database) {
    }

    /**
     * The server's state now.
     *
     * @return CPU, memory, disk, the build and the background work
     * @since v.0.1
     */
    public SystemInfoDto snapshot() {
        var os = ManagementFactory.getOperatingSystemMXBean();
        double usage = 0;
        long ramTotal = 0, ramUsed = 0;
        if (os instanceof com.sun.management.OperatingSystemMXBean sun) {
            double load = sun.getCpuLoad();
            usage = load < 0 ? 0 : Math.round(load * 1000.0) / 10.0;
            ramTotal = sun.getTotalMemorySize();
            ramUsed = ramTotal - sun.getFreeMemorySize();
        }
        MemoryUsage heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();

        File disk = new File(filesDir).getAbsoluteFile();
        while (disk != null && !disk.exists()) disk = disk.getParentFile();
        if (disk == null) disk = new File("/");
        long diskTotal = disk.getTotalSpace();

        Slow s = slow();
        BuildProperties build = buildProperties.getIfAvailable();
        GitProperties git = gitProperties.getIfAvailable();
        String commit = git == null ? null : git.getShortCommitId();
        return new SystemInfoDto(
                new SystemInfoDto.Cpu(usage, Runtime.getRuntime().availableProcessors(), loadAverage(os.getSystemLoadAverage())),
                new SystemInfoDto.Ram(ramUsed, ramTotal, heap.getUsed(), heap.getMax() > 0 ? heap.getMax() : heap.getCommitted()),
                new SystemInfoDto.Disk(diskTotal - disk.getFreeSpace(), diskTotal, s.uploads(), s.database()),
                new SystemInfoDto.About(
                        System.getProperty("os.name") + " " + System.getProperty("os.version") + " · " + System.getProperty("os.arch"),
                        System.getProperty("java.vm.vendor") + " " + System.getProperty("java.runtime.version"),
                        build != null ? build.getVersion() : "dev",
                        commit == null || commit.isBlank() ? null : commit,
                        ManagementFactory.getRuntimeMXBean().getUptime() / 1000),
                s.jobs(),
                s.webhooks(),
                LocalDateTime.now());
    }

    /** The version the server runs, for the update check. */
    public String version() {
        BuildProperties build = buildProperties.getIfAvailable();
        return build != null ? build.getVersion() : "dev";
    }

    private Slow slow() {
        Slow s = slow;
        if (s != null && s.at().plus(SLOW_TTL).isAfter(Instant.now())) return s;
        LocalDateTime now = LocalDateTime.now();
        SystemInfoDto.Jobs jobs = new SystemInfoDto.Jobs(
                outboundJobRepository.countByStatus(OutboundJobStatus.PENDING),
                outboundJobRepository.countByStatus(OutboundJobStatus.FAILED),
                outboundJobRepository.countByStatusAndUpdatedAtAfter(OutboundJobStatus.SUCCEEDED, now.minusHours(24)));
        long healthy = 0, degraded = 0, invalid = 0;
        for (Form form : formRepository.findAll()) {
            if (form.getWebhooks() == null) continue;
            for (WebhookConfig webhook : form.getWebhooks()) {
                WebhookHealth health = webhook.getHealth() == null ? WebhookHealth.HEALTHY : webhook.getHealth();
                switch (health) {
                    case HEALTHY -> healthy++;
                    case DEGRADED -> degraded++;
                    case INVALID -> invalid++;
                }
            }
        }
        s = new Slow(Instant.now(), jobs, new SystemInfoDto.Webhooks(healthy, degraded, invalid),
                submissionFileRepository.totalBytes(), databaseSize());
        slow = s;
        return s;
    }

    /** Forgets the cached queue, webhooks and storage (tests). */
    void forget() {
        slow = null;
    }

    /** The database's size on PostgreSQL; {@code null} elsewhere (H2 in tests). */
    private Long databaseSize() {
        try {
            return jdbcTemplate.queryForObject("select pg_database_size(current_database())", Long.class);
        } catch (Exception e) {
            return null;
        }
    }

    /** 1, 5 and 15 minutes from /proc/loadavg on Linux; else the JVM's 1-minute figure, if any. */
    private static List<Double> loadAverage(double oneMinute) {
        Path proc = Path.of("/proc/loadavg");
        try {
            if (Files.isReadable(proc)) {
                String[] parts = Files.readString(proc).trim().split("\\s+");
                return List.of(Double.parseDouble(parts[0]), Double.parseDouble(parts[1]), Double.parseDouble(parts[2]));
            }
        } catch (Exception ignored) {
            // Fall back to the JVM's figure.
        }
        List<Double> out = new ArrayList<>();
        if (oneMinute >= 0) out.add(Math.round(oneMinute * 100.0) / 100.0);
        return out;
    }
}
