// Both journals — the platform's and a server's — fold a run of the same action
// by the same person on the same object into one line, from its first to its
// last moment (2026-10-19). The server already merges back-to-back form edits
// as it writes them; this also folds older entries and any other run.

/** Entries this close to each other join one run. */
export const RUN_GAP_MS = 10 * 60 * 1000;

interface Entry {
    id: string;
    action: string;
    actorDiscordId: string | null;
    targetId: string | null;
    createdAt: string;
    lastAt?: string | null;
}

/** A line of the journal: one entry, or a run of them. */
export type Run<T> = T & {
    /** The run's entries, newest first; one for a single entry. */
    runOf: T[];
    /** How many actions the line stands for, merged ones included. */
    count: number;
};

const end = (e: Entry) => new Date(e.lastAt ?? e.createdAt).getTime();
const editsOf = (e: Entry & { metadata?: Record<string, unknown> | null; edits?: number }) =>
    typeof e.edits === "number" ? e.edits : typeof e.metadata?.edits === "number" ? e.metadata.edits : 1;

/**
 * Folds runs in a newest-first list. A line keeps its newest entry's fields
 * but spans the run: createdAt of the oldest, lastAt of the newest.
 */
export function foldRuns<T extends Entry & { metadata?: Record<string, unknown> | null; edits?: number }>(entries: T[]): Run<T>[] {
    const lines: Run<T>[] = [];
    for (const e of entries) {
        const last = lines[lines.length - 1];
        const head = last?.runOf[last.runOf.length - 1];
        const joins = last && head && last.action === e.action && last.actorDiscordId === e.actorDiscordId
            && last.actorDiscordId !== null && last.targetId === e.targetId
            && new Date(head.createdAt).getTime() - end(e) <= RUN_GAP_MS;
        if (joins) {
            last.runOf.push(e);
            last.count += editsOf(e);
            last.createdAt = e.createdAt;
            continue;
        }
        lines.push({...e, lastAt: e.lastAt ?? (null as T["lastAt"]), runOf: [e], count: editsOf(e)});
    }
    for (const line of lines) {
        // A line of several entries ends where its newest one did.
        if (line.runOf.length > 1) line.lastAt = (line.runOf[0].lastAt ?? line.runOf[0].createdAt) as T["lastAt"];
    }
    return lines;
}

/** The diff of a run, per field: before its first change, after its last; a field put back drops out. */
export function foldDiff<D extends { field: string; before: string | null; after: string | null }>(newestFirst: D[][]): D[] {
    const byField = new Map<string, D>();
    for (const diff of [...newestFirst].reverse()) {
        for (const change of diff) {
            const seen = byField.get(change.field);
            byField.set(change.field, seen ? {...seen, after: change.after} : {...change});
        }
    }
    return [...byField.values()].filter(c => c.before !== c.after);
}
