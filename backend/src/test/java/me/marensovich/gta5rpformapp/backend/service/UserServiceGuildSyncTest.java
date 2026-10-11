package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordApiClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordTokenService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A failed Discord call is not "the user is in no guilds" (#103).
 */
@ExtendWith(MockitoExtension.class)
class UserServiceGuildSyncTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleService roleService;
    @Mock
    private DiscordApiClient discordApiClient;
    @Mock
    private DiscordTokenService discordTokenService;
    @Mock
    private AuditLogService auditLogService;

    private UserService service() {
        return new UserService(userRepository, roleService, discordApiClient, discordTokenService, auditLogService);
    }

    private User user() {
        User user = new User();
        user.setId(7L);
        user.setDiscordId(70L);
        user.setGuildIds(Set.of(1L, 2L));
        user.setGuildsSyncedAt(LocalDateTime.now().minusHours(1));
        return user;
    }

    @Test
    void aFailedFetchKeepsTheKnownGuilds() {
        User user = user();
        when(discordApiClient.fetchUserGuildIds("token")).thenReturn(Optional.empty());

        service().syncGuilds(user, "token");

        assertThat(user.getGuildIds()).containsExactlyInAnyOrder(1L, 2L);
        verify(userRepository, never()).save(any());
    }

    @Test
    void aSuccessfulFetchIsWrittenOntoTheFreshRow() {
        User stale = user();
        User fresh = user();
        fresh.setBannedPermanently(true); // banned while the request was running
        when(discordApiClient.fetchUserGuildIds("token")).thenReturn(Optional.of(Set.of(3L)));
        when(userRepository.findById(7L)).thenReturn(Optional.of(fresh));
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        User saved = service().syncGuilds(stale, "token");

        assertThat(saved).isSameAs(fresh);
        assertThat(saved.getGuildIds()).containsExactly(3L);
        assertThat(saved.isBannedPermanently()).isTrue();
    }
}
