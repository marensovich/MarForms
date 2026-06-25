package me.marensovich.gta5rpformapp.backend.data.settings;

/**
 * System settings record containing all configurable application parameters.
 * <p>
 * Settings are organized into categories:
 * <ul>
 *     <li><b>General</b> — system-wide settings like name, contact, and ban messages</li>
 *     <li><b>Audit Log</b> — Discord webhook configuration for audit logging</li>
 *     <li><b>Global Embed</b> — default Discord embed styling for all notifications</li>
 * </ul>
 * </p>
 * <p>
 * All settings are stored as key-value pairs in the database and loaded
 * into this record at runtime.
 * </p>
 *
 * @param banMessage             the message shown to banned users
 * @param banAdminContact        the contact information for banned users to appeal
 * @param systemName             the display name of the system
 * @param systemContact          the general system contact information
 * @param logWebhookUrl          the Discord webhook URL for audit logs
 * @param logEnabledActions      comma-separated {@link me.marensovich.gta5rpformapp.backend.data.audit.AuditAction} names.
 *                               Empty string means all actions are enabled
 * @param globalEmbedColor       the default embed color (decimal integer or #RRGGBB)
 * @param globalEmbedTitle       the default embed title
 * @param globalEmbedDescription the default embed description
 * @param globalEmbedAuthorName  the default author name for embeds
 * @param globalEmbedAuthorIcon  the default author icon URL
 * @param globalEmbedAuthorUrl   the default author link URL
 * @param globalEmbedThumbnail   the default thumbnail image URL
 * @param globalEmbedImage       the default large image URL
 * @param globalEmbedFooterText  the default footer text
 * @param globalEmbedFooterIcon  the default footer icon URL
 * @param uiLanguage             the admin panel UI language ("en" or "ru")
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record SystemSettings(
        String banMessage,
        String banAdminContact,
        String systemName,
        String systemContact,
        String logWebhookUrl,
        String logEnabledActions,
        String globalEmbedColor,
        String globalEmbedTitle,
        String globalEmbedDescription,
        String globalEmbedAuthorName,
        String globalEmbedAuthorIcon,
        String globalEmbedAuthorUrl,
        String globalEmbedThumbnail,
        String globalEmbedImage,
        String globalEmbedFooterText,
        String globalEmbedFooterIcon,
        String uiLanguage
) {

    /**
     * Configuration key for the ban message.
     *
     * @since v.0.1
     */
    public static final String KEY_BAN_MESSAGE = "ban.message";

    /**
     * Configuration key for the ban admin contact.
     *
     * @since v.0.1
     */
    public static final String KEY_BAN_ADMIN_CONTACT = "ban.admin.contact";

    /**
     * Configuration key for the system name.
     *
     * @since v.0.1
     */
    public static final String KEY_SYSTEM_NAME = "system.name";

    /**
     * Configuration key for the system contact.
     *
     * @since v.0.1
     */
    public static final String KEY_SYSTEM_CONTACT = "system.contact";

    /**
     * Configuration key for the audit log webhook URL.
     *
     * @since v.0.1
     */
    public static final String KEY_LOG_WEBHOOK_URL = "log.webhook.url";

    /**
     * Configuration key for enabled audit actions.
     *
     * @since v.0.1
     */
    public static final String KEY_LOG_ENABLED_ACTIONS = "log.enabled.actions";

    /**
     * Configuration key for the global embed color.
     *
     * @since v.0.1
     */
    public static final String KEY_G_COLOR = "global.embed.color";

    /**
     * Configuration key for the global embed title.
     *
     * @since v.0.1
     */
    public static final String KEY_G_TITLE = "global.embed.title";

    /**
     * Configuration key for the global embed description.
     *
     * @since v.0.1
     */
    public static final String KEY_G_DESC = "global.embed.description";

    /**
     * Configuration key for the global embed author name.
     *
     * @since v.0.1
     */
    public static final String KEY_G_AUTHOR_NAME = "global.embed.author.name";

    /**
     * Configuration key for the global embed author icon.
     *
     * @since v.0.1
     */
    public static final String KEY_G_AUTHOR_ICON = "global.embed.author.icon";

    /**
     * Configuration key for the global embed author URL.
     *
     * @since v.0.1
     */
    public static final String KEY_G_AUTHOR_URL = "global.embed.author.url";

    /**
     * Configuration key for the global embed thumbnail.
     *
     * @since v.0.1
     */
    public static final String KEY_G_THUMBNAIL = "global.embed.thumbnail";

    /**
     * Configuration key for the global embed image.
     *
     * @since v.0.1
     */
    public static final String KEY_G_IMAGE = "global.embed.image";

    /**
     * Configuration key for the global embed footer text.
     *
     * @since v.0.1
     */
    public static final String KEY_G_FOOTER_TEXT = "global.embed.footer.text";

    /**
     * Configuration key for the global embed footer icon.
     *
     * @since v.0.1
     */
    public static final String KEY_G_FOOTER_ICON = "global.embed.footer.icon";

    /**
     * Configuration key for the admin panel UI language.
     *
     * @since v.0.1
     */
    public static final String KEY_UI_LANGUAGE = "ui.language";
}