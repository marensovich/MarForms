package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Entity representing a role in the database.
 * <p>
 * Roles define a set of permissions that determine what actions a user
 * is authorized to perform within the application.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Table(name = "roles")
@Entity
@Data
public class Role {

    /**
     * Unique identifier for the role.
     * Automatically generated as a UUID.
     *
     * @since v.0.1
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * The display name of the role.
     * <p>
     * Examples: "ADMIN", "MODERATOR", "USER", "FORM_MANAGER".
     * </p>
     *
     * @since v.0.1
     */
    private String name;

    /**
     * The set of permissions associated with this role.
     * <p>
     * Fetched eagerly to ensure permissions are available immediately
     * for authorization checks. Permissions are stored as strings using
     * the {@link Permission} enum.
     * </p>
     *
     * @see Permission
     * @since v.0.1
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    @CollectionTable(
            name = "role_permissions",
            joinColumns = @JoinColumn(name = "role_id")
    )
    @Column(name = "permission")
    private Set<Permission> permissions = new HashSet<>();
}