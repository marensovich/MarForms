package me.marensovich.gta5rpformapp.backend.service;

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

/**
 * Service for managing system settings.
 * <p>
 * Provides in-memory caching of settings for fast access and supports
 * retrieving and updating configuration values.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SettingsService {

    private final SettingRepository settingRepository;

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    /**
     * Loads all settings from the database into the in-memory cache.
     * Automatically called after bean initialization.
     *
     * @since v.0.1
     */
    @PostConstruct
    public void loadCache() {
        cache.clear();
        settingRepository.findAll().forEach(s -> cache.put(s.getKey(), s.getValue()));
        log.info("Settings cache loaded: {} keys", cache.size());
    }

    /**
     * Retrieves all system settings as a {@link SystemSettings} record.
     *
     * @return a {@link SystemSettings} object containing all configuration values
     * @since v.0.1
     */
    public SystemSettings getSettings() {
        return new SystemSettings(
                cache.getOrDefault(KEY_BAN_MESSAGE, "You are banned."),
                cache.getOrDefault(KEY_BAN_ADMIN_CONTACT, "Administrator"),
                cache.getOrDefault(KEY_SYSTEM_NAME, "MarForms"),
                cache.getOrDefault(KEY_SYSTEM_CONTACT, ""),
                cache.getOrDefault(KEY_LOG_WEBHOOK_URL, ""),
                cache.getOrDefault(KEY_LOG_ENABLED_ACTIONS, ""),
                cache.getOrDefault(KEY_G_COLOR, ""),
                cache.getOrDefault(KEY_G_TITLE, ""),
                cache.getOrDefault(KEY_G_DESC, ""),
                cache.getOrDefault(KEY_G_AUTHOR_NAME, ""),
                cache.getOrDefault(KEY_G_AUTHOR_ICON, ""),
                cache.getOrDefault(KEY_G_AUTHOR_URL, ""),
                cache.getOrDefault(KEY_G_THUMBNAIL, ""),
                cache.getOrDefault(KEY_G_IMAGE, ""),
                cache.getOrDefault(KEY_G_FOOTER_TEXT, ""),
                cache.getOrDefault(KEY_G_FOOTER_ICON, ""),
                cache.getOrDefault(KEY_UI_LANGUAGE, "en")
        );
    }

    /**
     * Retrieves a single setting value by key.
     *
     * @param key          the setting key
     * @param defaultValue the default value if the key is not found
     * @return the setting value, or the default if not present
     * @since v.0.1
     */
    public String get(String key, String defaultValue) {
        return cache.getOrDefault(key, defaultValue);
    }

    /**
     * Updates multiple settings and refreshes the cache.
     *
     * @param updates a {@link Map} of key-value pairs to update
     * @return the updated {@link SystemSettings} object
     * @since v.0.1
     */
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