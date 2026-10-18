package me.marensovich.gta5rpformapp.backend.exception;

import org.springframework.security.access.AccessDeniedException;

/**
 * An action on a user of a higher platform role (ТЗ 2.3): 403 with the reason,
 * unlike a plain {@link AccessDeniedException}, whose message stays generic.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public class HierarchyException extends AccessDeniedException {

    public HierarchyException(String message) {
        super(message);
    }
}
