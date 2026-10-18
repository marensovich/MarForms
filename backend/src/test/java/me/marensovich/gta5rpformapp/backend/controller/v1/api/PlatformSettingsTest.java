package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.AuditLogRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import me.marensovich.gta5rpformapp.backend.service.WebhookService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Platform settings (ТЗ 6.7, #148): a disabled action is written nowhere, the
 * journal webhook can be tested and tells its last delivery, notifications
 * fill the shared variables, and the public settings name the system.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PlatformSettingsTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;
    @Autowired
    private AuditLogService auditLogService;
    @Autowired
    private WebhookService webhookService;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private FormRepository formRepository;
    @MockitoBean
    private RestTemplate restTemplate;

    private User root;

    @BeforeEach
    void setUp() {
        Role role = new Role();
        role.setName("settings-root");
        role.setPermissions(new HashSet<>(Set.of(Permission.SYSTEM_ADMIN)));
        root = new User();
        root.setDiscordId(95L);
        root.setDiscordUsername("kirill_nv");
        root.getRoles().add(roleRepository.save(role));
        root = userRepository.save(root);
    }

    @Test
    void aDisabledActionIsWrittenNeitherToThePlatformNorToAServerJournal() throws Exception {
        mvc.perform(as(put("/api/v1/settings")).content("{\"system.name\": \"MarForms\", \"log.enabled.actions\": \"USER_BANNED\"}"))
                .andExpect(status().isOk());
        long before = auditLogRepository.count();

        auditLogService.log(AuditAction.ROLE_UPDATED, 1L, "a", "r", "Moderator", null);
        auditLogService.logGuildActionAs(1L, "a", 8301L, AuditAction.FORM_CREATED, "FORM", "f", "Набор", null, null);
        assertThat(auditLogRepository.count()).isEqualTo(before);

        auditLogService.log(AuditAction.USER_BANNED, 1L, "a", "2", "boris_tm", null);
        assertThat(auditLogRepository.count()).isEqualTo(before + 1);
    }

    @Test
    void theJournalWebhookCanBeTestedAndTellsItsLastDelivery() throws Exception {
        when(restTemplate.postForEntity(eq("https://discord.com/api/webhooks/123/token"), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.noContent().build());

        mvc.perform(as(post("/api/v1/settings/log-webhook/test")).content("{\"url\": \"https://discord.com/api/webhooks/123/token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.status").value("204"));
        mvc.perform(as(get("/api/v1/settings/log-webhook")))
                .andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.lastDelivery.status").value("204"))
                .andExpect(jsonPath("$.lastDelivery.at").isNotEmpty());
        mvc.perform(as(post("/api/v1/settings/log-webhook/test")).content("{\"url\": \"https://example.com/hook\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void notificationsFillTheSharedVariablesAndAnonymousFormsHideTheAuthor() {
        Guild guild = new Guild();
        guild.setDiscordGuildId(8302L);
        guild.setName("Los Santos RP");
        guildRepository.save(guild);
        FormSchema schema = new FormSchema();
        schema.setTitle("Набор в LSPD");
        Form form = new Form();
        form.setServerId(8302L);
        form.setSchema(schema);
        form.setSlug("lspd");
        form = formRepository.save(form);

        Map<String, String> vars = webhookService.vars(form, 412988120773L, "dmitry_ballas", null, SubmissionStatus.APPROVED);
        assertThat(vars).containsEntry("user.mention", "<@412988120773>").containsEntry("user.name", "dmitry_ballas")
                .containsEntry("user.id", "412988120773").containsEntry("form.title", "Набор в LSPD")
                .containsEntry("server.name", "Los Santos RP").containsEntry("status", "Принята")
                .containsEntry("user_mention", "<@412988120773>");
        assertThat(vars.get("form.url")).endsWith("/f/lspd");
        assertThat(vars.get("date")).matches("\\d{2}\\.\\d{2}\\.\\d{4}");

        form.setAccessMode(FormAccessMode.ANONYMOUS);
        Map<String, String> anonymous = webhookService.vars(form, 412988120773L, "dmitry_ballas", null, null);
        assertThat(anonymous.get("user.id")).isEmpty();
        assertThat(anonymous.values()).noneMatch(v -> v.contains("412988120773") || v.contains("dmitry_ballas"));
    }

    @Test
    void thePublicSettingsNameTheSystemItsSupportAndLanguage() throws Exception {
        mvc.perform(as(put("/api/v1/settings")).content("{\"system.name\": \"MarForms\", \"system.contact\": \"support@marforms.app\", \"ui.language\": \"ru\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/settings/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.systemName").value("MarForms"))
                .andExpect(jsonPath("$.systemContact").value("support@marforms.app"))
                .andExpect(jsonPath("$.uiLanguage").value("ru"));
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(root.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }
}
