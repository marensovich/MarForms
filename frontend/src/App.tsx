import {Navigate, Route, Routes, useLocation} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import AuthCallback from "./pages/AuthCallback";
import FormGatePage from "./pages/FormGatePage";
import PublicFormPage from "./pages/PublicFormPage";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./shell/DashboardLayout";
import AdminRoute from "./shell/AdminRoute";
import GuildWorkspaceRoute from "./shell/GuildWorkspaceRoute";
import ServersTab from "./components/dashboard/ServersTab";
import MySubmissionsPage from "./pages/MySubmissionsPage";
import HomeRedirect from "./pages/HomeRedirect";
import AccessScreen from "./components/access/AccessScreen";
import {useAuth} from "./hooks/useAuth.ts";

export default function App() {

    const {banData} = useAuth();

    if (banData) {
        // ACCOUNT_RESTRICTED (ТЗ 3.5): the auth filter refuses every request of a restricted account.
        return <AccessScreen code="ACCOUNT_RESTRICTED" restrictionMessage={banData.message}
                             details={{until: banData.until ?? undefined, appealsContact: banData.contact || undefined}}/>;
    }

    return (
        <Routes>
            <Route path="/" element={<LandingPage/>}/>
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/auth" element={<AuthCallback/>}/>
            <Route path="/forms/:formId" element={<FormGatePage/>}/>
            <Route path="/f/:slug" element={<PublicFormPage/>}/>

            <Route element={<ProtectedRoute/>}>
                <Route path="/home" element={<HomeRedirect/>}/>
                <Route element={<DashboardLayout/>}>
                    <Route path="/dashboard" element={<ToServers/>}/>
                    <Route path="/dashboard/servers" element={<ServersTab/>}/>
                    <Route path="/dashboard/servers/:guildId" element={<Navigate to="forms" replace/>}/>
                    <Route path="/dashboard/servers/:guildId/:section" element={<GuildWorkspaceRoute/>}/>
                    <Route path="/admin" element={<ToServers/>}/>
                    <Route path="/admin/:section" element={<AdminRoute/>}/>
                </Route>
                <Route path="/me/submissions" element={<MySubmissionsPage/>}/>
            </Route>

            <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
    );
}
/**
 * Old /dashboard links land on the servers page, keeping the query (billing return).
 * The guild-connect callback (/dashboard?connectedGuild=…) shows its result banner on
 * the platform forms page, where the connect button is until #151.
 */
function ToServers() {
    const {search} = useLocation();
    const params = new URLSearchParams(search);
    const connectResult = params.has("connectedGuild") || params.has("guildConnectError");
    return <Navigate to={{pathname: connectResult ? "/admin/forms" : "/dashboard/servers", search}} replace/>;
}
