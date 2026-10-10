package me.marensovich.gta5rpformapp.backend.exception;

import lombok.Getter;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import me.marensovich.gta5rpformapp.backend.service.billing.PlanMetric;

/**
 * An owner action would go over the guild's plan limit (E4.1, #94).
 * Rendered as 402 with the metric and limit, so the panel can explain it
 * and point at an upgrade. Never thrown on a respondent-facing path.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Getter
public class PlanLimitExceededException extends RuntimeException {

    private final PlanMetric metric;
    private final int limit;
    private final PlanTier plan;

    public PlanLimitExceededException(PlanMetric metric, int limit, PlanTier plan, String message) {
        super(message);
        this.metric = metric;
        this.limit = limit;
        this.plan = plan;
    }
}
