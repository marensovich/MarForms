package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.billing.PlanLimitService;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient.MemberStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Staff roles are re-confirmed with Discord (security audit, #103).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({GuildService.class, GuildMembershipService.class})
class StaffVerificationTest {

    private static final long GUILD = 5101L;

    @MockitoBean
    private AuditLogService auditLogService;
    @MockitoBean
    private PlanLimitService planLimitService;
    @MockitoBean
    private DiscordBotClient bot;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildMembershipService service;

    private GuildMembership member(long discordId, GuildRole role) {
        User user = new User();
        user.setDiscordId(discordId);
        user.setDiscordUsername("u" + discordId);
        userRepository.save(user);
        return service.ensureMembership(discordId, GUILD, role);
    }

    @Test
    void anOwnerWhoLostManageServerIsDemotedAndAudited() {
        GuildMembership owner = member(1L, GuildRole.OWNER);
        when(bot.memberStatus(GUILD, 1L)).thenReturn(MemberStatus.MEMBER);

        assertThat(service.verifyStaffIfStale(owner).getRole()).isEqualTo(GuildRole.RESPONDENT);
        verify(auditLogService).logGuildActionAs(any(), any(), eq(GUILD), eq(AuditAction.GUILD_ROLE_REVOKED),
                any(), eq("1"), any(), any(), any());
    }

    @Test
    void aModeratorWhoLeftTheServerIsDemotedButOneWhoStayedIsNot() {
        GuildMembership gone = member(2L, GuildRole.MODERATOR);
        GuildMembership stayed = member(3L, GuildRole.MODERATOR);
        when(bot.memberStatus(GUILD, 2L)).thenReturn(MemberStatus.NOT_MEMBER);
        when(bot.memberStatus(GUILD, 3L)).thenReturn(MemberStatus.MEMBER);

        assertThat(service.verifyStaffIfStale(gone).getRole()).isEqualTo(GuildRole.RESPONDENT);
        assertThat(service.verifyStaffIfStale(stayed).getRole()).isEqualTo(GuildRole.MODERATOR);
    }

    @Test
    void whenDiscordCantTellTheRoleIsKept() {
        GuildMembership owner = member(4L, GuildRole.OWNER);
        when(bot.memberStatus(GUILD, 4L)).thenReturn(MemberStatus.UNKNOWN);

        assertThat(service.verifyStaffIfStale(owner).getRole()).isEqualTo(GuildRole.OWNER);
        verify(auditLogService, never()).logGuildActionAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void aRecentCheckIsNotRepeatedAndRespondentsAreNeverChecked() {
        GuildMembership owner = member(5L, GuildRole.OWNER);
        owner.setStaffVerifiedAt(LocalDateTime.now());
        GuildMembership respondent = member(6L, GuildRole.RESPONDENT);

        service.verifyStaffIfStale(owner);
        service.verifyStaffIfStale(respondent);
        verify(bot, never()).memberStatus(any(), any());
    }
}
