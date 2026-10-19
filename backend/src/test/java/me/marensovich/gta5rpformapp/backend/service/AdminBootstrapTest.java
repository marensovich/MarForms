package me.marensovich.gta5rpformapp.backend.service;

import java.util.HashSet;
import java.util.Set;

import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/** install.sh's first administrator: a listed Discord ID gets the system role at sign-in. */
@SpringBootTest(properties = "app.admin-discord-ids=777, 778")
@Transactional
class AdminBootstrapTest {

    @Autowired
    private AdminBootstrapService service;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;

    private Role systemRole() {
        Role role = new Role();
        role.setName("ADMIN-bootstrap");
        role.setSystem(true);
        role.setPermissions(new HashSet<>(Set.of(Permission.DASHBOARD_ACCESS, Permission.SYSTEM_ADMIN)));
        return roleRepository.save(role);
    }

    private User user(long discordId) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername("user" + discordId);
        return userRepository.save(u);
    }

    @Test
    void aListedUserBecomesAnAdministratorOnceAndOthersDoNot() {
        Role system = systemRole();
        User listed = user(777L);
        User other = user(779L);

        service.grantIfListed(listed);
        service.grantIfListed(listed);
        service.grantIfListed(other);

        assertThat(userRepository.findById(listed.getId()).orElseThrow().getRoles()).containsExactly(system);
        assertThat(userRepository.findById(other.getId()).orElseThrow().getRoles()).isEmpty();
    }

    @Test
    void readsTheListLeniently() {
        assertThat(service.listed()).containsExactlyInAnyOrder(777L, 778L);
    }
}
