package me.marensovich.gta5rpformapp.backend.service.files;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Limits for {@code FILE_UPLOAD} fields (E3.2, #84), shared by schema
 * validation and upload intake.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class FileRules {

    /** Platform cap on one file, whatever a field allows. */
    public static final int MAX_SIZE_MB = 25;

    /** A field's size limit when its creator set none. */
    public static final int DEFAULT_SIZE_MB = 10;

    /** Allowed when a field lists no extensions. */
    public static final List<String> DEFAULT_EXTENSIONS =
            List.of("pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "doc", "docx", "xls", "xlsx", "zip");

    /** Never accepted: files that run when a moderator opens them. */
    public static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl", "vbs", "vbe", "js", "jse", "wsf", "wsh",
            "ps1", "psm1", "sh", "jar", "app", "dmg", "apk", "lnk", "reg", "hta", "dll");

    private static final Pattern EXTENSION = Pattern.compile("^[a-z0-9]{1,10}$");

    private FileRules() {
    }

    /**
     * Normalizes an extension as typed by a form creator (".PDF " → "pdf").
     *
     * @param raw the extension
     * @return the normalized extension, or {@code null} if it isn't a plausible one
     */
    public static String normalizeExtension(String raw) {
        if (raw == null) return null;
        String e = raw.trim().toLowerCase(Locale.ROOT);
        if (e.startsWith(".")) e = e.substring(1);
        return EXTENSION.matcher(e).matches() ? e : null;
    }

    /**
     * The extension of a file name, lower-cased, or {@code ""} if none.
     *
     * @param fileName the file name
     * @return its extension
     */
    public static String extensionOf(String fileName) {
        if (fileName == null) return "";
        int dot = fileName.lastIndexOf('.');
        return dot < 0 || dot == fileName.length() - 1 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
