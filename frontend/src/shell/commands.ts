import type {MyGuild} from "../api/dashboard";
import type {FormHit, SubmissionHit, UserHit} from "../api/search";

// Where palette hits and actions lead (#107). Kept apart from the components for fast refresh.

export function formTarget(hit: FormHit): string {
    return hit.workspace && hit.guildId
        ? `/dashboard/servers/${hit.guildId}/forms`
        : `/admin/forms?search=${encodeURIComponent(hit.slug ?? hit.title)}`;
}

export function submissionTarget(hit: SubmissionHit): string {
    return hit.workspace && hit.guildId
        ? `/dashboard/servers/${hit.guildId}/submissions?submission=${hit.id}`
        : `/admin/submissions?submission=${hit.id}`;
}

export function userTarget(hit: UserHit): string {
    return `/admin/users?search=${encodeURIComponent(hit.discordId)}`;
}

/** "Новая форма": straight into the wizard when the user runs one server, else the server list. */
export function newFormTarget(guilds: MyGuild[] | null): string {
    return guilds && guilds.length === 1 ? `/dashboard/servers/${guilds[0].guildId}/forms?new=1` : "/dashboard/servers";
}

/** "Перейти в очередь модерации": the only server's queue, else the server list. */
export function queueTarget(guilds: MyGuild[] | null): string {
    return guilds && guilds.length === 1 ? `/dashboard/servers/${guilds[0].guildId}/submissions` : "/dashboard/servers";
}

/** Keyboard shortcuts stay quiet while the user types into a field. */
export function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
