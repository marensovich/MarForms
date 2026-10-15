package me.marensovich.gta5rpformapp.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A failed Discord sign-in lands on the SPA with an error code (ТЗ ФТ-3.2.4).
 */
class OAuthFailureHandlerTest {

    @Test
    void redirectsToTheCallbackPageWithTheCodeAndAReference() throws Exception {
        OAuthFailureHandler handler = new OAuthFailureHandler();
        ReflectionTestUtils.setField(handler, "frontendUrl", "http://app");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationFailure(new MockHttpServletRequest(), response,
                new OAuth2AuthenticationException(new OAuth2Error("access_denied")));

        assertThat(response.getRedirectedUrl()).matches("http://app/auth\\?error=access_denied&ref=[0-9a-f]{8}");
    }

    @Test
    void anythingElseIsAServerError() {
        assertThat(OAuthFailureHandler.errorCode(new BadCredentialsException("x"))).isEqualTo("server_error");
        assertThat(OAuthFailureHandler.errorCode(new OAuth2AuthenticationException(new OAuth2Error("<script>"))))
                .isEqualTo("server_error");
    }
}
