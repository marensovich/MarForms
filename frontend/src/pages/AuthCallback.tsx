import {useEffect, useRef, useState} from "react";
import {Link, useNavigate, useSearchParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {FiXCircle} from "react-icons/fi";
import {useAuth} from "../hooks/useAuth";
import {consumeRedirectPath} from "../auth/redirectStorage";
import {exchangeLoginCode, loginWithDiscord} from "../api/auth";

// Docs: docs/design/mockups/Login.dc.html (/auth/callback · загрузка, · ошибка); ТЗ 3.2.3–3.2.4.

/** Error codes with their own text; any other one reads as "Discord is unavailable". */
const KNOWN_ERRORS = ["access_denied", "authorization_request_not_found", "code_expired"];

export default function AuthCallback() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {login} = useAuth();
    const hasRun = useRef(false);
    // A failure the backend reported (?error=…&ref=…) or a code that no longer exchanges.
    const [failure, setFailure] = useState<{ error: string; ref: string | null } | null>(() => {
        const error = searchParams.get("error");
        if (error) return {error, ref: searchParams.get("ref")};
        return searchParams.get("code") ? null : {error: "access_denied", ref: null};
    });

    useEffect(() => {
        if (hasRun.current || failure) return;
        hasRun.current = true;

        // The redirect carries a one-time code, never the token itself (#103).
        exchangeLoginCode(searchParams.get("code")!)
            .then(token => login(token))
            .then(() => {
                // No page to return to: the panel or «Мои заявки», by role.
                navigate(consumeRedirectPath() ?? "/home", {replace: true});
            })
            .catch(() => setFailure({error: "code_expired", ref: null}));
    }, [searchParams, login, navigate, failure]);

    if (!failure) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-bg px-8 text-center text-tx">
                <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="animate-spin">
                    <circle cx="24" cy="24" r="20" fill="none" className="stroke-bd" strokeWidth="5"/>
                    <path d="M24 4a20 20 0 0 1 20 20" fill="none" className="stroke-pr" strokeWidth="5" strokeLinecap="round"/>
                </svg>
                <div role="status" className="flex flex-col gap-2">
                    <h1 className="m-0 text-[22px] font-bold">{t("auth.signingIn")}</h1>
                    <p className="m-0 text-[15px] leading-normal text-mu">{t("auth.signingInText")}</p>
                </div>
            </main>
        );
    }

    const kind = KNOWN_ERRORS.includes(failure.error) ? failure.error : "unavailable";
    return (
        <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-7 text-tx">
            <div role="alert" className="flex w-full max-w-[400px] flex-col gap-5">
                <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-rdb text-rdt">
                    <FiXCircle size={26} aria-hidden="true"/>
                </span>
                <div className="flex flex-col gap-2">
                    <h1 className="m-0 text-2xl font-bold">{t("auth.failedTitle")}</h1>
                    <p className="m-0 text-[15px] leading-normal text-mu">{t(`auth.errors.${kind}`)}</p>
                </div>
                <div className="rounded-[10px] border border-bd bg-s2 px-3 py-2.5 font-mono text-xs text-mu">
                    error={failure.error}{failure.ref && ` · ref ${failure.ref}`}
                </div>
                <div className="flex flex-col gap-2.5">
                    <button type="button" onClick={loginWithDiscord}
                            className="h-12 rounded-xl bg-pr text-[15px] font-semibold text-white hover:bg-prh">
                        {t("auth.retry")}
                    </button>
                    <Link to="/" className="flex h-12 items-center justify-center rounded-xl text-[15px] font-medium text-tx hover:bg-s2">
                        {t("login.home")}
                    </Link>
                </div>
            </div>
        </main>
    );
}
