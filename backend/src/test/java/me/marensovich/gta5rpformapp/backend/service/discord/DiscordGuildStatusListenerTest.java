package me.marensovich.gta5rpformapp.backend.service.discord;

import me.marensovich.gta5rpformapp.backend.service.GuildService;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.events.guild.GuildLeaveEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DiscordGuildStatusListenerTest {

    @Mock
    private JDA jda;
    @Mock
    private Guild guild;
    @Mock
    private GuildService guildService;

    @Test
    void registersItselfOnTheJdaSessionWhenOneExists() {
        var listener = new DiscordGuildStatusListener(jda, guildService);

        listener.register();

        verify(jda).addEventListener(listener);
    }

    @Test
    void doesNotFailToRegisterWhenNoBotSessionExists() {
        var listener = new DiscordGuildStatusListener(null, guildService);

        listener.register();

        verifyNoInteractions(guildService);
    }

    @Test
    void marksTheGuildKickedWhenTheBotLeaves() {
        when(guild.getIdLong()).thenReturn(7001L);
        var listener = new DiscordGuildStatusListener(jda, guildService);

        listener.onGuildLeave(new GuildLeaveEvent(jda, 1L, guild));

        verify(guildService).markKicked(7001L);
    }
}
