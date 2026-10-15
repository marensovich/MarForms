package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.AuditLogRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.GuildConnectService;
import me.marensovich.gta5rpformapp.backend.service.LoginCodeService;
import me.marensovich.gta5rpformapp.backend.config.AuthCookies;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient.GuildManagerCheck;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression tests for the two critical findings of the security audit
 * (#103): no token for a bare Discord ID, and no guild ownership from a
 * forged bot-install callback.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthSecurityTest {

    private static final long GUILD = 9301L;
    private static final String DASHBOARD = "http://localhost:5173/dashboard/servers";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;
    @Autowired
    private GuildConnectService guildConnectService;
    @Autowired
    private LoginCodeService loginCodeService;
    @Autowired
    private ObjectMapper objectMapper;
    @MockitoBean
    private DiscordBotClient botClient;

    private User installer;

    @BeforeEach
    void setUp() {
        installer = new User();
        installer.setDiscordId(77L);
        installer.setDiscordUsername("installer");
        installer = userRepository.save(installer);
    }

    @Test
    void thereIsNoManualLoginEndpoint() throws Exception {
        var result = mvc.perform(post("/api/v1/auth/discord")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"discordId\":\"77\",\"username\":\"x\"}"))
                .andReturn().getResponse();
        assertThat(result.getStatus()).isGreaterThanOrEqualTo(400);
        assertThat(result.getContentAsString()).doesNotContain("token");
    }

    @Test
    void aSessionTokenIsNotAcceptedAsInstallState() throws Exception {
        when(botClient.checkGuildManager(any(), any())).thenReturn(GuildManagerCheck.MANAGER);
        String jwt = jwtUtil.generateToken(installer.getDiscordId());

        mvc.perform(get("/api/v1/guilds/connect/callback").param("guild_id", String.valueOf(GUILD)).param("state", jwt))
                .andExpect(redirectedUrl(DASHBOARD + "?guildConnectError=state"));
        assertThat(ownsGuild()).isFalse();
    }

    @Test
    void aVerifiedInstallGrantsOwnerOnceAndIsAudited() throws Exception {
        when(botClient.checkGuildManager(GUILD, installer.getDiscordId())).thenReturn(GuildManagerCheck.MANAGER);
        String state = guildConnectService.start(installer.getDiscordId());

        mvc.perform(get("/api/v1/guilds/connect/callback").param("guild_id", String.valueOf(GUILD)).param("state", state))
                .andExpect(redirectedUrl(DASHBOARD + "?connectedGuild=" + GUILD));
        assertThat(ownsGuild()).isTrue();
        assertThat(auditLogRepository.findAll()).anyMatch(e ->
                e.getAction() == AuditAction.GUILD_CONNECTED && Long.valueOf(GUILD).equals(e.getGuildId()));

        // The state is single-use.
        mvc.perform(get("/api/v1/guilds/connect/callback").param("guild_id", "9302").param("state", state))
                .andExpect(redirectedUrl(DASHBOARD + "?guildConnectError=state"));
    }

    @Test
    void aUserWhoDoesNotManageTheGuildIsRefused() throws Exception {
        when(botClient.checkGuildManager(GUILD, installer.getDiscordId())).thenReturn(GuildManagerCheck.NOT_MANAGER);
        String state = guildConnectService.start(installer.getDiscordId());

        mvc.perform(get("/api/v1/guilds/connect/callback").param("guild_id", String.valueOf(GUILD)).param("state", state))
                .andExpect(redirectedUrl(DASHBOARD + "?guildConnectError=manager"));
        assertThat(ownsGuild()).isFalse();
    }

    @Test
    void aGuildWithoutTheBotIsRefused() throws Exception {
        when(botClient.checkGuildManager(GUILD, installer.getDiscordId())).thenReturn(GuildManagerCheck.BOT_NOT_IN_GUILD);
        String state = guildConnectService.start(installer.getDiscordId());

        mvc.perform(get("/api/v1/guilds/connect/callback").param("guild_id", String.valueOf(GUILD)).param("state", state))
                .andExpect(redirectedUrl(DASHBOARD + "?guildConnectError=bot"));
        assertThat(ownsGuild()).isFalse();
    }

    @Test
    void anyUserMayStartAnInstallButNotEndlessly() throws Exception {
        // installer has no platform role (#151): Discord decides in the callback.
        String jwt = jwtUtil.generateToken(installer.getDiscordId());
        for (int i = 0; i < 10; i++) {
            mvc.perform(get("/api/v1/guilds/connect").header("Authorization", "Bearer " + jwt))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/api/v1/guilds/connect").header("Authorization", "Bearer " + jwt))
                .andExpect(status().isTooManyRequests());
        mvc.perform(get("/api/v1/guilds/connect")).andExpect(status().isUnauthorized());
    }

    private boolean ownsGuild() {
        return guildMembershipRepository.findByUser_IdAndGuild_DiscordGuildId(installer.getId(), GUILD)
                .map(m -> m.getRole() == GuildRole.OWNER).orElse(false);
    }

    @Test
    void aSignInCodeNeedsItsCookieAndWorksOnce() throws Exception {
        LoginCodeService.Issued issued = loginCodeService.issue(installer.getDiscordId());
        String body = "{\"code\":\"" + issued.code() + "\"}";

        // Without the browser-bound cookie (a code handed to someone else): refused, and burnt.
        mvc.perform(post("/api/v1/auth/exchange").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/exchange").contentType(MediaType.APPLICATION_JSON).content(body)
                        .cookie(new Cookie(AuthCookies.LOGIN_NONCE, issued.nonce())))
                .andExpect(status().isUnauthorized());

        LoginCodeService.Issued fresh = loginCodeService.issue(installer.getDiscordId());
        String token = objectMapper.readTree(mvc.perform(post("/api/v1/auth/exchange")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + fresh.code() + "\"}")
                        .cookie(new Cookie(AuthCookies.LOGIN_NONCE, fresh.nonce())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("token").asText();
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }

    @Test
    void logoutRevokesEveryTokenIssuedBefore() throws Exception {
        String token = jwtUtil.generateToken(installer.getDiscordId(), installer.getTokenVersion());
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());

        mvc.perform(post("/api/v1/auth/logout").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }
}
