package me.marensovich.gta5rpformapp.backend.service.billing;

/**
 * What a plan limits (spec раздел 7, принцип 3).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public enum PlanMetric {
    /** Forms that aren't archived: drafts, published and closed ones. */
    ACTIVE_FORMS,
    /** Submissions to the guild's forms this calendar month (server time). Never blocks respondents. */
    SUBMISSIONS_PER_MONTH,
    /** Moderators, the owner not counted. */
    MODERATORS,
    /** Files attached to the guild's submissions, in megabytes (ТЗ 4.9.1). Shown to the owner; never blocks respondents. */
    FILE_STORAGE
}
