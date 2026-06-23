import {Navigate, Route, Routes} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import AuthCallback from "./pages/AuthCallback";
import FormGatePage from "./pages/FormGatePage";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import BannedScreen from "./components/BannedScreen.tsx";
import {useAuth} from "./hooks/useAuth.ts";

export default function App() {

    const {banData} = useAuth();

    if (banData) {
        return <BannedScreen message={banData.message} contact={banData.contact}/>;
    }

    return (
        <Routes>
            <Route path="/" element={<LandingPage/>}/>
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/auth" element={<AuthCallback/>}/>
            <Route path="/forms/:formId" element={<FormGatePage/>}/>

            <Route element={<ProtectedRoute/>}>
                <Route path="/dashboard" element={<DashboardPage/>}/>
            </Route>

            <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
    );
}