package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({GuildService.class, GuildMembershipService.class})
@TestPropertySource(properties = "app.discord.member-roles-ttl=PT5M")
class GuildMembershipRoleSyncTest {

    // Audit entries are covered by GuildAuditControllerTest.
    @MockitoBean
    private AuditLogService auditLogService;
    @MockitoBean
    private me.marensovich.gta5rpformapp.backend.service.billing.PlanLimitService planLimitService;

    private static final long USER = 5001L;
    private static final long GUILD = 6001L;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;
    @Autowired
    private GuildMembershipService guildMembershipService;

    @MockitoBean
    private DiscordBotClient discordBotClient;

    private void persistMember() {
        User user = new User();
        user.setDiscordId(USER);
        user.setDiscordUsername("member");
        userRepository.save(user);
        guildMembershipService.ensureMembership(USER, GUILD, GuildRole.RESPONDENT);
    }

    private void ageTheCache(int minutes) {
        var membership = guildMembershipRepository.findByUser_DiscordIdAndGuild_DiscordGuildId(USER, GUILD).orElseThrow();
        membership.setDiscordRolesSyncedAt(LocalDateTime.now().minusMinutes(minutes));
        guildMembershipRepository.save(membership);
    }

    @Test
    void fetchesAndCachesRolesOnFirstVisit() {
        persistMember();
        when(discordBotClient.fetchMemberRoleIds(GUILD, USER)).thenReturn(Optional.of(List.of(11L, 22L)));

        var membership = guildMembershipService.syncDiscordRolesIfStale(USER, GUILD).orElseThrow();

        assertThat(membership.getDiscordRoles()).containsExactly(11L, 22L);
        assertThat(membership.getDiscordRolesSyncedAt()).isNotNull();
    }

    @Test
    void doesNotHitDiscordAgainWithinTheTtl() {
        persistMember();
        when(discordBotClient.fetchMemberRoleIds(GUILD, USER)).thenReturn(Optional.of(List.of(11L)));

        guildMembershipService.syncDiscordRolesIfStale(USER, GUILD);
        guildMembershipService.syncDiscordRolesIfStale(USER, GUILD);

        verify(discordBotClient, times(1)).fetchMemberRoleIds(GUILD, USER);
    }

    @Test
    void refetchesOnceTheTtlHasExpired() {
        persistMember();
        when(discordBotClient.fetchMemberRoleIds(GUILD, USER))
                .thenReturn(Optional.of(List.of(11L)))
                .thenReturn(Optional.of(List.of(33L)));

        guildMembershipService.syncDiscordRolesIfStale(USER, GUILD);
        ageTheCache(6);
        var membership = guildMembershipService.syncDiscordRolesIfStale(USER, GUILD).orElseThrow();

        assertThat(membership.getDiscordRoles()).containsExactly(33L);
        verify(discordBotClient, times(2)).fetchMemberRoleIds(GUILD, USER);
    }

    @Test
    void keepsTheStaleCacheWhenTheBotCannotAnswer() {
        persistMember();
        when(discordBotClient.fetchMemberRoleIds(GUILD, USER))
                .thenReturn(Optional.of(List.of(11L)))
                .thenReturn(Optional.empty());

        guildMembershipService.syncDiscordRolesIfStale(USER, GUILD);
        ageTheCache(6);
        var membership = guildMembershipService.syncDiscordRolesIfStale(USER, GUILD).orElseThrow();

        assertThat(membership.getDiscordRoles()).containsExactly(11L);
    }

    @Test
    void isEmptyWithoutAMembershipRow() {
        assertThat(guildMembershipService.syncDiscordRolesIfStale(9999L, GUILD)).isEmpty();
        verifyNoInteractions(discordBotClient);
    }
}
