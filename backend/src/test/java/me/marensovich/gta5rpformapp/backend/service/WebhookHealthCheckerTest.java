package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookHealth;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient.ChannelAccess;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookLookup;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookLookup.Result;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookLookup.State;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Background webhook health check (E2.4, #73).
 */
class WebhookHealthCheckerTest {

    private static final String URL = "https://discord.com/api/webhooks/111/token-abc";
    private static final long GUILD = 9001L;
    private static final long CHANNEL = 9002L;

    private FormRepository formRepository;
    private FormService formService;
    private DiscordBotClient bot;
    private DiscordWebhookLookup lookup;
    private WebhookHealthChecker checker;
    private Form form;
    private WebhookConfig webhook;

    @BeforeEach
    void setUp() {
        formRepository = mock(FormRepository.class);
        formService = mock(FormService.class);
        bot = mock(DiscordBotClient.class);
        lookup = mock(DiscordWebhookLookup.class);
        checker = new WebhookHealthChecker(formRepository, formService, bot, lookup);

        webhook = new WebhookConfig();
        webhook.setUrl(URL);
        form = new Form();
        form.setId(UUID.randomUUID());
        form.setServerId(GUILD);
        form.setWebhooks(new ArrayList<>(List.of(webhook)));

        when(bot.isAvailable()).thenReturn(true);
        when(formRepository.findAllByStatusNot(FormStatus.ARCHIVED)).thenReturn(List.of(form));
        when(lookup.lookup(URL)).thenReturn(new Result(State.FOUND, GUILD, CHANNEL));
    }

    @Test
    void aDeletedWebhookBecomesInvalid() {
        when(lookup.lookup(URL)).thenReturn(new Result(State.GONE, null, null));

        checker.checkAll();

        verify(formService).updateWebhookHealth(eq(form.getId()), eq(URL), eq(WebhookHealth.INVALID),
                eq(WebhookHealth.REASON_WEBHOOK_DELETED), anyString());
    }

    @Test
    void lostManageWebhooksOnTheChannelDegradesWithoutTheBotBeingKicked() {
        when(bot.checkChannelAccess(GUILD, CHANNEL)).thenReturn(ChannelAccess.MISSING_PERMISSIONS);

        checker.checkAll();

        verify(formService).updateWebhookHealth(eq(form.getId()), eq(URL), eq(WebhookHealth.DEGRADED),
                eq(WebhookHealth.REASON_MISSING_PERMISSIONS), anyString());
    }

    @Test
    void regainedAccessRecovers_butADeliveryFailureIsLeftForDeliveryToClear() {
        when(bot.checkChannelAccess(GUILD, CHANNEL)).thenReturn(ChannelAccess.OK);
        webhook.setHealth(WebhookHealth.DEGRADED);
        webhook.setHealthReason(WebhookHealth.REASON_MISSING_PERMISSIONS);

        checker.checkAll();
        verify(formService).updateWebhookHealth(eq(form.getId()), eq(URL), eq(WebhookHealth.HEALTHY), isNull(), isNull());

        formService = mock(FormService.class);
        checker = new WebhookHealthChecker(formRepository, formService, bot, lookup);
        webhook.setHealthReason(WebhookHealth.REASON_DELIVERY_FAILING);
        checker.checkAll();
        verify(formService, never()).updateWebhookHealth(any(), any(), any(), any(), any());
    }

    @Test
    void nothingIsWrittenWhenNothingChangedOrNothingCanBeConcluded() {
        when(bot.checkChannelAccess(GUILD, CHANNEL)).thenReturn(ChannelAccess.OK);
        checker.checkAll();

        when(lookup.lookup(URL)).thenReturn(new Result(State.UNKNOWN, null, null));
        checker.checkAll();

        when(bot.isAvailable()).thenReturn(false);
        when(lookup.lookup(URL)).thenReturn(new Result(State.GONE, null, null));
        checker.checkAll();

        verify(formService, never()).updateWebhookHealth(any(), any(), any(), any(), any());
    }
}
