package me.marensovich.gta5rpformapp.backend.dto.user;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * A platform time-out (ТЗ 6.3): no submissions and no panel for a while.
 *
 * @param minutes how long, a minute to a year
 * @param reason  why — required, the user sees it
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record TimeoutRequest(
        @NotNull @Min(1) @Max(525_600) Long minutes,
        @NotBlank @Size(max = 500) String reason
) {
}
