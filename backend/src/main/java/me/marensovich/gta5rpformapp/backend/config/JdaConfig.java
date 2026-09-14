package me.marensovich.gta5rpformapp.backend.config;

import lombok.extern.slf4j.Slf4j;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.JDABuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.Nullable;

/**
 * Builds the singleton {@link JDA} client used by {@code DiscordBotClient}.
 * <p>
 * {@code createLight} is used deliberately: the bot module only needs guild
 * and channel caching plus REST calls (webhook creation), not message content
 * or member data, so no privileged intents are requested.
 * </p>
 * <p>
 * When {@code discord.bot.token} is blank (e.g. in tests, or a deployment
 * that hasn't set up a bot yet), no bean is registered at all — every
 * {@code DiscordBotClient} method already degrades to an empty result when
 * its {@code JDA} dependency is {@code null}.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Configuration
public class JdaConfig {

    @Bean(destroyMethod = "shutdown")
    @Nullable
    public JDA jda(@Value("${discord.bot.token:}") String botToken) {
        if (botToken.isBlank()) {
            log.info("No Discord bot token configured — bot features (real guild names, " +
                    "channel listing, webhook creation) are disabled.");
            return null;
        }
        try {
            return JDABuilder.createLight(botToken).build().awaitReady();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Interrupted while connecting the Discord bot: {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("Failed to connect the Discord bot: {}", e.getMessage());
            return null;
        }
    }
}
