package me.marensovich.gta5rpformapp.backend.data.roles;

/**
 * Enumeration of all available permissions in the system.
 * <p>
 * Permissions are assigned to roles and determine what actions a user
 * is authorized to perform within the application.
 * </p>
 * <p>
 * Permissions are organized by functional areas:
 * <ul>
 *     <li><b>Dashboard</b> — access to the main dashboard</li>
 *     <li><b>Forms</b> — full CRUD operations on forms</li>
 *     <li><b>Responses</b> — view and delete form submissions</li>
 *     <li><b>Users</b> — view and moderate users (ban/unban)</li>
 *     <li><b>Roles</b> — manage roles and assign them to users</li>
 *     <li><b>System</b> — system settings and information</li>
 * </ul>
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public enum Permission {
    /**
     * Permission to access the main dashboard.
     * <p>
     * Grants entry to the {@code /dashboard} endpoint and main overview pages.
     * </p>
     *
     * @since v.0.1
     */
    DASHBOARD_ACCESS,

    /**
     * Permission to manage forms.
     * <p>
     * Includes:
     * <ul>
     *     <li>Viewing the list of forms and their schemas</li>
     *     <li>Creating new forms</li>
     *     <li>Editing existing forms</li>
     *     <li>Deleting forms</li>
     *     <li>Activating/deactivating forms</li>
     * </ul>
     * </p>
     *
     * @since v.0.1
     */
    FORMS_MANAGE,

    /**
     * Permission to manage form responses.
     * <p>
     * Includes:
     * <ul>
     *     <li>Viewing all form submissions</li>
     *     <li>Deleting submissions</li>
     *     <li>Viewing submission statistics</li>
     * </ul>
     * </p>
     *
     * @since v.0.1
     */
    RESPONSES_MANAGE,

    /**
     * Permission to moderate users.
     * <p>
     * Includes:
     * <ul>
     *     <li>Viewing the list of users</li>
     *     <li>Searching and filtering users</li>
     *     <li>Banning users (permanent and temporary)</li>
     *     <li>Unbanning users</li>
     * </ul>
     * </p>
     * <p>
     * <b>Note:</b> Does NOT include role assignment.
     * Role management is handled by {@link #ROLES_MANAGE}.
     * </p>
     *
     * @see #ROLES_MANAGE
     * @since v.0.1
     */
    USERS_MODERATE,

    /**
     * Permission to manage roles.
     * <p>
     * Includes:
     * <ul>
     *     <li>Creating new roles</li>
     *     <li>Editing existing roles (name and permissions)</li>
     *     <li>Deleting roles</li>
     *     <li>Assigning roles to users</li>
     *     <li>Viewing roles and their permissions</li>
     * </ul>
     * </p>
     * <p>
     * <b>Note:</b> This also grants the ability to assign roles to users,
     * which is why it's separate from {@link #USERS_MODERATE}.
     * </p>
     *
     * @see #USERS_MODERATE
     * @since v.0.1
     */
    ROLES_MANAGE,

    /**
     * Permission for system administration.
     * <p>
     * Includes:
     * <ul>
     *     <li>Access to system settings</li>
     *     <li>Viewing system information and metrics</li>
     *     <li>Server resources monitoring</li>
     * </ul>
     * </p>
     * <p>
     * <b>Note:</b> This is the highest level of access and should be
     * granted only to super administrators.
     * </p>
     *
     * @since v.0.1
     */
    SYSTEM_ADMIN
}