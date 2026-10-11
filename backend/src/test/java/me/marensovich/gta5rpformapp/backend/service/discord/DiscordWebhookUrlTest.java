package me.marensovich.gta5rpformapp.backend.service.discord;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DiscordWebhookUrlTest {

    @Test
    void acceptsDiscordWebhookUrlsAndCanonicalizesThem() {
        for (String url : new String[]{
                "https://discord.com/api/webhooks/123/tok-EN_1",
                "https://discordapp.com/api/webhooks/123/tok-EN_1",
                "https://canary.discord.com/api/v10/webhooks/123/tok-EN_1/",
                " https://ptb.discord.com/api/webhooks/123/tok-EN_1 "}) {
            assertThat(DiscordWebhookUrl.parse(url)).get()
                    .extracting(DiscordWebhookUrl::canonical).isEqualTo("https://discord.com/api/webhooks/123/tok-EN_1");
        }
    }

    @Test
    void rejectsAnythingElse() {
        for (String url : new String[]{
                null, "", "http://discord.com/api/webhooks/1/x", "https://127.0.0.1/api/webhooks/1/x",
                "https://discord.com.evil.example/api/webhooks/1/x", "https://evil.example/https://discord.com/api/webhooks/1/x",
                "https://discord.com/api/webhooks/1/x?wait=true", "https://discord.com/api/webhooks/1/x/../../y",
                "https://user@discord.com/api/webhooks/1/x", "https://discord.com:8443/api/webhooks/1/x"}) {
            assertThat(DiscordWebhookUrl.parse(url)).as(String.valueOf(url)).isEmpty();
        }
    }

    @Test
    void messageUrlsTakeOnlyNumericIds() {
        DiscordWebhookUrl webhook = DiscordWebhookUrl.parse("https://discord.com/api/webhooks/1/x").orElseThrow();
        assertThat(webhook.messageUrl("42")).isEqualTo("https://discord.com/api/webhooks/1/x/messages/42");
        assertThatThrownBy(() -> webhook.messageUrl("../../users/@me")).isInstanceOf(IllegalArgumentException.class);
        assertThat(webhook.toString()).doesNotContain("/x");
    }
}
