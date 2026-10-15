import {Navigate, useNavigate, useParams} from "react-router-dom";
import GuildFormsPanel from "../components/dashboard/GuildFormsPanel";
import GuildAuditPanel from "../components/dashboard/moderation/GuildAuditPanel";
import GuildModerationPanel from "../components/dashboard/moderation/GuildModerationPanel";
import {TabSkeleton} from "../components/dashboard/shared";
import {useDashboard} from "./dashboardContext";
import {GUILD_SECTIONS, type GuildSection} from "./navigation";
import NoAccess from "./NoAccess";

/**
 * /dashboard/servers/:guildId/:section — a server's workspace section as a page
 * (linkable, survives reload). The header and tabs of the workspace come with #126.
 */
export default function GuildWorkspaceRoute() {
    const {guildId, section} = useParams();
    const navigate = useNavigate();
    const {guilds} = useDashboard();

    if (!GUILD_SECTIONS.includes(section as GuildSection)) {
        return <Navigate to={`/dashboard/servers/${guildId}/forms`} replace/>;
    }
    if (guilds === null) return <TabSkeleton rows={4}/>;
    const guild = guilds.find(g => g.guildId === guildId);
    if (!guild) return <NoAccess/>;

    const back = () => navigate("/dashboard/servers");
    switch (section as GuildSection) {
        case "submissions":
            return <GuildModerationPanel guild={guild} onBack={back}/>;
        case "audit":
            return <GuildAuditPanel guild={guild} onBack={back}/>;
        default:
            return <GuildFormsPanel guild={guild} onBack={back}/>;
    }
}
