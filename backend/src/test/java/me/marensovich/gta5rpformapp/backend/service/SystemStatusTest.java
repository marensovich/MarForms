package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookHealth;
import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * «Система» (ТЗ 6.6, #147): the server's state with the build and the
 * background work, and the update check against GitHub, cached for an hour.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SystemStatusTest {

    private static final String RELEASES = "https://api.github.com/repos/marensovich/MarForms/releases/latest";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private OutboundJobRepository outboundJobRepository;
    @Autowired
    private SystemStatusService systemStatusService;
    @Autowired
    private UpdateCheckService updateCheckService;
    @MockitoBean
    private RestTemplate restTemplate;

    private User root;
    private User staff;

    @BeforeEach
    void setUp() {
        systemStatusService.forget();
        updateCheckService.forget();
        root = user(91L, Permission.SYSTEM_ADMIN);
        staff = user(92L, Permission.DASHBOARD_ACCESS, Permission.FORMS_MANAGE);
    }

    @Test
    void reportsTheMachineTheBuildTheQueueAndWebhooks() throws Exception {
        job(OutboundJobStatus.PENDING, LocalDateTime.now());
        job(OutboundJobStatus.FAILED, LocalDateTime.now());
        job(OutboundJobStatus.SUCCEEDED, LocalDateTime.now().minusHours(2));
        job(OutboundJobStatus.SUCCEEDED, LocalDateTime.now().minusDays(2));
        form(WebhookHealth.HEALTHY, WebhookHealth.HEALTHY, WebhookHealth.DEGRADED, WebhookHealth.INVALID);

        mvc.perform(as(root, get("/api/v1/system/info")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpu.cores").isNumber())
                .andExpect(jsonPath("$.ram.heapMax").isNumber())
                .andExpect(jsonPath("$.disk.total").isNumber())
                .andExpect(jsonPath("$.about.version").value("0.0.1-SNAPSHOT"))
                .andExpect(jsonPath("$.jobs.queued").value(1))
                .andExpect(jsonPath("$.jobs.failed").value(1))
                .andExpect(jsonPath("$.jobs.succeeded24h").value(1))
                .andExpect(jsonPath("$.webhooks.healthy").value(2))
                .andExpect(jsonPath("$.webhooks.degraded").value(1))
                .andExpect(jsonPath("$.webhooks.invalid").value(1));
        mvc.perform(as(staff, get("/api/v1/system/info"))).andExpect(status().isForbidden());
    }

    @Test
    void comparesTheLatestReleaseAndAsksGitHubAtMostOnceAnHourUnlessForced() throws Exception {
        when(restTemplate.exchange(eq(RELEASES), eq(HttpMethod.GET), any(HttpEntity.class), any(Class.class)))
                .thenReturn(ResponseEntity.ok(Map.of("tag_name", "v0.1.0", "html_url", "https://github.com/marensovich/MarForms/releases/tag/v0.1.0",
                        "body", "## Условия по ролям в вебхуках\n\n- экспорт в CSV")));

        mvc.perform(as(root, get("/api/v1/system/updates")))
                .andExpect(jsonPath("$.current").value("0.0.1-SNAPSHOT"))
                .andExpect(jsonPath("$.latest").value("0.1.0"))
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.notes").value("Условия по ролям в вебхуках"))
                .andExpect(jsonPath("$.checkedAt").isNotEmpty());
        mvc.perform(as(root, get("/api/v1/system/updates"))).andExpect(jsonPath("$.latest").value("0.1.0"));
        verify(restTemplate, times(1)).exchange(eq(RELEASES), eq(HttpMethod.GET), any(HttpEntity.class), any(Class.class));

        when(restTemplate.exchange(eq(RELEASES), eq(HttpMethod.GET), any(HttpEntity.class), any(Class.class)))
                .thenThrow(HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Not Found", null, null, null));
        mvc.perform(as(root, post("/api/v1/system/check-updates")))
                .andExpect(jsonPath("$.latest").doesNotExist())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.error").doesNotExist());
        verify(restTemplate, times(2)).exchange(eq(RELEASES), eq(HttpMethod.GET), any(HttpEntity.class), any(Class.class));
    }

    @Test
    void versionsCompareNumericallyAndASnapshotIsOlderThanItsRelease() {
        assertThat(UpdateCheckService.isNewer("2.10.0", "2.9.3")).isTrue();
        assertThat(UpdateCheckService.isNewer("2.9.0", "2.9.0")).isFalse();
        assertThat(UpdateCheckService.isNewer("0.0.1", "0.0.1-SNAPSHOT")).isTrue();
        assertThat(UpdateCheckService.isNewer("1.0.0", "dev")).isFalse();
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()));
    }

    private User user(long discordId, Permission... permissions) {
        Role role = new Role();
        role.setName("role-" + discordId);
        role.setPermissions(new HashSet<>(Set.of(permissions)));
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername("user" + discordId);
        u.getRoles().add(roleRepository.save(role));
        return userRepository.save(u);
    }

    private void job(OutboundJobStatus status, LocalDateTime updatedAt) {
        OutboundJob job = new OutboundJob();
        job.setId(UUID.randomUUID());
        job.setJobType("TEST");
        job.setPayload(Map.of());
        job.setStatus(status);
        job.setNextAttemptAt(updatedAt);
        job.setCreatedAt(updatedAt);
        job.setUpdatedAt(updatedAt);
        outboundJobRepository.save(job);
    }

    private void form(WebhookHealth... healths) {
        FormSchema schema = new FormSchema();
        schema.setTitle("Hooks");
        Form form = new Form();
        form.setSchema(schema);
        List<WebhookConfig> hooks = new java.util.ArrayList<>();
        for (int i = 0; i < healths.length; i++) {
            WebhookConfig hook = new WebhookConfig();
            hook.setUrl("https://discord.com/api/webhooks/" + (100 + i) + "/token");
            hook.setHealth(healths[i]);
            hooks.add(hook);
        }
        form.setWebhooks(hooks);
        formRepository.save(form);
    }
}
