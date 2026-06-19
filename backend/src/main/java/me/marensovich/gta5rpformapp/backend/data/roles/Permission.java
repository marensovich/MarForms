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

    /**
     * Permission to create new forms.
     *
     * @since v.0.1
     */
    FORM_CREATE,

    /**
     * Permission to view forms and their details.
     *
     * @since v.0.1
     */
    FORM_READ,

    /**
     * Permission to submit responses to forms.
     *
     * @since v.0.1
     */
    FORM_SUBMIT,

    /**
     * Permission to update existing forms.
     *
     * @since v.0.1
     */
    FORM_UPDATE,

    /**
     * Permission to delete forms.
     *
     * @since v.0.1
     */
    FORM_DELETE,

    /**
     * Permission to view form submissions/responses.
     *
     * @since v.0.1
     */
    RESPONSE_READ,

    /**
     * Permission to delete form submissions/responses.
     *
     * @since v.0.1
     */
    RESPONSE_DELETE,

    /**
     * Permission to view user information.
     *
     * @since v.0.1
     */
    USER_READ,

    /**
     * Permission to update user information, including roles and ban status.
     *
     * @since v.0.1
     */
    USER_UPDATE,

    /**
     * Permission to manage roles (create, update, delete, assign permissions).
     *
     * @since v.0.1
     */
    ROLE_MANAGE,

    /**
     * Permission to access the admin dashboard and view statistics.
     *
     * @since v.0.1
     */
    DASHBOARD_READ,
}