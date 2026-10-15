package me.marensovich.gta5rpformapp.backend.exception;

import lombok.Getter;
import me.marensovich.gta5rpformapp.backend.data.forms.AccessCode;
import me.marensovich.gta5rpformapp.backend.dto.form.AccessDetailsDto;

/**
 * A submission or upload refused by the form's access rules (#110). The
 * response carries the {@link AccessCode} and its details, so the client shows
 * the same screen as for the form page; the status follows
 * {@link AccessCode#httpStatus()}.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Getter
public class FormAccessException extends RuntimeException {

    private final AccessCode code;
    private final AccessDetailsDto details;

    public FormAccessException(AccessCode code, String message, AccessDetailsDto details) {
        super(message);
        this.code = code;
        this.details = details;
    }
}
