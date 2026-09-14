package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GuildStatusReconcilerTest {

    @Mock
    private GuildRepository guildRepository;
    @Mock
    private GuildService guildService;
    @Mock
    private DiscordBotClient discordBotClient;

    private Guild guildWith(long discordGuildId) {
        Guild guild = new Guild();
        guild.setDiscordGuildId(discordGuildId);
        guild.setName("guild-" + discordGuildId);
        return guild;
    }

    @Test
    void doesNothingWhenNoBotSessionIsAvailable() {
        when(discordBotClient.isAvailable()).thenReturn(false);
        var reconciler = new GuildStatusReconciler(guildRepository, guildService, discordBotClient);

        reconciler.reconcile();

        verifyNoInteractions(guildRepository);
        verifyNoInteractions(guildService);
    }

    @Test
    void marksAGuildKickedWhenTheBotCanNoLongerSeeIt() {
        when(discordBotClient.isAvailable()).thenReturn(true);
        when(guildRepository.findAllByBotStatus(GuildBotStatus.CONNECTED))
                .thenReturn(List.of(guildWith(6001L)));
        when(discordBotClient.fetchGuild(6001L)).thenReturn(Optional.empty());
        var reconciler = new GuildStatusReconciler(guildRepository, guildService, discordBotClient);

        reconciler.reconcile();

        verify(guildService).markKicked(6001L);
    }

    @Test
    void leavesAGuildAloneWhenTheBotCanStillSeeIt() {
        when(discordBotClient.isAvailable()).thenReturn(true);
        when(guildRepository.findAllByBotStatus(GuildBotStatus.CONNECTED))
                .thenReturn(List.of(guildWith(6002L)));
        when(discordBotClient.fetchGuild(6002L))
                .thenReturn(Optional.of(new DiscordBotClient.DiscordGuildInfo("6002", "Still There", null)));
        var reconciler = new GuildStatusReconciler(guildRepository, guildService, discordBotClient);

        reconciler.reconcile();

        verify(guildService, never()).markKicked(anyLong());
    }
}
