package me.marensovich.gta5rpformapp.backend.service.discord;

import me.marensovich.gta5rpformapp.backend.database.entity.DiscordTokenSet;
import me.marensovich.gta5rpformapp.backend.database.repository.DiscordTokenSetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DiscordTokenServiceTest {

    @Mock
    private DiscordTokenSetRepository repository;
    @Mock
    private DiscordApiClient discordApiClient;
    @Mock
    private jakarta.persistence.EntityManager entityManager;

    private final TokenCipher cipher = new TokenCipher("", "test-secret");
    private DiscordTokenService service;

    @BeforeEach
    void setUp() {
        service = new DiscordTokenService(repository, cipher, discordApiClient, entityManager);
    }

    private DiscordTokenSet storedSet(String access, String refresh, LocalDateTime expiresAt) {
        DiscordTokenSet set = new DiscordTokenSet();
        set.setUserId(1L);
        set.setAccessTokenEncrypted(cipher.encrypt(access));
        set.setRefreshTokenEncrypted(refresh != null ? cipher.encrypt(refresh) : null);
        set.setExpiresAt(expiresAt);
        return set;
    }

    @Test
    void storeEncryptsBothTokens() {
        when(repository.findById(1L)).thenReturn(Optional.empty());

        service.store(1L, "access", "refresh", LocalDateTime.now().plusDays(7), "identify guilds");

        var captor = ArgumentCaptor.forClass(DiscordTokenSet.class);
        verify(repository).save(captor.capture());
        DiscordTokenSet saved = captor.getValue();
        assertThat(saved.getAccessTokenEncrypted()).isNotEqualTo("access");
        assertThat(cipher.decrypt(saved.getAccessTokenEncrypted())).isEqualTo("access");
        assertThat(cipher.decrypt(saved.getRefreshTokenEncrypted())).isEqualTo("refresh");
    }

    @Test
    void returnsTheStoredTokenWithoutRefreshingWhileItIsStillValid() {
        when(repository.findById(1L)).thenReturn(Optional.of(
                storedSet("access", "refresh", LocalDateTime.now().plusHours(2))));

        assertThat(service.getValidAccessToken(1L)).contains("access");
        verifyNoInteractions(discordApiClient);
    }

    @Test
    void refreshesAnExpiredTokenAutomaticallyAndPersistsTheRotatedPair() {
        when(repository.findById(1L)).thenReturn(Optional.of(
                storedSet("old-access", "old-refresh", LocalDateTime.now().minusMinutes(5))));
        when(discordApiClient.refreshAccessToken("old-refresh")).thenReturn(
                new DiscordApiClient.TokenResponse("new-access", "new-refresh", 604800, "identify guilds"));

        assertThat(service.getValidAccessToken(1L)).contains("new-access");

        var captor = ArgumentCaptor.forClass(DiscordTokenSet.class);
        verify(repository).save(captor.capture());
        assertThat(cipher.decrypt(captor.getValue().getRefreshTokenEncrypted())).isEqualTo("new-refresh");
        assertThat(captor.getValue().getExpiresAt()).isAfter(LocalDateTime.now().plusDays(6));
    }

    @Test
    void refreshesATokenThatIsAboutToExpire() {
        when(repository.findById(1L)).thenReturn(Optional.of(
                storedSet("old-access", "old-refresh", LocalDateTime.now().plusSeconds(10))));
        when(discordApiClient.refreshAccessToken("old-refresh")).thenReturn(
                new DiscordApiClient.TokenResponse("new-access", "new-refresh", 604800, null));

        assertThat(service.getValidAccessToken(1L)).contains("new-access");
    }

    @Test
    void dropsTheStoredTokensWhenDiscordRejectsTheRefreshToken() {
        DiscordTokenSet set = storedSet("old-access", "revoked", LocalDateTime.now().minusMinutes(5));
        when(repository.findById(1L)).thenReturn(Optional.of(set));
        when(discordApiClient.refreshAccessToken("revoked")).thenThrow(HttpClientErrorException.create(
                HttpStatus.BAD_REQUEST, "invalid_grant", new HttpHeaders(), new byte[0], null));

        assertThat(service.getValidAccessToken(1L)).isEmpty();
        verify(repository).delete(set);
    }

    @Test
    void keepsTheStoredTokensOnATransientRefreshFailure() {
        when(repository.findById(1L)).thenReturn(Optional.of(
                storedSet("old-access", "refresh", LocalDateTime.now().minusMinutes(5))));
        when(discordApiClient.refreshAccessToken("refresh")).thenThrow(new ResourceAccessException("timeout"));

        assertThat(service.getValidAccessToken(1L)).isEmpty();
        verify(repository, never()).delete(any());
    }

    @Test
    void isEmptyWhenTheUserHasNoStoredTokens() {
        when(repository.findById(1L)).thenReturn(Optional.empty());

        assertThat(service.getValidAccessToken(1L)).isEmpty();
    }

    @Test
    void cannotRefreshWithoutARefreshToken() {
        when(repository.findById(1L)).thenReturn(Optional.of(
                storedSet("old-access", null, LocalDateTime.now().minusMinutes(5))));

        assertThat(service.getValidAccessToken(1L)).isEmpty();
        verifyNoInteractions(discordApiClient);
    }

    @Test
    void aRefreshThatLostTheRaceUsesTheWinnersTokensInsteadOfWipingThem() {
        DiscordTokenSet stale = storedSet("old-access", "old-refresh", LocalDateTime.now().minusMinutes(5));
        when(repository.findById(1L)).thenReturn(Optional.of(stale));
        // Another request refreshed the row meanwhile: the locked re-read sees the rotated pair.
        String rotatedAccess = cipher.encrypt("new-access");
        String rotatedRefresh = cipher.encrypt("new-refresh");
        doAnswer(invocation -> {
            DiscordTokenSet row = invocation.getArgument(0);
            row.setAccessTokenEncrypted(rotatedAccess);
            row.setRefreshTokenEncrypted(rotatedRefresh);
            row.setExpiresAt(LocalDateTime.now().plusDays(7));
            return null;
        }).when(entityManager).refresh(any(DiscordTokenSet.class), eq(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE));

        assertThat(service.getValidAccessToken(1L)).contains("new-access");
        verifyNoInteractions(discordApiClient);
        verify(repository, never()).delete(any());
    }
}
