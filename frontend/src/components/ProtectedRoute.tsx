import {Navigate, Outlet, useLocation} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {useAuth} from "../hooks/useAuth";
import {saveRedirectPath} from "../auth/redirectStorage";
import LoadingScreen from "./LoadingScreen";

export default function ProtectedRoute() {
    const {t} = useTranslation();
    const {user, loading} = useAuth();
    const {pathname, search} = useLocation();

    if (loading) {
        return <LoadingScreen label={t("auth.checkingSession")}/>;
    }

    if (!user) {
        // Back to this page after signing in (ТЗ 3.2.3).
        saveRedirectPath(pathname + search);
        return <Navigate to="/login" replace/>;
    }

    return <Outlet/>;
}
