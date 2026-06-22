package me.marensovich.gta5rpformapp.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

/**
 * Custom OAuth2 authorization request resolver that disables PKCE (Proof Key for Code Exchange).
 * <p>
 * This resolver wraps the default OAuth2 authorization request resolver and removes
 * PKCE-related parameters (code_challenge, code_challenge_method, code_verifier)
 * from the authorization request. This is useful when the OAuth2 provider (Discord)
 * does not support PKCE or when compatibility with older clients is required.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Component
public class NoPkceAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    /**
     * Constructs a new {@code NoPkceAuthorizationRequestResolver}.
     *
     * @param repo the {@link ClientRegistrationRepository} containing OAuth2 client configurations
     * @since v.0.1
     */
    public NoPkceAuthorizationRequestResolver(ClientRegistrationRepository repo) {
        this.delegate = new DefaultOAuth2AuthorizationRequestResolver(
                repo, "/oauth2/authorization"
        );
    }

    /**
     * Resolves the OAuth2 authorization request for the given HTTP request.
     *
     * @param request the HTTP request
     * @return the resolved {@link OAuth2AuthorizationRequest} with PKCE parameters removed,
     *         or {@code null} if resolution fails
     * @since v.0.1
     */
    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return stripPkce(delegate.resolve(request));
    }

    /**
     * Resolves the OAuth2 authorization request for the given HTTP request and client registration ID.
     *
     * @param request             the HTTP request
     * @param clientRegistrationId the client registration ID
     * @return the resolved {@link OAuth2AuthorizationRequest} with PKCE parameters removed,
     *         or {@code null} if resolution fails
     * @since v.0.1
     */
    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        return stripPkce(delegate.resolve(request, clientRegistrationId));
    }

    /**
     * Removes PKCE-related parameters from the OAuth2 authorization request.
     * <p>
     * Removes the following parameters:
     * <ul>
     *     <li>{@code code_challenge}</li>
     *     <li>{@code code_challenge_method}</li>
     *     <li>{@code code_verifier}</li>
     * </ul>
     * </p>
     *
     * @param request the original {@link OAuth2AuthorizationRequest}
     * @return a new {@link OAuth2AuthorizationRequest} without PKCE parameters,
     *         or {@code null} if the original request is {@code null}
     * @since v.0.1
     */
    private OAuth2AuthorizationRequest stripPkce(OAuth2AuthorizationRequest request) {
        if (request == null) return null;

        return OAuth2AuthorizationRequest.from(request)
                .additionalParameters(params -> {
                    params.remove("code_challenge");
                    params.remove("code_challenge_method");
                })
                .attributes(attrs -> attrs.remove("code_verifier"))
                .build();
    }
}