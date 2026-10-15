import {useEffect, useState} from "react";
import {getMyGuilds, type MyGuild} from "../api/dashboard";
import type {AuthUser} from "../types/auth";
import {useAuth} from "../hooks/useAuth";

export const PANEL_PATH = "/dashboard/servers";
export const MY_SUBMISSIONS_PATH = "/me/submissions";

/**
 * Whether the user has a panel to go to: platform staff, someone who may connect
 * servers, or an owner/moderator of a connected server (ТЗ 2.1). Everyone else is
 * a respondent — no public catalogue, so their home is «Мои заявки».
 */
export function hasPanel(user: AuthUser | null, guilds: MyGuild[]): boolean {
    const perms = user?.permissions ?? [];
    return perms.includes("DASHBOARD_ACCESS") || perms.includes("FORMS_MANAGE")
        || guilds.some(g => g.role !== "RESPONDENT");
}

export function homePath(user: AuthUser | null, guilds: MyGuild[]): string {
    return hasPanel(user, guilds) ? PANEL_PATH : MY_SUBMISSIONS_PATH;
}

/**
 * Whether the signed-in user has a panel; null while unknown (signed out,
 * session or guilds still loading).
 */
export function useHasPanel(): boolean | null {
    const {user, loading} = useAuth();
    const [guilds, setGuilds] = useState<MyGuild[] | null>(null);
    const signedIn = !loading && user !== null;

    useEffect(() => {
        if (!signedIn) return;
        let cancelled = false;
        getMyGuilds()
            .then(list => !cancelled && setGuilds(list))
            .catch(() => !cancelled && setGuilds([]));
        return () => {
            cancelled = true;
        };
    }, [signedIn]);

    // Permissions arrive with /me after the token stub; wait for them.
    if (!signedIn || guilds === null || user.permissionsHash === "") return null;
    return hasPanel(user, guilds);
}
