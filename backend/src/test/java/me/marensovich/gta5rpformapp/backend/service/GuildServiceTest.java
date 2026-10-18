package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({GuildService.class, NotificationService.class, DiscordBotClient.class})
class GuildServiceTest {

    @Autowired
    private GuildService guildService;

    @MockitoBean
    private AuditLogService auditLogService;

    @Test
    void marksAnExistingGuildAsKicked() {
        var guild = guildService.getOrCreate(5001L);
        assertThat(guild.getBotStatus()).isEqualTo(GuildBotStatus.CONNECTED);

        guildService.markKicked(5001L);

        assertThat(guildService.getOrCreate(5001L).getBotStatus()).isEqualTo(GuildBotStatus.KICKED);
    }

    @Test
    void reconnectingAKickedGuildMarksItConnectedAgain() {
        guildService.getOrCreate(5002L);
        guildService.markKicked(5002L);

        guildService.markConnected(5002L);

        assertThat(guildService.getOrCreate(5002L).getBotStatus()).isEqualTo(GuildBotStatus.CONNECTED);
    }

    @Test
    void markKickedIsANoOpForAGuildThatDoesNotExistYet() {
        guildService.markKicked(5003L);

        assertThat(guildService.getOrCreate(5003L).getBotStatus()).isEqualTo(GuildBotStatus.CONNECTED);
    }
}
