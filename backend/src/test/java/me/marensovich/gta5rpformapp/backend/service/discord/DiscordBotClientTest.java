package me.marensovich.gta5rpformapp.backend.service.discord;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DiscordBotClientTest {

    @Test
    void fetchGuildIsEmptyWhenNoJdaSessionIsAvailable() {
        DiscordBotClient client = new DiscordBotClient(null);

        assertThat(client.fetchGuild(123L)).isEmpty();
    }

    @Test
    void fetchTextChannelsIsEmptyWhenNoJdaSessionIsAvailable() {
        DiscordBotClient client = new DiscordBotClient(null);

        assertThat(client.fetchTextChannels(123L)).isEmpty();
    }

    @Test
    void createWebhookIsEmptyWhenNoJdaSessionIsAvailable() {
        DiscordBotClient client = new DiscordBotClient(null);

        assertThat(client.createWebhook(123L, "MarForms")).isEmpty();
    }

    @Test
    void fetchMemberRoleIdsIsEmptyWhenNoJdaSessionIsAvailable() {
        DiscordBotClient client = new DiscordBotClient(null);

        assertThat(client.fetchMemberRoleIds(123L, 456L)).isEmpty();
    }

    @Test
    void createdWebhookUrlMatchesTheFormatWebhookServiceExpects() {
        var webhook = new DiscordBotClient.CreatedWebhook("111", "secret-token");

        assertThat(webhook.url()).isEqualTo("https://discord.com/api/webhooks/111/secret-token");
    }
}
