package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.role.CreateRoleRequest;
import me.marensovich.gta5rpformapp.backend.dto.role.UpdateRoleRequest;
import me.marensovich.gta5rpformapp.backend.exception.HierarchyException;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing platform roles (ТЗ 6.4).
 * <p>
 * Rights are read from the database on every request, so a change applies at
 * once (ТЗ 9.1). Only a system administrator creates, changes or deletes a
 * role with {@code SYSTEM_ADMIN} (#103: ROLES_MANAGE must not reach it); the
 * system role can't be deleted or lose {@code SYSTEM_ADMIN}; and the last
 * holder of {@code SYSTEM_ADMIN} keeps it (ТЗ 2.3).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    /**
     * All roles: the system role first, then by name.
     *
     * @return the roles
     * @since v.0.1
     */
    public List<Role> listAll() {
        List<Role> roles = new ArrayList<>(roleRepository.findAll());
        roles.sort((a, b) -> a.isSystem() != b.isSystem() ? (a.isSystem() ? -1 : 1) : a.getName().compareToIgnoreCase(b.getName()));
        return roles;
    }

    /**
     * How many users hold each role.
     *
     * @return the counts by role ID; a role nobody holds is absent
     * @since v.0.1
     */
    public Map<UUID, Long> holders() {
        Map<UUID, Long> counts = new HashMap<>();
        for (Object[] row : userRepository.countByRole()) counts.put((UUID) row[0], ((Number) row[1]).longValue());
        return counts;
    }

    /**
     * Retrieves a role by its ID.
     *
     * @param roleId the UUID of the role to retrieve
     * @return the {@link Role} entity
     * @throws NotFoundException if the role does not exist
     * @since v.0.1
     */
    public Role getById(UUID roleId) {
        return roleRepository.findById(roleId)
                .orElseThrow(() -> new NotFoundException("Role not found: " + roleId));
    }

    /**
     * Creates a role, with its own rights or those of {@code copyFrom}.
     *
     * @param request the name, colour and rights
     * @return the role
     * @throws IllegalArgumentException if the name is taken
     * @throws HierarchyException       if it would carry SYSTEM_ADMIN and the caller isn't a system administrator
     * @since v.0.1
     */
    @Transactional
    public Role create(CreateRoleRequest request) {
        String name = request.name().trim();
        if (roleRepository.findByName(name).isPresent()) {
            throw new IllegalArgumentException("Role with name '" + name + "' already exists");
        }
        Set<Permission> permissions = request.copyFrom() != null
                ? new HashSet<>(getById(request.copyFrom()).getPermissions())
                : new HashSet<>(Objects.requireNonNullElse(request.permissions(), Set.of()));
        if (permissions.contains(Permission.SYSTEM_ADMIN)) requireSystemAdmin();

        Role role = new Role();
        role.setName(name);
        role.setColor(request.color());
        role.setPermissions(permissions);
        Role saved = roleRepository.save(role);
        auditLogService.logByCurrentUser(AuditAction.ROLE_CREATED, saved.getId().toString(), saved.getName(),
                "Permissions: [" + names(permissions) + "]");
        return saved;
    }

    /**
     * Renames, recolours or changes the rights of a role; it applies at once.
     *
     * @param roleId  the role
     * @param request what changes
     * @return the role
     * @throws HierarchyException    if SYSTEM_ADMIN is involved and the caller isn't a system administrator
     * @throws InvalidStateException if the system role would lose SYSTEM_ADMIN, or nobody would keep it
     * @since v.0.1
     */
    @Transactional
    public Role update(UUID roleId, UpdateRoleRequest request) {
        Role role = getById(roleId);

        String oldName = role.getName();
        String oldColor = role.getColor();
        String oldPerms = names(role.getPermissions());
        boolean hadSystemAdmin = role.getPermissions().contains(Permission.SYSTEM_ADMIN);
        boolean hasSystemAdmin = request.permissions() != null ? request.permissions().contains(Permission.SYSTEM_ADMIN) : hadSystemAdmin;
        if (hadSystemAdmin || hasSystemAdmin) requireSystemAdmin();
        if (hadSystemAdmin && !hasSystemAdmin) {
            if (role.isSystem()) throw new InvalidStateException("The system role keeps SYSTEM_ADMIN");
            requireAnotherSystemAdmin(roleId);
        }

        if (request.name() != null && !request.name().isBlank()) {
            String name = request.name().trim();
            roleRepository.findByName(name).filter(other -> !other.getId().equals(roleId)).ifPresent(other -> {
                throw new IllegalArgumentException("Role with name '" + name + "' already exists");
            });
            role.setName(name);
        }
        if (request.color() != null) role.setColor(request.color());
        if (request.permissions() != null) role.setPermissions(new HashSet<>(request.permissions()));

        Role saved = roleRepository.save(role);

        List<String> changes = new ArrayList<>();
        if (!oldName.equals(saved.getName()))
            changes.add("Name: \"" + oldName + "\" → \"" + saved.getName() + "\"");
        if (!Objects.equals(oldColor, saved.getColor()))
            changes.add("Color: " + oldColor + " → " + saved.getColor());
        String newPerms = names(saved.getPermissions());
        if (!oldPerms.equals(newPerms))
            changes.add("Permissions: [" + oldPerms + "] → [" + newPerms + "]");

        auditLogService.logByCurrentUser(AuditAction.ROLE_UPDATED, saved.getId().toString(), saved.getName(),
                changes.isEmpty() ? null : String.join("\n", changes));
        return saved;
    }

    /**
     * Deletes a role, even an assigned one: its holders lose its rights at once
     * (ТЗ 6.4).
     *
     * @param roleId the role
     * @return how many users held it
     * @throws InvalidStateException if it's the system role, or the last one with SYSTEM_ADMIN held by anyone
     * @throws HierarchyException    if it carries SYSTEM_ADMIN and the caller isn't a system administrator
     * @since v.0.1
     */
    @Transactional
    public long delete(UUID roleId) {
        Role role = getById(roleId);
        if (role.isSystem()) throw new InvalidStateException("The system role can't be deleted");
        if (role.getPermissions().contains(Permission.SYSTEM_ADMIN)) {
            requireSystemAdmin();
            requireAnotherSystemAdmin(roleId);
        }
        long holders = holders().getOrDefault(roleId, 0L);
        userRepository.removeRoleFromAll(roleId);
        roleRepository.delete(role);
        auditLogService.logByCurrentUser(AuditAction.ROLE_DELETED, roleId.toString(), role.getName(),
                holders > 0 ? "Taken from " + holders + " user(s)" : null);
        return holders;
    }

    /** Somebody holding SYSTEM_ADMIN through another role stays, or nobody held it anyway. */
    private void requireAnotherSystemAdmin(UUID roleId) {
        if (userRepository.countWithPermission(Permission.SYSTEM_ADMIN) > 0
                && userRepository.countWithPermissionOutside(Permission.SYSTEM_ADMIN, roleId) == 0) {
            throw new InvalidStateException("The last system administrator keeps SYSTEM_ADMIN");
        }
    }

    private static void requireSystemAdmin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        boolean ok = auth != null && auth.getAuthorities().stream().anyMatch(a -> Permission.SYSTEM_ADMIN.name().equals(a.getAuthority()));
        if (!ok) throw new HierarchyException("Only a system administrator can grant, change or take SYSTEM_ADMIN");
    }

    private static String names(Set<Permission> permissions) {
        return permissions == null ? "" : permissions.stream().map(Enum::name).sorted().collect(Collectors.joining(", "));
    }
}
