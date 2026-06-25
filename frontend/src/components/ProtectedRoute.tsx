import {Navigate, Outlet} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {useAuth} from "../hooks/useAuth";
import LoadingScreen from "./LoadingScreen";

export default function ProtectedRoute() {
    const {t} = useTranslation();
    const {user, loading} = useAuth();

    if (loading) {
        return <LoadingScreen label={t("auth.checkingSession")}/>;
    }

    if (!user) {
        return <Navigate to="/login" replace/>;
    }

    return <Outlet/>;
}
