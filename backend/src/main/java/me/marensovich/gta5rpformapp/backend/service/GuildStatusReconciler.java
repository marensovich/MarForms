package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodic fallback for kick detection, on top of {@code DiscordGuildStatusListener}'s
 * real-time reaction to the bot's Gateway connection.
 * <p>
 * The product spec (раздел 6.2) originally assumed no persistent Gateway
 * connection and called for polling {@code GET /guilds/{id}} on an interval,
 * treating 403/404 as "kicked". Since the bot module runs on JDA with a real
 * Gateway session instead, this check reads the bot's local, Gateway-fed
 * guild cache ({@link DiscordBotClient#fetchGuild}) rather than making a
 * fresh REST call — cheaper, and the practical difference is nil for guilds
 * the bot lost access to while it was online (the listener already caught
 * those). What this reconciler adds is coverage for the one case the
 * listener cannot see: a guild that kicked the bot while this app was
 * offline — on reconnect, JDA's {@code GUILD_CREATE} handshake only lists
 * guilds the bot is <em>currently</em> a member of, so no leave event ever
 * fires for that guild.
 * </p>
 * <p>
 * <b>Documented trade-off:</b> detection latency for the offline case is
 * bounded by {@link #CHECK_INTERVAL_MS}, not instant — acceptable for Stage 0/1.
 * Stage 2 (E2.4, graceful degradation) extends this from a binary
 * connected/kicked check to per-channel permission loss.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GuildStatusReconciler {

    private static final long CHECK_INTERVAL_MS = 15 * 60 * 1000L;

    private final GuildRepository guildRepository;
    private final GuildService guildService;
    private final DiscordBotClient discordBotClient;

    /**
     * Re-checks every guild currently marked {@code CONNECTED} against the
     * bot's live guild cache, marking any the bot can no longer see as
     * {@code KICKED}.
     * <p>
     * Skipped entirely when no bot session is configured at all ({@link
     * DiscordBotClient#isAvailable()} is {@code false}) — otherwise every
     * guild would be (wrongly) marked kicked in environments that simply
     * don't run the bot, such as tests.
     * </p>
     *
     * @since v.0.1
     */
    @Scheduled(fixedDelay = CHECK_INTERVAL_MS)
    public void reconcile() {
        if (!discordBotClient.isAvailable()) return;

        // Also refreshes members and the bot's permissions on the servers it sees (#124).
        for (Guild guild : guildRepository.findAllByBotStatus(GuildBotStatus.CONNECTED)) {
            try {
                guildService.sync(guild.getDiscordGuildId());
            } catch (Exception e) {
                log.warn("Could not sync guild {}: {}", guild.getDiscordGuildId(), e.getMessage());
            }
        }
    }
}
