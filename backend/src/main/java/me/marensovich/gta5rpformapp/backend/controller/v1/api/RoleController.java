package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.role.CreateRoleRequest;
import me.marensovich.gta5rpformapp.backend.dto.role.RoleDto;
import me.marensovich.gta5rpformapp.backend.dto.role.UpdateRoleRequest;
import me.marensovich.gta5rpformapp.backend.service.RoleService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for managing roles.
 * <p>
 * Provides endpoints for retrieving, creating, updating, and deleting roles.
 * All endpoints require the {@code ROLES_MANAGE} authority.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLES_MANAGE')")
public class RoleController {

    private final RoleService roleService;

    /**
     * Retrieves a list of all roles.
     *
     * @return a {@link List} of {@link RoleDto} containing all roles
     * @since v.0.1
     */
    @GetMapping
    public List<RoleDto> list() {
        return roleService.listAll().stream().map(RoleDto::from).toList();
    }

    /**
     * Retrieves a specific role by its ID.
     *
     * @param roleId the UUID of the role to retrieve
     * @return a {@link RoleDto} containing the role details
     * @since v.0.1
     */
    @GetMapping("/{roleId}")
    public RoleDto get(@PathVariable UUID roleId) {
        return RoleDto.from(roleService.getById(roleId));
    }

    /**
     * Creates a new role.
     *
     * @param request the {@link CreateRoleRequest} containing role details
     * @return a {@link ResponseEntity} with status 201 (Created) containing the created role
     * @since v.0.1
     */
    @PostMapping
    public ResponseEntity<RoleDto> create(@Valid @RequestBody CreateRoleRequest request) {
        var role = roleService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(RoleDto.from(role));
    }

    /**
     * Updates an existing role.
     *
     * @param roleId  the UUID of the role to update
     * @param request the {@link UpdateRoleRequest} containing updated role details
     * @return a {@link RoleDto} containing the updated role
     * @since v.0.1
     */
    @PutMapping("/{roleId}")
    public RoleDto update(@PathVariable UUID roleId, @RequestBody UpdateRoleRequest request) {
        return RoleDto.from(roleService.update(roleId, request));
    }

    /**
     * Deletes a role by its ID.
     *
     * @param roleId the UUID of the role to delete
     * @return a {@link ResponseEntity} with status 204 (No Content)
     * @since v.0.1
     */
    @DeleteMapping("/{roleId}")
    public ResponseEntity<Void> delete(@PathVariable UUID roleId) {
        roleService.delete(roleId);
        return ResponseEntity.noContent().build();
    }
}