package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditDiff;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;

/**
 * «Live» of the platform journal (ТЗ 6.5, #146): a committed entry reaches an
 * open journal page as an {@code entry} event. Not transactional: the stream
 * listens for commits.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuditLogStreamTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private AuditLogStream stream;

    private User root;
    private Role role;

    @AfterEach
    void cleanUp() {
        if (root != null) userRepository.delete(root);
        if (role != null) roleRepository.delete(role);
    }

    @Test
    void aSavedEntryReachesAnOpenJournalPage() throws Exception {
        role = new Role();
        role.setName("stream-root");
        role.setPermissions(new HashSet<>(Set.of(Permission.SYSTEM_ADMIN)));
        role = roleRepository.save(role);
        root = new User();
        root.setDiscordId(9_810L);
        root.setDiscordUsername("stream-root");
        root.getRoles().add(role);
        root = userRepository.save(root);

        MvcResult live = mvc.perform(get("/api/v1/admin/logs/stream")
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(root.getDiscordId())))
                .andExpect(request().asyncStarted())
                .andReturn();

        AuditLog entry = new AuditLog();
        entry.setAction(AuditAction.ROLE_UPDATED);
        entry.setTargetName("Moderator");
        entry.setMetadata(new AuditDiff().add("permissions", Set.of("A"), Set.of("A", "B")).into(Map.of()));
        stream.onSaved(new AuditLogStream.Saved(entry));

        String body = live.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(body).contains("event:entry").contains("\"targetName\":\"Moderator\"").contains("\"field\":\"permissions\"");
    }
}
