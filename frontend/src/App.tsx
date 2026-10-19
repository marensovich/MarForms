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
import FeedbackPage from "./pages/FeedbackPage";
import HomeRedirect from "./pages/HomeRedirect";
import AccessScreen from "./components/access/AccessScreen";
import FormEditorPage, {NewFormPage} from "./components/builder/FormEditorPage";
import {useAuth} from "./hooks/useAuth.ts";
import PanelGate from "./shell/PanelGate";

export default function App() {

    const {banData} = useAuth();

    if (banData) {
        // ACCOUNT_RESTRICTED (ТЗ 3.5): the auth filter refuses every request of a restricted account.
        return <AccessScreen code="ACCOUNT_RESTRICTED" restrictionMessage={banData.message}
                             details={{until: banData.until ?? undefined, reason: banData.reason ?? undefined, appealsContact: banData.contact || undefined}}/>;
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
                <Route path="/me/submissions" element={<MySubmissionsPage/>}/>
                {/* Feedback about MarForms itself (2026-10-19): open to anyone signed in, like their own pages. */}
                <Route path="/feedback" element={<FeedbackPage/>}/>
                {/* A time-out closes the panel, not the user's own pages (ТЗ 6.3). */}
                <Route element={<PanelGate/>}>
                    <Route element={<DashboardLayout/>}>
                        <Route path="/dashboard" element={<ToServers/>}/>
                        <Route path="/dashboard/servers" element={<ServersTab/>}/>
                        <Route path="/dashboard/servers/:guildId" element={<Navigate to="forms" replace/>}/>
                        <Route path="/dashboard/servers/:guildId/:section" element={<GuildWorkspaceRoute/>}/>
                        <Route path="/admin" element={<ToServers/>}/>
                        <Route path="/admin/:section" element={<AdminRoute/>}/>
                    </Route>
                    {/* The builder takes the whole screen (FormEdit.dc.html): outside the panel's layout. */}
                    <Route path="/dashboard/forms/:formId/edit" element={<FormEditorPage/>}/>
                    <Route path="/dashboard/servers/:guildId/forms/new" element={<NewFormPage/>}/>
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
    );
}
/** Old /dashboard links land on the servers page, keeping the query (billing and bot-install returns). */
function ToServers() {
    const {search} = useLocation();
    return <Navigate to={{pathname: "/dashboard/servers", search}} replace/>;
}
