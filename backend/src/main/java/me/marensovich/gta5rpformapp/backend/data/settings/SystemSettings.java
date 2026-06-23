package me.marensovich.gta5rpformapp.backend.data.settings;

public record SystemSettings(
        String banMessage,
        String banAdminContact,
        String systemName,
        String systemContact
) {
    public static final String KEY_BAN_MESSAGE = "ban.message";
    public static final String KEY_BAN_ADMIN_CONTACT = "ban.admin.contact";
    public static final String KEY_SYSTEM_NAME = "system.name";
    public static final String KEY_SYSTEM_CONTACT = "system.contact";
}