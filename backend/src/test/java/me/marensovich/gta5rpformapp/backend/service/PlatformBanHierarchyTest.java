package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.user.BanUserRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

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
    void moderatorsCantBanAdminsOrThemselvesButAdminsCan() {
        User moderator = user(9701L, "test-mod", Permission.USERS_MODERATE);
        User admin = user(9702L, "test-admin", Permission.ROLES_MANAGE);
        User root = user(9703L, "test-root", Permission.SYSTEM_ADMIN);
        User member = user(9704L, "test-member");

        signIn(moderator);
        assertThatThrownBy(() -> userService.ban(admin.getDiscordId(), new BanUserRequest(true, null)))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> userService.ban(moderator.getDiscordId(), new BanUserRequest(true, null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(userService.ban(member.getDiscordId(), new BanUserRequest(true, null)).isBannedPermanently()).isTrue();

        signIn(root);
        assertThat(userService.ban(admin.getDiscordId(), new BanUserRequest(false, 10L)).getBannedUntil()).isNotNull();
    }
}
