package me.marensovich.gta5rpformapp.backend.config.security;

import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionFileRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuildAccessGuardTest {

    private static final long USER_ID = 1L;
    private static final long GUILD = 777L;

    @Mock
    private GuildMembershipRepository guildMembershipRepository;
    @Mock
    private FormRepository formRepository;
    @Mock
    private SubmissionRepository submissionRepository;
    @Mock
    private SubmissionFileRepository submissionFileRepository;

    private GuildAccessGuard guard;

    @BeforeEach
    void setUp() {
        guard = new GuildAccessGuard(guildMembershipRepository, formRepository, submissionRepository, submissionFileRepository);
        User user = new User();
        user.setId(USER_ID);
        user.setDiscordId(42L);
        user.setDiscordUsername("tester");
        var details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void memberAs(GuildRole role) {
        GuildMembership membership = new GuildMembership();
        membership.setRole(role);
        lenient().when(guildMembershipRepository.findByUser_IdAndGuild_DiscordGuildId(USER_ID, GUILD))
                .thenReturn(Optional.of(membership));
    }

    @ParameterizedTest(name = "{0} vs required {1} -> {2}")
    @CsvSource({
            "OWNER, OWNER, true",
            "OWNER, MODERATOR, true",
            "OWNER, RESPONDENT, true",
            "MODERATOR, OWNER, false",
            "MODERATOR, MODERATOR, true",
            "MODERATOR, RESPONDENT, true",
            "RESPONDENT, OWNER, false",
            "RESPONDENT, MODERATOR, false",
            "RESPONDENT, RESPONDENT, true",
    })
    void appliesTheRoleHierarchy(GuildRole actual, String required, boolean expected) {
        memberAs(actual);

        assertThat(guard.hasRole(GUILD, required)).isEqualTo(expected);
    }

    @Test
    void deniesWithoutAMembership() {
        when(guildMembershipRepository.findByUser_IdAndGuild_DiscordGuildId(anyLong(), anyLong()))
                .thenReturn(Optional.empty());

        assertThat(guard.hasRole(GUILD, "RESPONDENT")).isFalse();
    }

    @Test
    void deniesWithoutAnAuthenticatedUser() {
        SecurityContextHolder.clearContext();

        assertThat(guard.hasRole(GUILD, "RESPONDENT")).isFalse();
    }

    @Test
    void acceptsTheGuildIdAsAStringFromRequestBodies() {
        memberAs(GuildRole.OWNER);

        assertThat(guard.hasRole(String.valueOf(GUILD), "OWNER")).isTrue();
        assertThat(guard.hasRole("not-a-number", "OWNER")).isFalse();
        assertThat(guard.hasRole(null, "OWNER")).isFalse();
    }

    @Test
    void resolvesTheGuildFromAForm() {
        memberAs(GuildRole.MODERATOR);
        UUID formId = UUID.randomUUID();
        Form form = new Form();
        form.setServerId(GUILD);
        when(formRepository.findById(formId)).thenReturn(Optional.of(form));

        assertThat(guard.hasRoleForForm(formId, "MODERATOR")).isTrue();
        assertThat(guard.hasRoleForForm(formId, "OWNER")).isFalse();
    }

    @Test
    void deniesForAFormThatDoesNotExist() {
        when(formRepository.findById(org.mockito.ArgumentMatchers.any())).thenReturn(Optional.empty());

        assertThat(guard.hasRoleForForm(UUID.randomUUID(), "RESPONDENT")).isFalse();
    }

    @Test
    void resolvesTheGuildFromASubmission() {
        memberAs(GuildRole.MODERATOR);
        UUID formId = UUID.randomUUID();
        UUID submissionId = UUID.randomUUID();
        Form form = new Form();
        form.setServerId(GUILD);
        Submission submission = new Submission();
        submission.setFormId(formId);
        when(submissionRepository.findById(submissionId)).thenReturn(Optional.of(submission));
        when(formRepository.findById(formId)).thenReturn(Optional.of(form));

        assertThat(guard.hasRoleForSubmission(submissionId, "MODERATOR")).isTrue();
    }
}
