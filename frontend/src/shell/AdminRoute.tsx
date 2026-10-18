import {Navigate, useParams} from "react-router-dom";
import FormsTab from "../components/dashboard/FormsTab";
import LogsTab from "../components/dashboard/LogsTab";
import ResponsesTab from "../components/dashboard/ResponsesTab";
import RolesTab from "../components/dashboard/RolesTab";
import SettingsTab from "../components/dashboard/SettingsTab";
import SystemTab from "../components/dashboard/SystemTab";
import UsersTab from "../components/dashboard/UsersTab";
import {useAuth} from "../hooks/useAuth";
import {ADMIN_NAV, type AdminSection, can} from "./navigation";
import NoAccess from "./NoAccess";
import DesktopOnly from "./DesktopOnly";
import {useIsMobile} from "./useIsMobile";

const PAGES: Record<AdminSection, () => React.ReactElement> = {
    forms: () => <FormsTab/>,
    submissions: () => <ResponsesTab/>,
    users: () => <UsersTab/>,
    roles: () => <RolesTab/>,
    logs: () => <LogsTab/>,
    system: () => <SystemTab/>,
    settings: () => <SettingsTab/>,
};

/** /admin/:section — a platform administration page behind its permission (ТЗ 2.2). */
export default function AdminRoute() {
    const {section} = useParams();
    const {user} = useAuth();
    const mobile = useIsMobile();
    const item = ADMIN_NAV.find(n => n.id === section);
    if (!item) return <Navigate to="/dashboard/servers" replace/>;
    if (!can(user, item.permission)) return <NoAccess/>;
    if (mobile) return <DesktopOnly/>;
    return PAGES[item.id]();
}
