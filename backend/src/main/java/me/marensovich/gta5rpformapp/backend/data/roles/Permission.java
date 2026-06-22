package me.marensovich.gta5rpformapp.backend.data.roles;

/**
 * Enumeration of all available permissions in the system.
 * <p>
 * Permissions are assigned to roles and determine what actions a user
 * is authorized to perform within the application.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public enum Permission {

    // ============================================================
    // Dashboard Permissions
    // ============================================================

    /**
     * Permission to access the main dashboard page.
     * <p>
     * Replaces {@code DASHBOARD_READ}. Grants entry to the {@code /dashboard} endpoint.
     * </p>
     *
     * @since v.0.1
     */
    DASHBOARD_ACCESS,

    // ============================================================
    // Form Permissions
    // ============================================================

    /**
     * Permission to view the list of forms and their schemas.
     *
     * @since v.0.1
     */
    FORMS_VIEW,

    /**
     * Permission to manage forms.
     * <p>
     * Includes creating, editing, deleting, and activating/deactivating forms.
     * </p>
     *
     * @since v.0.1
     */
    FORMS_MANAGE,

    // ============================================================
    // Response Permissions
    // ============================================================

    /**
     * Permission to view user responses to forms.
     *
     * @since v.0.1
     */
    RESPONSES_VIEW,

    // ============================================================
    // User Permissions
    // ============================================================

    /**
     * Permission to view the list of users.
     *
     * @since v.0.1
     */
    USERS_VIEW,

    /**
     * Permission to manage users.
     * <p>
     * Includes banning, timeout, and assigning roles to users.
     * </p>
     *
     * @since v.0.1
     */
    USERS_MANAGE,

    // ============================================================
    // Role Permissions
    // ============================================================

    /**
     * Permission to manage roles.
     * <p>
     * Includes creating, editing, and deleting roles.
     * </p>
     *
     * @since v.0.1
     */
    ROLES_MANAGE,

    // ============================================================
    // System Permissions
    // ============================================================

    /**
     * Permission for system administration.
     * <p>
     * Reserved for future system settings and advanced configuration.
     * </p>
     *
     * @since v.0.1
     */
    SYSTEM_ADMIN
}