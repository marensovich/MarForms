import {useOutletContext} from "react-router-dom";
import type {MyGuild} from "../api/dashboard";

/** What the dashboard layout shares with its pages. */
export interface DashboardContext {
    /** Servers where the user is owner or moderator; null while loading. */
    guilds: MyGuild[] | null;
    reloadGuilds: () => void;
}

export function useDashboard(): DashboardContext {
    return useOutletContext<DashboardContext>();
}
