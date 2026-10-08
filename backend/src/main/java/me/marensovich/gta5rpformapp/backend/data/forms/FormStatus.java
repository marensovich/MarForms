package me.marensovich.gta5rpformapp.backend.data.forms;

/**
 * Lifecycle of a form (product spec, task #39).
 * <ul>
 *     <li>{@link #DRAFT} — being built, not reachable publicly.</li>
 *     <li>{@link #PUBLISHED} — has a slug and accepts submissions (within
 *     its {@code opensAt}/{@code closesAt} window).</li>
 *     <li>{@link #CLOSED} — still visible to moderators, no longer accepts
 *     submissions; can be re-published.</li>
 *     <li>{@link #ARCHIVED} — hidden from the default list, read-only.</li>
 * </ul>
 *
 * @since v.0.1
 */
public enum FormStatus {
    DRAFT,
    PUBLISHED,
    CLOSED,
    ARCHIVED
}
