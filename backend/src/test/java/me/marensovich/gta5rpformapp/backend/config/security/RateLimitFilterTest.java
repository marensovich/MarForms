package me.marensovich.gta5rpformapp.backend.config.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private final RateLimitFilter filter = new RateLimitFilter(true, 3, 2, 5, 100);

    private int call(String method, String path, String ip) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr(ip);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }

    @Test
    void submissionsArePerClientAndPerMinute() throws Exception {
        String path = "/api/v1/public/forms/slug/submissions";
        assertThat(call("POST", path, "1.1.1.1")).isEqualTo(200);
        assertThat(call("POST", path, "1.1.1.1")).isEqualTo(200);
        assertThat(call("POST", path, "1.1.1.1")).isEqualTo(429);
        // Another client has its own budget.
        assertThat(call("POST", path, "2.2.2.2")).isEqualTo(200);
    }

    @Test
    void uploadsHaveTheirOwnLimitAndPrivateApiIsNotLimited() throws Exception {
        for (int i = 0; i < 3; i++) assertThat(call("POST", "/api/v1/public/forms/s/files", "3.3.3.3")).isEqualTo(200);
        assertThat(call("POST", "/api/v1/public/forms/s/files", "3.3.3.3")).isEqualTo(429);
        for (int i = 0; i < 10; i++) assertThat(call("GET", "/api/v1/me", "3.3.3.3")).isEqualTo(200);
    }

    @Test
    void disabledMeansNoLimit() throws Exception {
        RateLimitFilter off = new RateLimitFilter(false, 1, 1, 1, 1);
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/public/forms/s/submissions");
            MockHttpServletResponse response = new MockHttpServletResponse();
            off.doFilter(request, response, new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(200);
        }
    }
}
