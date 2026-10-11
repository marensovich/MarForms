package me.marensovich.gta5rpformapp.backend.service.discord;

import jakarta.persistence.EntityManager;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Webhook URLs are encrypted at rest (#57): the column never holds the
 * token, while the entity and the API keep seeing the plain URL.
 */
@SpringBootTest
@Transactional
class WebhookUrlEncryptionTest {

    private static final String URL = "https://discord.com/api/webhooks/123456789/secret-Token_value";

    @Autowired
    private FormRepository formRepository;
    @Autowired
    private EntityManager entityManager;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private WebhookUrlCipher cipher;

    @Test
    void formWebhooksAreStoredEncryptedAndReadBackPlain() {
        WebhookConfig webhook = new WebhookConfig();
        webhook.setUrl(URL);
        webhook.setBotName("Bot");
        FormSchema schema = new FormSchema();
        schema.setTitle("Encrypted");
        Form form = new Form();
        form.setServerId(42L);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setSlug("encrypted-webhooks");
        form.setWebhooks(List.of(webhook));
        form = formRepository.saveAndFlush(form);
        entityManager.clear();

        String raw = jdbc.queryForObject("SELECT CAST(webhooks AS VARCHAR) FROM form WHERE id = ?", String.class, form.getId());
        assertThat(raw).doesNotContain("secret-Token_value").contains(WebhookUrlCipher.PREFIX).contains("Bot");

        Form loaded = formRepository.findById(form.getId()).orElseThrow();
        assertThat(loaded.getWebhooks()).extracting(WebhookConfig::getUrl).containsExactly(URL);
    }

    @Test
    void sealOpensBackAndPassesLegacyPlainValues() {
        String sealed = cipher.seal(URL);
        assertThat(sealed).startsWith(WebhookUrlCipher.PREFIX).doesNotContain("secret");
        assertThat(cipher.seal(URL)).isNotEqualTo(sealed);
        assertThat(cipher.open(sealed)).isEqualTo(URL);
        assertThat(cipher.open(URL)).isEqualTo(URL);
        assertThat(cipher.seal(null)).isNull();
    }

    @Test
    void userInputThatLooksSealedIsNotTreatedAsCiphertext() {
        String fake = WebhookUrlCipher.PREFIX + "bogus";
        assertThat(cipher.open(cipher.seal(fake))).isEqualTo(fake);
    }

    @Test
    void redactHidesTokensInUrlsAndErrorMessages() {
        assertThat(WebhookUrlCipher.redact("404 on POST request for \"" + URL + "?wait=true\""))
                .isEqualTo("404 on POST request for \"https://discord.com/api/webhooks/123456789/***?wait=true\"");
        assertThat(WebhookUrlCipher.redact(null)).isNull();
    }
}
