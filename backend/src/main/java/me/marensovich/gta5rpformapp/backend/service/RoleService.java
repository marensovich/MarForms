package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.role.CreateRoleRequest;
import me.marensovich.gta5rpformapp.backend.dto.role.UpdateRoleRequest;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service for managing roles.
 * <p>
 * Provides business logic for creating, retrieving, updating, and deleting roles,
 * including validation for duplicate role names.
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

    /**
     * Retrieves all roles.
     *
     * @return a {@link List} of all {@link Role} entities
     * @since v.0.1
     */
    public List<Role> listAll() {
        return roleRepository.findAll();
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
     * Creates a new role.
     *
     * @param request the {@link CreateRoleRequest} containing role details
     * @return the created {@link Role} entity
     * @throws IllegalArgumentException if a role with the same name already exists
     * @since v.0.1
     */
    @Transactional
    public Role create(CreateRoleRequest request) {
        if (roleRepository.findByName(request.name()).isPresent()) {
            throw new IllegalArgumentException("Role with name '" + request.name() + "' already exists");
        }

        Role role = new Role();
        role.setName(request.name());
        role.setPermissions(request.permissions());
        return roleRepository.save(role);
    }

    /**
     * Updates an existing role.
     * <p>
     * Only fields that are not {@code null} in the request will be updated.
     * </p>
     *
     * @param roleId  the UUID of the role to update
     * @param request the {@link UpdateRoleRequest} containing updated fields
     * @return the updated {@link Role} entity
     * @throws NotFoundException if the role does not exist
     * @since v.0.1
     */
    @Transactional
    public Role update(UUID roleId, UpdateRoleRequest request) {
        Role role = getById(roleId);

        if (request.name() != null) {
            role.setName(request.name());
        }
        if (request.permissions() != null) {
            role.setPermissions(request.permissions());
        }

        return roleRepository.save(role);
    }

    /**
     * Deletes a role by its ID.
     * <p>
     * Prevents deletion if the role is currently assigned to any users.
     * Users must be unassigned from the role before deletion.
     * </p>
     *
     * @param roleId the UUID of the role to delete
     * @throws NotFoundException        if the role does not exist
     * @throws IllegalArgumentException if the role is still assigned to one or more users
     * @since v.0.1
     */
    @Transactional
    public void delete(UUID roleId) {
        if (!roleRepository.existsById(roleId)) {
            throw new NotFoundException("Role not found: " + roleId);
        }
        if (userRepository.existsByRoles_Id(roleId)) {
            throw new IllegalArgumentException(
                    "Cannot delete role: there are users assigned to this role. " +
                            "Remove the role from all users first."
            );
        }
        roleRepository.deleteById(roleId);
    }
}