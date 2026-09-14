package me.marensovich.gta5rpformapp.backend.service.discord;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DiscordBotClientTest {

    @Test
    void fetchGuildIsEmptyWhenNoBotTokenIsConfigured() {
        DiscordBotClient client = new DiscordBotClient("");

        assertThat(client.fetchGuild(123L)).isEmpty();
    }

    @Test
    void fetchTextChannelsIsEmptyWhenNoBotTokenIsConfigured() {
        DiscordBotClient client = new DiscordBotClient("");

        assertThat(client.fetchTextChannels(123L)).isEmpty();
    }
}
