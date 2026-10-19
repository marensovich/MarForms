package me.marensovich.gta5rpformapp.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

/** The single image: the backend serves the SPA, and its pages open by deep link. */
@SpringBootTest
@AutoConfigureMockMvc
class SpaConfigTest {

    private static final Resource SPA = new ClassPathResource("spa/");

    @Autowired
    private MockMvc mvc;

    private static String resolve(String path) throws Exception {
        Resource r = new SpaConfig.SpaResolver().getResource(path, SPA);
        return r == null ? null : r.getFilename();
    }

    @Test
    void aPageOfTheAppGetsIndexAndAFileItself() throws Exception {
        assertThat(resolve("f/lspd")).isEqualTo("index.html");
        assertThat(resolve("dashboard/servers/1/forms")).isEqualTo("index.html");
        assertThat(resolve("login")).isEqualTo("index.html");
        assertThat(resolve("assets/app-1a2b.js")).isEqualTo("app-1a2b.js");
    }

    @Test
    void theBackendsPathsAndMissingFilesStayNotFound() throws Exception {
        assertThat(resolve("api/v1/nothing")).isNull();
        assertThat(resolve("oauth2/whatever")).isNull();
        assertThat(resolve("login/oauth2/code/discord")).isNull();
        assertThat(resolve("assets/gone-9f9f.js")).isNull();
        assertThat(resolve("favicon.ico")).isNull();
    }

    @Test
    void springDrawsNoSignInPageOverTheApps() throws Exception {
        mvc.perform(get("/login")).andExpect(content().string(not(containsString("Login with OAuth 2.0"))));
    }
}
