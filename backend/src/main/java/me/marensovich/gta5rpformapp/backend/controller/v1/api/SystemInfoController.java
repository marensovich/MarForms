package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.system.SystemInfoDto;
import me.marensovich.gta5rpformapp.backend.service.SystemStatusService;
import me.marensovich.gta5rpformapp.backend.service.UpdateCheckService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * «Платформа → Система» (ТЗ 6.6): the application server's state, the
 * background work, and updates. All endpoints require {@code SYSTEM_ADMIN}.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/system")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
public class SystemInfoController {

    private final SystemStatusService systemStatusService;
    private final UpdateCheckService updateCheckService;

    /** CPU, memory, disk, the build, the queue and webhooks — the page reads it every 3 seconds. */
    @GetMapping("/info")
    public SystemInfoDto getSystemInfo() {
        return systemStatusService.snapshot();
    }

    /** The last update check, or a new one if it's older than an hour. */
    @GetMapping("/updates")
    public UpdateCheckService.Updates updates() {
        return updateCheckService.check(false);
    }

    /** «Проверить обновления»: asks GitHub now. */
    @PostMapping("/check-updates")
    public UpdateCheckService.Updates checkUpdates() {
        return updateCheckService.check(true);
    }
}
