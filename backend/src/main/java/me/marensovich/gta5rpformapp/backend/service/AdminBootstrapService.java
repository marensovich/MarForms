package me.marensovich.gta5rpformapp.backend.service;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The platform's first administrators (install.sh): a fresh database has no
 * one with SYSTEM_ADMIN, so the Discord IDs in {@code ADMIN_DISCORD_IDS} get
 * the system role when they sign in. While an ID is listed the role comes
 * back on every sign-in; remove it from the list to manage that user in the
 * panel like anyone else.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminBootstrapService {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    @Value("${app.admin-discord-ids:}")
    private String adminDiscordIds;

    /** Gives a listed user the system role if they don't hold SYSTEM_ADMIN yet. */
    @Transactional
    public void grantIfListed(User signedIn) {
        if (!listed().contains(signedIn.getDiscordId())) return;
        User user = userRepository.findById(signedIn.getId()).orElse(null);
        if (user == null) return;
        Set<Role> roles = user.getRoles() == null ? new HashSet<>() : new HashSet<>(user.getRoles());
        if (roles.stream().anyMatch(r -> r.getPermissions().contains(Permission.SYSTEM_ADMIN))) return;

        Role system = roleRepository.findAll().stream()
                .filter(r -> r.isSystem() && r.getPermissions().contains(Permission.SYSTEM_ADMIN))
                .findFirst().orElse(null);
        if (system == null) {
            log.warn("ADMIN_DISCORD_IDS lists {}, but there is no system role to give", user.getDiscordId());
            return;
        }
        roles.add(system);
        user.setRoles(roles);
        userRepository.save(user);
        auditLogService.log(AuditAction.USER_ROLES_UPDATED, null, "MarForms",
                String.valueOf(user.getDiscordId()), user.getDiscordUsername(),
                "Roles: + " + system.getName() + " (ADMIN_DISCORD_IDS)");
    }

    Set<Long> listed() {
        if (adminDiscordIds == null || adminDiscordIds.isBlank()) return Set.of();
        return Arrays.stream(adminDiscordIds.split("[,\\s]+"))
                .map(String::trim).filter(s -> s.matches("\\d{1,20}"))
                .map(Long::parseLong).collect(Collectors.toSet());
    }
}
