package me.marensovich.gta5rpformapp.backend.service.billing;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.exception.PlanLimitExceededException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * Plan limits (E4.1, #93/#94): how much of each metric a guild uses
 * against what its {@link PlanTier} allows ({@link PlanLimitsProperties}).
 * <p>
 * Only owner actions are ever refused ({@link #requireRoomFor}: creating
 * a form, adding a moderator). Submissions are never refused, whatever the
 * plan (spec раздел 7, принцип 1: no paywall for respondents): going over
 * {@link PlanMetric#SUBMISSIONS_PER_MONTH} only shows as exceeded in the
 * owner's panel.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class PlanLimitService {

    private final PlanLimitsProperties properties;
    private final GuildRepository guildRepository;
    private final FormRepository formRepository;
    private final SubmissionRepository submissionRepository;
    private final GuildMembershipRepository guildMembershipRepository;
    private final me.marensovich.gta5rpformapp.backend.database.repository.SubmissionFileRepository submissionFileRepository;

    private static final long MEGABYTE = 1024 * 1024;

    /**
     * One metric's usage.
     *
     * @param metric the metric
     * @param used   how much is used now
     * @param limit  the plan's limit, {@code null} if unlimited
     */
    public record Usage(PlanMetric metric, long used, Integer limit) {
        /**
         * @return whether usage has reached or passed the limit
         */
        public boolean atLimit() {
            return limit != null && used >= limit;
        }
    }

    /**
     * A guild's plan and usage of every metric.
     *
     * @param plan  the guild's tier
     * @param usage one entry per metric
     */
    public record GuildUsage(PlanTier plan, List<Usage> usage) {
    }

    /**
     * @param guildId the Discord guild snowflake ID
     * @return the guild's plan and usage of every metric
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public GuildUsage usage(Long guildId) {
        PlanTier plan = planOf(guildId);
        return new GuildUsage(plan, List.of(
                usage(guildId, plan, PlanMetric.ACTIVE_FORMS),
                usage(guildId, plan, PlanMetric.SUBMISSIONS_PER_MONTH),
                usage(guildId, plan, PlanMetric.MODERATORS),
                usage(guildId, plan, PlanMetric.FILE_STORAGE)));
    }

    /**
     * Whether a guild is within its limit for a metric.
     *
     * @param guildId the Discord guild snowflake ID
     * @param metric  the metric
     * @return {@code true} if under the limit (or unlimited)
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public boolean isWithinLimit(Long guildId, PlanMetric metric) {
        return !usage(guildId, planOf(guildId), metric).atLimit();
    }

    /**
     * Refuses an owner action that would add one more of {@code metric}
     * over the plan's limit.
     *
     * @param guildId the Discord guild snowflake ID
     * @param metric  {@code ACTIVE_FORMS} or {@code MODERATORS}
     * @throws PlanLimitExceededException if the guild is already at its limit
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public void requireRoomFor(Long guildId, PlanMetric metric) {
        if (metric == PlanMetric.SUBMISSIONS_PER_MONTH || metric == PlanMetric.FILE_STORAGE) {
            throw new IllegalArgumentException("Respondents are never refused for plan limits");
        }
        PlanTier plan = planOf(guildId);
        Usage usage = usage(guildId, plan, metric);
        if (usage.atLimit()) {
            String what = metric == PlanMetric.ACTIVE_FORMS ? "forms (archived ones don't count)" : "moderators";
            throw new PlanLimitExceededException(metric, usage.limit(), plan,
                    "The " + plan + " plan allows up to " + usage.limit() + " " + what
                            + ". Archive or remove one, or upgrade the plan.");
        }
    }

    private PlanTier planOf(Long guildId) {
        return guildRepository.findById(guildId).map(Guild::getPlanTier).orElse(PlanTier.FREE);
    }

    private Usage usage(Long guildId, PlanTier plan, PlanMetric metric) {
        PlanLimitsProperties.Limits limits = properties.of(plan);
        return switch (metric) {
            case ACTIVE_FORMS -> new Usage(metric,
                    formRepository.countByServerIdAndStatusNot(guildId, FormStatus.ARCHIVED), limits.activeForms());
            case MODERATORS -> new Usage(metric,
                    guildMembershipRepository.countByGuild_DiscordGuildIdAndRole(guildId, GuildRole.MODERATOR),
                    limits.moderators());
            case SUBMISSIONS_PER_MONTH -> {
                List<UUID> formIds = formRepository.findIdsByServerId(guildId);
                LocalDateTime monthStart = YearMonth.now().atDay(1).atStartOfDay();
                long count = formIds.isEmpty() ? 0
                        : submissionRepository.countByFormIdInAndCreatedAtGreaterThanEqual(formIds, monthStart);
                yield new Usage(metric, count, limits.submissionsPerMonth());
            }
            case FILE_STORAGE -> {
                List<UUID> formIds = formRepository.findIdsByServerId(guildId);
                long bytes = formIds.isEmpty() ? 0 : submissionFileRepository.totalBytes(formIds);
                yield new Usage(metric, (bytes + MEGABYTE - 1) / MEGABYTE, limits.fileStorageMb());
            }
        };
    }
}
