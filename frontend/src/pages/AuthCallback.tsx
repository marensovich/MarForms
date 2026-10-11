import {useEffect, useRef} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {useAuth} from "../hooks/useAuth";
import {consumeRedirectPath} from "../auth/redirectStorage";
import {exchangeLoginCode} from "../api/auth";
import LoadingScreen from "../components/LoadingScreen";

export default function AuthCallback() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {login} = useAuth();
    const hasRun = useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        // The redirect carries a one-time code, never the token itself (#103).
        const code = searchParams.get("code");

        if (!code) {
            navigate("/login", {replace: true});
            return;
        }

        exchangeLoginCode(code)
            .then(token => login(token))
            .then(() => {
                const redirectPath = consumeRedirectPath();
                navigate(redirectPath ?? "/", {replace: true});
            })
            .catch(() => navigate("/login", {replace: true}));
    }, [searchParams, login, navigate]);

    return <LoadingScreen label={t("auth.signingIn")}/>;
}