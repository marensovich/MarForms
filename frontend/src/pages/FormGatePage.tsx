import {useEffect, useState} from "react";
import {Navigate, useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {resolveFormLink} from "../api/forms";
import {ApiError} from "../api/client";
import LoadingScreen from "../components/LoadingScreen";
import AccessScreen from "../components/access/AccessScreen";

/**
 * Old by-ID links (`/forms/{id}`) — still shared in Discord from before
 * slugs existed. Resolves the form's slug and redirects to `/f/{slug}`,
 * which handles access, closed forms and login.
 */
export default function FormGatePage() {
    const {t} = useTranslation();
    const {formId = ""} = useParams<{ formId: string }>();
    const [result, setResult] = useState<{ slug?: string; failed?: "not_found" | "error" } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        resolveFormLink(formId, controller.signal)
            .then(({slug}) => setResult({slug}))
            .catch(err => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setResult({failed: err instanceof ApiError && err.status === 404 ? "not_found" : "error"});
            });
        return () => controller.abort();
    }, [formId]);

    if (!result) return <LoadingScreen label={t("formGate.loadingForm")}/>;
    if (result.slug) return <Navigate to={`/f/${result.slug}`} replace/>;
    return result.failed === "not_found" ? <AccessScreen code="FORM_NOT_FOUND"/> : <AccessScreen code="ERROR" onRetry={() => window.location.reload()}/>;
}
