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

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Platform roles (ТЗ 6.4, #145): colours, the system role, holders, deleting
 * an assigned role, copying rights, and SYSTEM_ADMIN out of ROLES_MANAGE's reach.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RoleControllerTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;

    private Role systemRole;
    private Role adminRole;
    private Role moderatorRole;
    private User root;
    private User admin;
    private User moderator;

    @BeforeEach
    void setUp() {
        systemRole = role("System Admin", true, Permission.SYSTEM_ADMIN);
        adminRole = role("Admin", false, Permission.DASHBOARD_ACCESS, Permission.ROLES_MANAGE);
        moderatorRole = role("Moderator", false, Permission.DASHBOARD_ACCESS, Permission.USERS_MODERATE);
        root = user(51L, systemRole);
        admin = user(52L, adminRole);
        moderator = user(53L, moderatorRole);
        user(54L, moderatorRole);
    }

    @Test
    void listsColoursHoldersAndTheSystemRoleFirst() throws Exception {
        mvc.perform(as(admin, get("/api/v1/roles")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("System Admin"))
                .andExpect(jsonPath("$[0].system").value(true))
                .andExpect(jsonPath("$[?(@.name == 'Moderator')].users").value(2))
                .andExpect(jsonPath("$[?(@.name == 'Moderator')].color").value("#2563EB"));
    }

    @Test
    void createsWithRightsCopiedFromAnotherRole() throws Exception {
        mvc.perform(as(admin, post("/api/v1/roles"))
                        .content("{\"name\": \"Поддержка\", \"color\": \"#0891B2\", \"copyFrom\": \"" + moderatorRole.getId() + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.color").value("#0891B2"))
                .andExpect(jsonPath("$.permissions", containsInAnyOrder("DASHBOARD_ACCESS", "USERS_MODERATE")));
        mvc.perform(as(admin, post("/api/v1/roles")).content("{\"name\": \"Bad\", \"color\": \"red\", \"permissions\": []}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deletingAnAssignedRoleTakesItsRightsAtOnce() throws Exception {
        mvc.perform(as(moderator, get("/api/v1/admin/users"))).andExpect(status().isOk());
        mvc.perform(as(admin, delete("/api/v1/roles/{id}", moderatorRole.getId()))).andExpect(status().isNoContent());
        assertThat(roleRepository.findById(moderatorRole.getId())).isEmpty();
        assertThat(userRepository.findByDiscordId(53L).orElseThrow().getRoles()).isEmpty();
        mvc.perform(as(moderator, get("/api/v1/admin/users"))).andExpect(status().isForbidden());
    }

    @Test
    void rolesManagersCantReachSystemAdminAndTheSystemRoleStays() throws Exception {
        mvc.perform(as(admin, post("/api/v1/roles")).content("{\"name\": \"Root 2\", \"permissions\": [\"SYSTEM_ADMIN\"]}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("HIERARCHY"));
        mvc.perform(as(admin, put("/api/v1/roles/{id}", adminRole.getId()))
                        .content("{\"permissions\": [\"DASHBOARD_ACCESS\", \"ROLES_MANAGE\", \"SYSTEM_ADMIN\"]}"))
                .andExpect(status().isForbidden());
        mvc.perform(as(admin, put("/api/v1/roles/{id}", systemRole.getId())).content("{\"name\": \"Root\"}"))
                .andExpect(status().isForbidden());

        mvc.perform(as(root, delete("/api/v1/roles/{id}", systemRole.getId()))).andExpect(status().isConflict());
        mvc.perform(as(root, put("/api/v1/roles/{id}", systemRole.getId())).content("{\"permissions\": [\"DASHBOARD_ACCESS\"]}"))
                .andExpect(status().isConflict());
        mvc.perform(as(root, put("/api/v1/roles/{id}", systemRole.getId())).content("{\"name\": \"Root\", \"color\": \"#DC2626\"}"))
                .andExpect(jsonPath("$.name").value("Root"))
                .andExpect(jsonPath("$.users").value(1));
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    private Role role(String name, boolean system, Permission... permissions) {
        Role role = new Role();
        role.setName(name);
        role.setSystem(system);
        role.setColor(name.equals("Moderator") ? "#2563EB" : null);
        role.setPermissions(new HashSet<>(Set.of(permissions)));
        return roleRepository.save(role);
    }

    private User user(long discordId, Role role) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername("user" + discordId);
        u.getRoles().add(role);
        return userRepository.save(u);
    }
}
