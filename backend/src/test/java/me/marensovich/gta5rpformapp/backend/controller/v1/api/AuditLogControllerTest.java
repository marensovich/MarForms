package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.AuditLogRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The platform journal (ТЗ 6.5, #146): the diff of a change with secrets
 * masked, filters by several actions, a participant and dates, the KPIs, and
 * the 365-day retention.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuditLogControllerTest {

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

    private User root;
    private Role moderator;

    @BeforeEach
    void setUp() {
        Role system = role("System Admin", Permission.SYSTEM_ADMIN);
        moderator = role("Moderator", Permission.DASHBOARD_ACCESS, Permission.USERS_MODERATE);
        root = new User();
        root.setDiscordId(61L);
        root.setDiscordUsername("kirill_nv");
        root.getRoles().add(system);
        root = userRepository.save(root);
    }

    @Test
    void aChangeKeepsItsFieldsBeforeAndAfterWithTheWebhookMasked() throws Exception {
        mvc.perform(as(put("/api/v1/roles/{id}", moderator.getId()))
                        .content("{\"permissions\": [\"DASHBOARD_ACCESS\", \"USERS_MODERATE\", \"RESPONSES_MANAGE\"]}"))
                .andExpect(status().isOk());
        mvc.perform(as(get("/api/v1/admin/logs").param("actions", "ROLE_UPDATED")))
                .andExpect(jsonPath("$.content[0].diff[0].field").value("permissions"))
                .andExpect(jsonPath("$.content[0].diff[0].before").value("[DASHBOARD_ACCESS, USERS_MODERATE]"))
                .andExpect(jsonPath("$.content[0].diff[0].after").value("[DASHBOARD_ACCESS, RESPONSES_MANAGE, USERS_MODERATE]"));

        mvc.perform(as(put("/api/v1/settings"))
                        .content("{\"system.name\": \"MarForms QA\", \"log.webhook.url\": \"https://discord.com/api/webhooks/123/secret-token\"}"))
                .andExpect(status().isOk());
        mvc.perform(as(get("/api/v1/admin/logs").param("actions", "SETTINGS_UPDATED")))
                .andExpect(jsonPath("$.content[0].diff[?(@.field == 'logWebhookUrl')].after").value("https://discord.com/api/webhooks/123/***"))
                .andExpect(jsonPath("$.content[0].diff[?(@.field == 'systemName')].after").value("MarForms QA"))
                .andExpect(jsonPath("$.content[0]", not(containsString("secret-token"))));
    }

    @Test
    void filtersBySeveralActionsAParticipantAndDates() throws Exception {
        entry(AuditAction.USER_BANNED, 70L, "71", LocalDateTime.now());
        entry(AuditAction.USER_ROLES_UPDATED, 72L, "70", LocalDateTime.now());
        entry(AuditAction.FORM_CREATED, 70L, "f", LocalDateTime.now().minusDays(10));
        entry(AuditAction.USER_LOGIN, 73L, "73", LocalDateTime.now());

        mvc.perform(as(get("/api/v1/admin/logs").param("actions", "USER_BANNED", "USER_ROLES_UPDATED")))
                .andExpect(jsonPath("$.page.totalElements").value(2));
        // A participant is who acted or who was acted on.
        mvc.perform(as(get("/api/v1/admin/logs").param("participant", "70")))
                .andExpect(jsonPath("$.page.totalElements").value(3));
        mvc.perform(as(get("/api/v1/admin/logs").param("participant", "70").param("from", LocalDate.now().minusDays(1).toString())))
                .andExpect(jsonPath("$.page.totalElements").value(2));

        mvc.perform(as(get("/api/v1/admin/logs/stats")))
                .andExpect(jsonPath("$.today").value(3))
                .andExpect(jsonPath("$.restrictions").value(1))
                .andExpect(jsonPath("$.rights").value(1));
    }

    @Test
    void entriesOlderThanAYearAreDropped() {
        AuditLog old = entry(AuditAction.USER_LOGIN, 70L, "70", LocalDateTime.now().minusDays(400));
        AuditLog fresh = entry(AuditAction.USER_LOGIN, 70L, "70", LocalDateTime.now().minusDays(300));
        assertThat(auditLogService.purgeExpired()).isEqualTo(1);
        assertThat(auditLogRepository.findById(old.getId())).isEmpty();
        assertThat(auditLogRepository.findById(fresh.getId())).isPresent();
    }

    private AuditLog entry(AuditAction action, Long actor, String target, LocalDateTime at) {
        AuditLog e = new AuditLog();
        e.setAction(action);
        e.setActorDiscordId(actor);
        e.setTargetId(target);
        e.setCreatedAt(at);
        return auditLogRepository.save(e);
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(root.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    private Role role(String name, Permission... permissions) {
        Role role = new Role();
        role.setName(name);
        role.setPermissions(new HashSet<>(Set.of(permissions)));
        return roleRepository.save(role);
    }
}
