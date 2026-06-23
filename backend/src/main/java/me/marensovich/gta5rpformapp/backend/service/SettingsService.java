package me.marensovich.gta5rpformapp.backend.services;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.settings.SystemSettings;
import me.marensovich.gta5rpformapp.backend.database.entity.Setting;
import me.marensovich.gta5rpformapp.backend.database.repository.SettingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static me.marensovich.gta5rpformapp.backend.data.settings.SystemSettings.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SettingsService {

    private final SettingRepository settingRepository;

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadCache() {
        cache.clear();
        settingRepository.findAll().forEach(s -> cache.put(s.getKey(), s.getValue()));
        log.info("Settings cache loaded: {} keys", cache.size());
    }

    public SystemSettings getSettings() {
        return new SystemSettings(
                cache.getOrDefault(KEY_BAN_MESSAGE, "You are banned."),
                cache.getOrDefault(KEY_BAN_ADMIN_CONTACT, "Administrator"),
                cache.getOrDefault(KEY_SYSTEM_NAME, "MarForms"),
                cache.getOrDefault(KEY_SYSTEM_CONTACT, "")
        );
    }

    public String get(String key, String defaultValue) {
        return cache.getOrDefault(key, defaultValue);
    }

    @Transactional
    public SystemSettings updateSettings(Map<String, String> updates) {
        updates.forEach((key, value) -> {
            Setting setting = settingRepository.findById(key)
                    .orElseGet(() -> new Setting(key, null));
            setting.setValue(value);
            settingRepository.save(setting);
            cache.put(key, value);
        });
        return getSettings();
    }
}