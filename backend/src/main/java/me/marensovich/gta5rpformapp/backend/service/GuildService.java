package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service for managing {@link Guild} entities.
 * <p>
 * There is no bot-install flow yet (webhooks are still pasted in manually —
 * see {@code WebhookService}), so a Guild row is created lazily the first
 * time its Discord ID is referenced by a form, with a placeholder name.
 * The real name/icon will be backfilled once a bot module can query
 * Discord directly for guild metadata.
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

    /**
     * Retrieves the {@link Guild} for the given Discord guild ID, creating it
     * if it does not exist yet.
     *
     * @param discordGuildId the Discord guild snowflake ID
     * @return the existing or newly created {@link Guild}
     * @since v.0.1
     */
    @Transactional
    public Guild getOrCreate(Long discordGuildId) {
        return guildRepository.findById(discordGuildId).orElseGet(() -> {
            Guild guild = new Guild();
            guild.setDiscordGuildId(discordGuildId);
            guild.setName(discordGuildId.toString());
            guild.setBotStatus(GuildBotStatus.CONNECTED);
            return guildRepository.save(guild);
        });
    }
}
