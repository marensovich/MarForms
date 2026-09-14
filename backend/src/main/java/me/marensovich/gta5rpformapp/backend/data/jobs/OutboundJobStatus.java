package me.marensovich.gta5rpformapp.backend.data.jobs;

/**
 * Lifecycle status of an {@link me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob}.
 *
 * @since v.0.1
 */
public enum OutboundJobStatus {
    /** Waiting to be picked up (or waiting for {@code nextAttemptAt} after a retry). */
    PENDING,
    /** Delivered/handled successfully, or determined to need no further action. */
    SUCCEEDED,
    /** Exhausted its retries, or hit a permanent (non-retryable) failure. */
    FAILED
}
