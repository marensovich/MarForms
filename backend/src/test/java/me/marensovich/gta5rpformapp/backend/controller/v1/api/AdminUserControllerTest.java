package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The platform's users page (ТЗ 6.3, #144): a time-out differs from a ban,
 * both carry a reason and a history, the hierarchy of ТЗ 2.3 holds, and the
 * list filters and counts on the server.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminUserControllerTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;

    private User moderator;
    private User admin;
    private User vlad;
    private User boris;
    private Role adminRole;

    @BeforeEach
    void setUp() {
        moderator = user(41L, "kirill_nv", role("Moderator", "#2563EB", Permission.DASHBOARD_ACCESS, Permission.USERS_MODERATE));
        adminRole = role("Admin", "#7C3AED", Permission.DASHBOARD_ACCESS, Permission.USERS_MODERATE, Permission.ROLES_MANAGE);
        admin = user(42L, "maria_sh", adminRole);
        vlad = user(43L, "vlad.kozlov", null);
        boris = user(44L, "boris_tm", null);
    }

    @Test
    void aTimeOutClosesThePanelAndSubmissionsButNotTheUsersOwnPages() throws Exception {
        mvc.perform(as(moderator, post("/api/v1/admin/users/43/timeout")).content("{\"minutes\": 60, \"reason\": \" \"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(as(moderator, post("/api/v1/admin/users/43/timeout"))
                        .content("{\"minutes\": 60, \"reason\": \"Спам одинаковыми заявками\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TIMEOUT"))
                .andExpect(jsonPath("$.reason").value("Спам одинаковыми заявками"))
                .andExpect(jsonPath("$.until").isNotEmpty());

        mvc.perform(as(vlad, get("/api/v1/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timeout.reason").value("Спам одинаковыми заявками"));
        mvc.perform(as(vlad, get("/api/v1/me/guilds")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.banned").value(true))
                .andExpect(jsonPath("$.timeout").value(true))
                .andExpect(jsonPath("$.reason").value("Спам одинаковыми заявками"));

        mvc.perform(as(moderator, delete("/api/v1/admin/users/43/timeout")))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(as(vlad, get("/api/v1/me/guilds"))).andExpect(status().isOk());
    }

    @Test
    void aBanClosesEverythingAndUnbanShowsItsHistory() throws Exception {
        mvc.perform(as(moderator, post("/api/v1/admin/users/44/ban")).content("{\"reason\": \"Оскорбления в заявках\"}"))
                .andExpect(jsonPath("$.status").value("BANNED"))
                .andExpect(jsonPath("$.until").value(nullValue()));
        mvc.perform(as(boris, get("/api/v1/me")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.permanent").value(true))
                .andExpect(jsonPath("$.reason").value("Оскорбления в заявках"));

        mvc.perform(as(moderator, post("/api/v1/admin/users/44/unban"))).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(as(moderator, get("/api/v1/admin/users/44/restrictions")))
                .andExpect(jsonPath("$[0].type").value("BAN"))
                .andExpect(jsonPath("$[0].reason").value("Оскорбления в заявках"))
                .andExpect(jsonPath("$[0].createdByName").value("kirill_nv"))
                .andExpect(jsonPath("$[0].liftedByName").value("kirill_nv"));
        mvc.perform(as(boris, get("/api/v1/me"))).andExpect(status().isOk());
    }

    @Test
    void aModeratorCantRestrictAnAdministratorAndTheRowSaysSo() throws Exception {
        mvc.perform(as(moderator, post("/api/v1/admin/users/42/ban")).content("{\"reason\": \"x\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("HIERARCHY"))
                .andExpect(jsonPath("$.error").value("A moderator can't restrict a platform administrator"));
        assertThat(userRepository.findByDiscordId(42L).orElseThrow().isBanned()).isFalse();

        mvc.perform(as(moderator, get("/api/v1/admin/users").param("q", "maria")))
                .andExpect(jsonPath("$.content[0].outranked").value(true))
                .andExpect(jsonPath("$.content[0].roles[0].name").value("Admin"))
                .andExpect(jsonPath("$.content[0].roles[0].color").value("#7C3AED"));
        mvc.perform(as(admin, get("/api/v1/admin/users").param("q", "kirill")))
                .andExpect(jsonPath("$.content[0].outranked").value(false));
        mvc.perform(as(admin, get("/api/v1/admin/users").param("q", "maria")))
                .andExpect(jsonPath("$.content[0].self").value(true));
    }

    @Test
    void filtersAndKpis() throws Exception {
        vlad.setBannedUntil(LocalDateTime.now().plusHours(1));
        boris.setBannedPermanently(true);
        boris.setLastSeenAt(LocalDateTime.now().minusDays(40));
        userRepository.save(vlad);
        userRepository.save(boris);

        mvc.perform(as(admin, get("/api/v1/admin/users").param("status", "timeout")))
                .andExpect(jsonPath("$.page.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].username").value("vlad.kozlov"));
        mvc.perform(as(admin, get("/api/v1/admin/users").param("status", "banned")))
                .andExpect(jsonPath("$.content[0].username").value("boris_tm"));
        mvc.perform(as(admin, get("/api/v1/admin/users").param("roleId", adminRole.getId().toString())))
                .andExpect(jsonPath("$.page.totalElements").value(1));
        mvc.perform(as(admin, get("/api/v1/admin/users").param("q", "43")))
                .andExpect(jsonPath("$.content[0].discordId").value("43"));
        mvc.perform(as(admin, get("/api/v1/admin/users/stats")))
                .andExpect(jsonPath("$.total").value(4))
                .andExpect(jsonPath("$.banned").value(1))
                .andExpect(jsonPath("$.timedOut").value(1))
                // The admin's own requests just now count; boris was last seen 40 days ago.
                .andExpect(jsonPath("$.active30").value(1));
        mvc.perform(as(vlad, get("/api/v1/admin/users"))).andExpect(status().isForbidden());
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    private Role role(String name, String color, Permission... permissions) {
        Role role = new Role();
        role.setName(name);
        role.setColor(color);
        role.setPermissions(new HashSet<>(Set.of(permissions)));
        return roleRepository.save(role);
    }

    private User user(long discordId, String name, Role role) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername(name);
        if (role != null) u.getRoles().add(role);
        return userRepository.save(u);
    }
}
