package me.marensovich.gta5rpformapp.backend.data.forms;

/**
 * Moderation state of a submission (task #47). Every submission starts as
 * {@link #PENDING}; moderators move it to one of the others (E1.3).
 *
 * @since v.0.1
 */
public enum SubmissionStatus {
    PENDING,
    APPROVED,
    REJECTED,
    NEEDS_REVISION
}
