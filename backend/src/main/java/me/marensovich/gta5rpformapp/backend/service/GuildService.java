package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Service for managing {@link Guild} entities.
 * <p>
 * There is no bot-install flow yet (webhooks are still pasted in manually —
 * see {@code WebhookService}), so a Guild row is created lazily the first
 * time its Discord ID is referenced by a form. Its name is fetched from
 * Discord via the bot token when available; if the bot isn't in that guild
 * (or no bot token is configured), the ID itself is used as a placeholder
 * name and corrected the next time this guild is looked up after the bot
 * gains access.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class GuildService {

    private final GuildRepository guildRepository;
    private final DiscordBotClient discordBotClient;

    /**
     * Retrieves the {@link Guild} for the given Discord guild ID, creating it
     * if it does not exist yet. If the stored name is still the placeholder
     * (the ID itself), a real name is fetched again in case the bot has since
     * been added to the guild.
     *
     * @param discordGuildId the Discord guild snowflake ID
     * @return the existing or newly created {@link Guild}
     * @since v.0.1
     */
    @Transactional
    public Guild getOrCreate(Long discordGuildId) {
        return guildRepository.findById(discordGuildId)
                .map(guild -> refreshNameIfPlaceholder(guild, discordGuildId))
                .orElseGet(() -> {
                    Guild guild = new Guild();
                    guild.setDiscordGuildId(discordGuildId);
                    guild.setName(fetchRealName(discordGuildId).orElse(discordGuildId.toString()));
                    guild.setBotStatus(GuildBotStatus.CONNECTED);
                    return guildRepository.save(guild);
                });
    }

    private Guild refreshNameIfPlaceholder(Guild guild, Long discordGuildId) {
        if (!guild.getName().equals(discordGuildId.toString())) return guild;
        fetchRealName(discordGuildId).ifPresent(guild::setName);
        return guildRepository.save(guild);
    }

    /**
     * Marks a guild as no longer reachable by the bot (kicked, or the bot's
     * invite was revoked). A no-op if the guild is already marked kicked, or
     * if no row exists for it yet.
     *
     * @param discordGuildId the Discord guild snowflake ID
     * @since v.0.1
     */
    @Transactional
    public void markKicked(Long discordGuildId) {
        guildRepository.findById(discordGuildId).ifPresent(guild -> {
            if (guild.getBotStatus() != GuildBotStatus.KICKED) {
                guild.setBotStatus(GuildBotStatus.KICKED);
                guildRepository.save(guild);
            }
        });
    }

    /**
     * Marks a guild as reachable by the bot again — used when the bot is
     * reinstalled on a guild it was previously kicked from (see
     * {@code GuildConnectController}). A no-op if the guild is already
     * marked connected, or if no row exists for it yet.
     *
     * @param discordGuildId the Discord guild snowflake ID
     * @since v.0.1
     */
    @Transactional
    public void markConnected(Long discordGuildId) {
        guildRepository.findById(discordGuildId).ifPresent(guild -> {
            if (guild.getBotStatus() != GuildBotStatus.CONNECTED) {
                guild.setBotStatus(GuildBotStatus.CONNECTED);
                guildRepository.save(guild);
            }
        });
    }

    private Optional<String> fetchRealName(Long discordGuildId) {
        return discordBotClient.fetchGuild(discordGuildId).map(DiscordBotClient.DiscordGuildInfo::name);
    }
}
