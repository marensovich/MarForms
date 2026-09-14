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

    @Test
    void createWebhookIsEmptyWhenNoBotTokenIsConfigured() {
        DiscordBotClient client = new DiscordBotClient("");

        assertThat(client.createWebhook(123L, "MarForms")).isEmpty();
    }

    @Test
    void createdWebhookUrlMatchesTheFormatWebhookServiceExpects() {
        var webhook = new DiscordBotClient.CreatedWebhook("111", "secret-token");

        assertThat(webhook.url()).isEqualTo("https://discord.com/api/webhooks/111/secret-token");
    }
}
