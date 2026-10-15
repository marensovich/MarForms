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
    void syncsEveryConnectedGuild() {
        // Kicked or not, members and permissions: GuildService.sync decides (#124).
        when(discordBotClient.isAvailable()).thenReturn(true);
        when(guildRepository.findAllByBotStatus(GuildBotStatus.CONNECTED))
                .thenReturn(List.of(guildWith(6001L), guildWith(6002L)));
        var reconciler = new GuildStatusReconciler(guildRepository, guildService, discordBotClient);

        reconciler.reconcile();

        verify(guildService).sync(6001L);
        verify(guildService).sync(6002L);
    }
}
