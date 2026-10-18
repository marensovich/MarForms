package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.user.AssignRolesRequest;
import me.marensovich.gta5rpformapp.backend.dto.user.BanUserRequest;
import me.marensovich.gta5rpformapp.backend.dto.user.TimeoutRequest;
import me.marensovich.gta5rpformapp.backend.exception.HierarchyException;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A platform moderator can't ban administrators or themselves (#103).
 */
@SpringBootTest
@Transactional
class PlatformBanHierarchyTest {

    @Autowired
    private UserService userService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private User user(long discordId, String roleName, Permission... permissions) {
        Role role = new Role();
        role.setName(roleName);
        role.setPermissions(Set.of(permissions));
        role = roleRepository.save(role);
        User user = new User();
        user.setDiscordId(discordId);
        user.setDiscordUsername(roleName + discordId);
        user.getRoles().add(role);
        return userRepository.save(user);
    }

    private void signIn(User user) {
        var details = new CustomUserDetails(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities()));
    }

    @Test
    void moderatorsCantRestrictAdminsPeersOrThemselvesButSystemAdminsCan() {
        User moderator = user(9701L, "test-mod", Permission.USERS_MODERATE);
        User peer = user(9705L, "test-mod-2", Permission.USERS_MODERATE);
        User admin = user(9702L, "test-admin", Permission.ROLES_MANAGE);
        User root = user(9703L, "test-root", Permission.SYSTEM_ADMIN);
        User member = user(9704L, "test-member");

        signIn(moderator);
        assertThatThrownBy(() -> userService.ban(admin.getDiscordId(), new BanUserRequest("spam")))
                .isInstanceOf(HierarchyException.class);
        assertThatThrownBy(() -> userService.timeout(peer.getDiscordId(), new TimeoutRequest(10L, "spam")))
                .isInstanceOf(HierarchyException.class);
        assertThatThrownBy(() -> userService.ban(moderator.getDiscordId(), new BanUserRequest(null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(userService.ban(member.getDiscordId(), new BanUserRequest("spam")).isBanned()).isTrue();

        signIn(root);
        User timedOut = userService.timeout(admin.getDiscordId(), new TimeoutRequest(10L, "flood"));
        assertThat(timedOut.isTimedOut()).isTrue();
        assertThat(timedOut.isBanned()).isFalse();
        assertThat(timedOut.getRestrictionReason()).isEqualTo("flood");
    }

    @Test
    void onlySystemAdminsTouchSystemAdminAndTheLastOneKeepsIt() {
        User admin = user(9711L, "test-admin-2", Permission.ROLES_MANAGE);
        User root = user(9712L, "test-root-2", Permission.SYSTEM_ADMIN);
        User member = user(9713L, "test-member-2");
        UUID rootRole = root.getRoles().iterator().next().getId();

        signIn(admin);
        assertThatThrownBy(() -> userService.assignRoles(member.getDiscordId(), new AssignRolesRequest(Set.of(rootRole))))
                .isInstanceOf(HierarchyException.class);
        assertThatThrownBy(() -> userService.assignRoles(root.getDiscordId(), new AssignRolesRequest(Set.of())))
                .isInstanceOf(HierarchyException.class);

        signIn(root);
        assertThat(userRepository.countWithPermission(Permission.SYSTEM_ADMIN)).isEqualTo(1);
        assertThatThrownBy(() -> userService.assignRoles(root.getDiscordId(), new AssignRolesRequest(Set.of())))
                .isInstanceOf(InvalidStateException.class);
        userService.assignRoles(member.getDiscordId(), new AssignRolesRequest(Set.of(rootRole)));
        assertThat(userService.assignRoles(root.getDiscordId(), new AssignRolesRequest(Set.of())).getRoles()).isEmpty();
    }
}
