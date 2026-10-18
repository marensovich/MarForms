import {Navigate, useParams} from "react-router-dom";
import GuildFormsPanel from "../components/dashboard/GuildFormsPanel";
import GuildAuditPanel from "../components/dashboard/moderation/GuildAuditPanel";
import GuildModerationPanel from "../components/dashboard/moderation/GuildModerationPanel";
import ModeratorsPanel from "../components/dashboard/moderation/ModeratorsPanel";
import BansPanel from "../components/dashboard/moderation/BansPanel";
import BillingPanel from "../components/dashboard/moderation/BillingPanel";
import {TabSkeleton} from "../components/dashboard/shared";
import {useDashboard} from "./dashboardContext";
import GuildWorkspaceHeader from "./GuildWorkspaceHeader";
import {GUILD_SECTIONS, type GuildSection, OWNER_ONLY_SECTIONS} from "./navigation";
import NoAccess from "./NoAccess";

/**
 * /dashboard/servers/:guildId/:section — a server's workspace (ТЗ 4.3, #126):
 * its header and tabs, and the tab's page (linkable, survives reload).
 */
export default function GuildWorkspaceRoute() {
    const {guildId, section} = useParams();
    const {guilds} = useDashboard();

    if (!GUILD_SECTIONS.includes(section as GuildSection)) {
        return <Navigate to={`/dashboard/servers/${guildId}/forms`} replace/>;
    }
    if (guilds === null) return <TabSkeleton rows={4}/>;
    const guild = guilds.find(g => g.guildId === guildId);
    if (!guild) return <NoAccess/>;
    const tab = section as GuildSection;
    if (OWNER_ONLY_SECTIONS.includes(tab) && guild.role !== "OWNER") return <NoAccess/>;

    const page = (() => {
        switch (tab) {
            case "submissions":
                return <GuildModerationPanel guild={guild}/>;
            case "audit":
                return <GuildAuditPanel guild={guild}/>;
            case "moderators":
                return <ModeratorsPanel guild={guild}/>;
            case "bans":
                return <BansPanel guild={guild}/>;
            case "billing":
                return <BillingPanel guild={guild}/>;
            default:
                return <GuildFormsPanel guild={guild}/>;
        }
    })();

    return (
        <>
            <GuildWorkspaceHeader guild={guild} section={tab}/>
            <div>{page}</div>
        </>
    );
}
