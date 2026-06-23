package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.settings.SystemSettings;
import me.marensovich.gta5rpformapp.backend.services.SettingsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import static me.marensovich.gta5rpformapp.backend.data.settings.SystemSettings.*;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settingsService;

    /**
     * Публичный endpoint — используется на странице бана,
     * чтобы показать сообщение и контакт администратора
     * без необходимости быть залогиненным.
     */
    @GetMapping("/public")
    public Map<String, String> getPublicSettings() {
        SystemSettings s = settingsService.getSettings();
        return Map.of(
                "banMessage", s.banMessage(),
                "banAdminContact", s.banAdminContact(),
                "systemName", s.systemName()
        );
    }

    @GetMapping
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public SystemSettings getAll() {
        return settingsService.getSettings();
    }

    @PutMapping
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public SystemSettings update(@RequestBody Map<String, String> updates) {
        // Разрешаем обновлять только известные ключи
        Map<String, String> allowed = Map.of(
                KEY_BAN_MESSAGE, updates.getOrDefault(KEY_BAN_MESSAGE, ""),
                KEY_BAN_ADMIN_CONTACT, updates.getOrDefault(KEY_BAN_ADMIN_CONTACT, ""),
                KEY_SYSTEM_NAME, updates.getOrDefault(KEY_SYSTEM_NAME, ""),
                KEY_SYSTEM_CONTACT, updates.getOrDefault(KEY_SYSTEM_CONTACT, "")
        );
        return settingsService.updateSettings(allowed);
    }
}