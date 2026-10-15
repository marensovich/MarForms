package me.marensovich.gta5rpformapp.backend.data.forms;

/**
 * What happened to a submission (#118, ТЗ 4.5 transitions).
 *
 * @since v.0.1
 */
public enum SubmissionEventType {
    /** The respondent sent the form: → PENDING. */
    SUBMITTED,
    /** A moderator or the owner decided: PENDING → APPROVED, REJECTED or NEEDS_REVISION. */
    DECIDED,
    /** The owner reopened a decision: APPROVED or REJECTED → PENDING. */
    REOPENED,
    /** The respondent sent it again after revision: NEEDS_REVISION → PENDING. */
    RESUBMITTED
}
