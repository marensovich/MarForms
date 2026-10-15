import {Navigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import LoadingScreen from "../components/LoadingScreen";
import {MY_SUBMISSIONS_PATH, PANEL_PATH, useHasPanel} from "../auth/useHomePath";

/**
 * Where a sign-in without a page to return to lands: the panel for staff, owners
 * and moderators, «Мои заявки» for respondents (ТЗ 3.2.3; there is no catalogue).
 */
export default function HomeRedirect() {
    const {t} = useTranslation();
    const panel = useHasPanel();
    if (panel === null) return <LoadingScreen label={t("auth.signingIn")}/>;
    return <Navigate to={panel ? PANEL_PATH : MY_SUBMISSIONS_PATH} replace/>;
}
