import {Navigate, useNavigate, useParams, useSearchParams} from "react-router-dom";
import GuildFormsPanel from "../components/dashboard/GuildFormsPanel";
import GuildAuditPanel from "../components/dashboard/moderation/GuildAuditPanel";
import GuildModerationPanel from "../components/dashboard/moderation/GuildModerationPanel";
import ModeratorsModal from "../components/dashboard/ModeratorsModal";
import BansModal from "../components/dashboard/BansModal";
import BillingModal from "../components/dashboard/BillingModal";
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
    const navigate = useNavigate();
    const {guilds} = useDashboard();
    // Back from Stripe Checkout (billing is paused, #132): …/billing?checkout=success|cancel.
    const checkout = useSearchParams()[0].get("checkout");

    if (!GUILD_SECTIONS.includes(section as GuildSection)) {
        return <Navigate to={`/dashboard/servers/${guildId}/forms`} replace/>;
    }
    if (guilds === null) return <TabSkeleton rows={4}/>;
    const guild = guilds.find(g => g.guildId === guildId);
    if (!guild) return <NoAccess/>;
    const tab = section as GuildSection;
    if (OWNER_ONLY_SECTIONS.includes(tab) && guild.role !== "OWNER") return <NoAccess/>;

    const back = () => navigate(`/dashboard/servers/${guild.guildId}/forms`);
    const page = (() => {
        switch (tab) {
            case "submissions":
                return <GuildModerationPanel guild={guild}/>;
            case "audit":
                return <GuildAuditPanel guild={guild}/>;
            case "moderators":
                return <ModeratorsModal guild={guild} onClose={back} asPage/>;
            case "bans":
                return <BansModal guild={guild} onClose={back} asPage/>;
            case "billing":
                return <BillingModal guild={guild} ownedGuilds={guilds.filter(g => g.role === "OWNER")} onClose={back} asPage
                                     checkoutResult={checkout === "success" || checkout === "cancel" ? checkout : null}/>;
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
