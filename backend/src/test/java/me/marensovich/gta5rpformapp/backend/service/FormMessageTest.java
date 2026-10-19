package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The text above a report: the form's, then the channel's (2026-10-19). */
class FormMessageTest {

    private static String message(String form, String channel) {
        Form f = new Form();
        f.setDiscordMessage(form);
        WebhookConfig cfg = new WebhookConfig();
        cfg.setContent(channel);
        return WebhookService.messageOf(f, cfg);
    }

    @Test
    void theFormsTextComesFirstThenTheChannels() {
        assertThat(message("<@&1> новый ответ", "<@&2>")).isEqualTo("<@&1> новый ответ\n<@&2>");
        assertThat(message(null, "<@&2>")).isEqualTo("<@&2>");
        assertThat(message("  ", null)).isNull();
    }

    @Test
    void itStaysWithinDiscordsLimit() {
        assertThat(message("a".repeat(1500), "b".repeat(1500))).hasSize(2000);
    }

    @Test
    void theEmbedHasTheChannelsFooterAndTitleLinkAndMayGoWithoutATime() {
        Form form = new Form();
        form.setSchema(new me.marensovich.gta5rpformapp.backend.data.forms.FormSchema());
        form.getSchema().setTitle("LSPD");
        WebhookConfig cfg = new WebhookConfig();
        cfg.setTitleUrl("https://example.com/f/lspd");
        cfg.setFooterText("Сервер {server.name}");
        cfg.setFooterIconUrl("https://example.com/i.png");
        WebhookService service = new WebhookService(null, null, null, null, null);

        var embed = service.buildFormEmbed(form, null, java.util.Map.of(), "dmitry", cfg, java.util.Map.of("server.name", "GTA5RP"));
        assertThat(embed.get("url")).isEqualTo("https://example.com/f/lspd");
        assertThat(embed.get("footer")).isEqualTo(java.util.Map.of("text", "Сервер GTA5RP", "icon_url", "https://example.com/i.png"));
        assertThat(embed).containsKey("timestamp");

        cfg.setTimestamp(false);
        cfg.setFooterText(null);
        embed = service.buildFormEmbed(form, null, java.util.Map.of(), "dmitry", cfg, java.util.Map.of());
        assertThat(embed).doesNotContainKeys("timestamp", "footer");
    }
}
