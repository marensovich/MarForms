package me.marensovich.gta5rpformapp.backend.service.discord;

import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.service.GuildService;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.events.guild.GuildLeaveEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/**
 * Reacts to the bot being removed from a guild in near-real-time via JDA's
 * Gateway connection.
 * <p>
 * This is the primary half of kick detection — see {@code GuildStatusReconciler}
 * for the periodic fallback that also catches removals that happened while
 * the app was offline (Discord's {@code GUILD_CREATE} handshake on connect
 * only lists guilds the bot is <em>currently</em> a member of, so a kick that
 * happened while disconnected produces no event to react to here).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
public class DiscordGuildStatusListener extends ListenerAdapter {

    @Nullable
    private final JDA jda;
    private final GuildService guildService;

    @Autowired(required = false)
    public DiscordGuildStatusListener(@Nullable JDA jda, GuildService guildService) {
        this.jda = jda;
        this.guildService = guildService;
    }

    /**
     * Registers this listener with the bot's JDA session once the
     * application context is fully up. Deferred to {@code ApplicationReadyEvent}
     * (rather than doing this in {@code JdaConfig} itself) so building the
     * {@link JDA} bean never depends on {@link GuildService} and its own
     * dependency chain — avoiding a circular bean reference.
     *
     * @since v.0.1
     */
    @EventListener(ApplicationReadyEvent.class)
    public void register() {
        if (jda != null) {
            jda.addEventListener(this);
            log.info("Registered Discord guild-status listener (kick detection)");
        }
    }

    @Override
    public void onGuildLeave(GuildLeaveEvent event) {
        long guildId = event.getGuild().getIdLong();
        log.info("Bot was removed from guild {} — marking bot_status=kicked", guildId);
        guildService.markKicked(guildId);
    }
}
