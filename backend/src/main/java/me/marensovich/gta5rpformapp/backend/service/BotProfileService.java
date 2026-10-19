package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * How the bot looks (2026-10-19): on each server its owners set its nickname,
 * avatar, banner and «Обо мне»; its status is one for every server, so only
 * the platform's administrators set it.
 *
 * @author marensovich
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BotProfileService {

    public static final String KEY_STATUS = "bot.presence.status";
    public static final String KEY_ACTIVITY = "bot.presence.activity";
    public static final String KEY_TEXT = "bot.presence.text";

    static final Set<String> STATUSES = Set.of("ONLINE", "IDLE", "DO_NOT_DISTURB", "INVISIBLE");
    static final Set<String> ACTIVITIES = Set.of("NONE", "PLAYING", "LISTENING", "WATCHING", "COMPETING", "CUSTOM");
    /** Discord takes avatars and banners up to 10 MB; the panel sends them as data URLs. */
    static final int MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    static final int MAX_NICKNAME = 32;
    static final int MAX_BIO = 190;

    private final DiscordBotClient discordBotClient;
    private final GuildRepository guildRepository;
    private final SettingsService settingsService;
    private final AuditLogService auditLogService;

    /** The bot's profile on a server, as the settings tab shows it. */
    public record Profile(String username, String nickname, String avatarUrl, String bannerUrl, String accountAvatarUrl,
                          String bio, boolean canChangeNickname) {
    }

    /**
     * A change of the bot's profile on a server: {@code null} keeps a value.
     *
     * @param nickname empty resets it to the account's name
     * @param avatar   a data URL ({@code data:image/png;base64,…}), or empty to reset it
     * @param banner   the same, for the banner
     * @param bio      empty clears it
     */
    public record ProfileChange(@Nullable String nickname, @Nullable String avatar, @Nullable String banner, @Nullable String bio) {
    }

    /** The bot's status, for every server. */
    public record Presence(String status, String activity, String text) {
    }

    /**
     * @param guildId the Discord guild snowflake ID
     * @return the bot's profile there
     * @throws NotFoundException if the bot isn't on the server
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public Profile profile(Long guildId) {
        Guild guild = guildRepository.findById(guildId).orElseThrow(() -> new NotFoundException("Server not found: " + guildId));
        DiscordBotClient.BotProfile p = discordBotClient.fetchBotProfile(guildId)
                .orElseThrow(() -> new NotFoundException("The bot isn't on the server"));
        return new Profile(p.username(), p.nickname(), p.avatarUrl(), p.bannerUrl(), p.accountAvatarUrl(), guild.getBotBio(),
                !guild.missingPermissionList().contains("NICKNAME_CHANGE"));
    }

    /**
     * Changes the bot's profile on one server.
     *
     * @throws IllegalArgumentException if a value is too long or an image isn't one
     * @throws InvalidStateException    if Discord refused the change
     * @since v.0.1
     */
    @Transactional
    public Profile update(Long guildId, ProfileChange change) {
        Guild guild = guildRepository.findById(guildId).orElseThrow(() -> new NotFoundException("Server not found: " + guildId));
        if (change.nickname() != null && change.nickname().trim().length() > MAX_NICKNAME) {
            throw new IllegalArgumentException("A nickname is at most " + MAX_NICKNAME + " characters");
        }
        if (change.bio() != null && change.bio().trim().length() > MAX_BIO) {
            throw new IllegalArgumentException("«Обо мне» is at most " + MAX_BIO + " characters");
        }
        byte[] avatar = image(change.avatar());
        byte[] banner = image(change.banner());

        switch (discordBotClient.updateBotProfile(guildId, change.nickname(), avatar, banner, change.bio())) {
            case OK -> {
            }
            case NO_BOT -> throw new NotFoundException("The bot isn't on the server");
            case MISSING_PERMISSIONS -> throw new InvalidStateException("The bot needs Change Nickname on the server");
            case FAILED -> throw new InvalidStateException("Discord didn't take the change — try another image or later");
        }
        if (change.bio() != null) {
            guild.setBotBio(change.bio().isBlank() ? null : change.bio().trim());
            guildRepository.save(guild);
        }

        List<String> changes = new ArrayList<>();
        if (change.nickname() != null) changes.add("nickname");
        if (avatar != null) changes.add("avatar");
        if (banner != null) changes.add("banner");
        if (change.bio() != null) changes.add("bio");
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("changes", changes);
        if (change.nickname() != null) metadata.put("nickname", change.nickname().trim());
        auditLogService.logGuildAction(guildId, AuditAction.GUILD_BOT_PROFILE_CHANGED, "GUILD", guildId.toString(),
                guild.getName(), metadata, "Bot profile: " + String.join(", ", changes));
        return profile(guildId);
    }

    /** The data URL's bytes; {@code null} keeps the image, empty resets it. */
    private static byte[] image(@Nullable String dataUrl) {
        if (dataUrl == null) return null;
        if (dataUrl.isBlank()) return new byte[0];
        int comma = dataUrl.indexOf(',');
        if (!dataUrl.startsWith("data:image/") || comma < 0 || !dataUrl.substring(0, comma).endsWith(";base64")) {
            throw new IllegalArgumentException("An image must be a PNG, JPEG, GIF or WebP");
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(dataUrl.substring(comma + 1));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("The image is damaged");
        }
        if (bytes.length == 0) throw new IllegalArgumentException("The image is empty");
        if (bytes.length > MAX_IMAGE_BYTES) throw new IllegalArgumentException("An image is at most 8 MB");
        return bytes;
    }

    /** The bot's status as saved. */
    public Presence presence() {
        return new Presence(settingsService.get(KEY_STATUS, "ONLINE"), settingsService.get(KEY_ACTIVITY, "NONE"),
                settingsService.get(KEY_TEXT, ""));
    }

    /**
     * Saves the bot's status and shows it on every server at once.
     *
     * @throws IllegalArgumentException if the status or activity is unknown, or the text too long
     * @since v.0.1
     */
    public Presence setPresence(Presence next) {
        if (!STATUSES.contains(next.status())) throw new IllegalArgumentException("Unknown status: " + next.status());
        if (!ACTIVITIES.contains(next.activity())) throw new IllegalArgumentException("Unknown activity: " + next.activity());
        String text = next.text() == null ? "" : next.text().trim();
        if (text.length() > 128) throw new IllegalArgumentException("The status text is at most 128 characters");
        Presence before = presence();
        settingsService.updateSettings(new LinkedHashMap<>(Map.of(KEY_STATUS, next.status(), KEY_ACTIVITY, next.activity(), KEY_TEXT, text)));
        Presence saved = presence();
        apply();
        auditLogService.logByCurrentUser(AuditAction.SETTINGS_UPDATED, null, "Bot status",
                "Bot status: " + before.status() + " " + before.activity() + " «" + before.text() + "» → "
                        + saved.status() + " " + saved.activity() + " «" + saved.text() + "»");
        return saved;
    }

    /** Shows the saved status once the bot is up. */
    @EventListener(ApplicationReadyEvent.class)
    public void apply() {
        Presence p = presence();
        try {
            discordBotClient.setPresence(p.status(), p.activity(), p.text());
        } catch (Exception e) {
            log.warn("Could not set the bot's status: {}", e.getMessage());
        }
    }
}
