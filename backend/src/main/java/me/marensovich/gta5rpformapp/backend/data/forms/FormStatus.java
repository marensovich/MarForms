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
 * Transitions follow ТЗ 4.4.2 ({@link #canMoveTo}); an archived form comes back
 * only as a draft copy ({@code POST …/forms/{id}/copy}).
 *
 * @since v.0.1
 */
public enum FormStatus {
    DRAFT,
    PUBLISHED,
    CLOSED,
    ARCHIVED;

    /** Whether ТЗ 4.4.2 allows moving from this status to {@code target}; staying put always is. */
    public boolean canMoveTo(FormStatus target) {
        if (target == this) return true;
        return switch (this) {
            case DRAFT -> target == PUBLISHED;
            case PUBLISHED -> target == CLOSED || target == ARCHIVED;
            case CLOSED -> target == PUBLISHED || target == ARCHIVED;
            case ARCHIVED -> false;
        };
    }
}
