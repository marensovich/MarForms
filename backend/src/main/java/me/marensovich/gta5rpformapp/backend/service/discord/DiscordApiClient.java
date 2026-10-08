package me.marensovich.gta5rpformapp.backend.service.discord;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Client for interacting with the Discord API.
 * <p>
 * Provides methods for fetching user data from Discord, such as
 * the list of guilds (servers) a user is a member of.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
public class DiscordApiClient {

    private static final String DISCORD_API_BASE = "https://discord.com/api";

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${spring.security.oauth2.client.registration.discord.client-id}")
    private String clientId;

    @Value("${spring.security.oauth2.client.registration.discord.client-secret}")
    private String clientSecret;

    /**
     * Fetches the list of guild IDs the user is a member of.
     * <p>
     * Uses the user's OAuth2 access token to authenticate with Discord's API.
     * Requires the {@code guilds} scope to have been granted during OAuth2 login.
     * If the request fails, returns an empty set and logs a warning.
     * </p>
     *
     * @param accessToken the user's Discord OAuth2 access token
     * @return a set of guild (server) IDs, or an empty set if the request fails
     * @since v.0.1
     */
    public Set<Long> fetchUserGuildIds(String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<List<DiscordGuild>> response = restTemplate.exchange(
                    DISCORD_API_BASE + "/users/@me/guilds",
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<List<DiscordGuild>>() {
                    }
            );

            List<DiscordGuild> guilds = response.getBody();
            if (guilds == null) {
                return Set.of();
            }

            return guilds.stream()
                    .map(g -> Long.parseLong(g.id()))
                    .collect(Collectors.toSet());
        } catch (Exception e) {
            log.warn("Failed to fetch Discord guilds for user: {}", e.getMessage());
            return Set.of();
        }
    }

    /**
     * Exchanges a refresh token for a new access/refresh token pair
     * ({@code POST /oauth2/token}, {@code grant_type=refresh_token}).
     * <p>
     * Unlike {@link #fetchUserGuildIds}, this throws on failure — the caller
     * ({@code DiscordTokenService}) needs to tell a revoked refresh token
     * (4xx, drop the stored tokens) apart from a transient error.
     * </p>
     *
     * @param refreshToken the user's current refresh token
     * @return the new token pair
     * @throws org.springframework.web.client.RestClientException if Discord rejects the request
     * @since v.0.1
     */
    public TokenResponse refreshAccessToken(String refreshToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setBasicAuth(clientId, clientSecret);

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("refresh_token", refreshToken);

        TokenResponse body = restTemplate.postForObject(
                DISCORD_API_BASE + "/oauth2/token", new HttpEntity<>(form, headers), TokenResponse.class);
        if (body == null || body.accessToken() == null) {
            throw new IllegalStateException("Discord returned an empty token response");
        }
        return body;
    }

    /**
     * Discord's OAuth2 token endpoint response.
     *
     * @param accessToken  the new access token
     * @param refreshToken the new refresh token (Discord rotates it on every refresh)
     * @param expiresIn    access token lifetime, in seconds
     * @param scope        the granted scopes, space-separated
     * @since v.0.1
     */
    public record TokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("refresh_token") String refreshToken,
            @JsonProperty("expires_in") long expiresIn,
            @JsonProperty("scope") String scope
    ) {
    }

    /**
     * Internal record representing a Discord guild (server) returned from the API.
     *
     * @param id   the guild ID as a string
     * @param name the guild name
     * @since v.0.1
     */
    private record DiscordGuild(String id, String name) {
    }
}