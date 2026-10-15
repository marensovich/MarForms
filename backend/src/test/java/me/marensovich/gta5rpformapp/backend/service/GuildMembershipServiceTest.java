package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
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
@Import({GuildService.class, NotificationService.class, GuildMembershipService.class, DiscordBotClient.class})
class GuildMembershipServiceTest {

    // Audit entries are covered by GuildAuditControllerTest.
    @MockitoBean
    private AuditLogService auditLogService;
    @MockitoBean
    private me.marensovich.gta5rpformapp.backend.service.billing.PlanLimitService planLimitService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GuildMembershipService guildMembershipService;

    private User persistUser(long discordId) {
        User user = new User();
        user.setDiscordId(discordId);
        user.setDiscordUsername("tester-" + discordId);
        return userRepository.save(user);
    }

    @Test
    void createsARespondentMembershipOnFirstAccess() {
        persistUser(3001L);

        var membership = guildMembershipService.ensureMembership(3001L, 4001L, GuildRole.RESPONDENT);

        assertThat(membership.getRole()).isEqualTo(GuildRole.RESPONDENT);
        assertThat(membership.getGuild().getDiscordGuildId()).isEqualTo(4001L);
    }

    @Test
    void upgradesARespondentToOwnerWhenTheySubsequentlyCreateAForm() {
        persistUser(3002L);

        guildMembershipService.ensureMembership(3002L, 4002L, GuildRole.RESPONDENT);
        var upgraded = guildMembershipService.ensureMembership(3002L, 4002L, GuildRole.OWNER);

        assertThat(upgraded.getRole()).isEqualTo(GuildRole.OWNER);
    }

    @Test
    void neverDowngradesAnExistingOwnerBackToRespondent() {
        persistUser(3003L);

        guildMembershipService.ensureMembership(3003L, 4003L, GuildRole.OWNER);
        var stillOwner = guildMembershipService.ensureMembership(3003L, 4003L, GuildRole.RESPONDENT);

        assertThat(stillOwner.getRole()).isEqualTo(GuildRole.OWNER);
    }

    @Test
    void reusesTheSameGuildRowAcrossMultipleUsers() {
        persistUser(3004L);
        persistUser(3005L);

        var first = guildMembershipService.ensureMembership(3004L, 4004L, GuildRole.OWNER);
        var second = guildMembershipService.ensureMembership(3005L, 4004L, GuildRole.RESPONDENT);

        assertThat(first.getGuild().getDiscordGuildId()).isEqualTo(second.getGuild().getDiscordGuildId());
    }
}
