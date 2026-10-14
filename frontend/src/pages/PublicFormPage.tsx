import {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {useAuth} from "../hooks/useAuth";
import {fetchPublicForm, type PublicForm} from "../api/forms";
import {ApiError} from "../api/client";
import LoadingScreen from "../components/LoadingScreen";
import {
    FormErrorState,
    FormInactiveState,
    FormNotFoundState,
    NotAuthenticatedState,
    BannedState, NotInGuildState, RoleGateState,
} from "../components/AccessStates";
import FormRenderer from "../components/form/FormRenderer";
import type {FormDefinition} from "../types/forms";

type LoadState =
    | { kind: "loading" }
    | { kind: "not_found" }
    | { kind: "error" }
    | { kind: "loaded"; form: PublicForm };

/**
 * The public form page, `/f/{slug}` (task #48).
 * <p>
 * An OPEN form renders straight away, logged in or not; an AUTHENTICATED
 * one asks for Discord login first and brings the respondent back here
 * afterwards (#50). The server's `viewerAccess` is the source of truth —
 * the same check submission intake applies.
 */
export default function PublicFormPage() {
    const {t} = useTranslation();
    const {slug = ""} = useParams<{ slug: string }>();
    const {user, loading: authLoading} = useAuth();
    const [state, setState] = useState<LoadState>({kind: "loading"});

    useEffect(() => {
        // Wait for the session to settle so viewerAccess reflects the login.
        if (authLoading) return;
        const controller = new AbortController();
        fetchPublicForm(slug, controller.signal)
            .then(form => setState({kind: "loaded", form}))
            .catch(err => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setState({kind: err instanceof ApiError && err.status === 404 ? "not_found" : "error"});
            });
        return () => controller.abort();
    }, [slug, authLoading, user?.id]);

    if (authLoading || state.kind === "loading") return <LoadingScreen label={t("formGate.loadingForm")}/>;
    if (state.kind === "not_found") return <FormNotFoundState/>;
    if (state.kind === "error") return <FormErrorState/>;

    const {form} = state;
    if (!form.acceptingSubmissions) return <FormInactiveState reason={form.notAcceptingReason}/>;
    if (form.viewerAccess === "LOGIN_REQUIRED") return <NotAuthenticatedState redirectPath={`/f/${form.slug}`}/>;
    if (form.viewerAccess === "NOT_IN_GUILD") return <NotInGuildState/>;
    if (form.viewerAccess === "BANNED") return <BannedState/>;
    if (form.viewerAccess === "ROLE_REQUIRED" || form.viewerAccess === "ROLE_DENIED"
        || form.viewerAccess === "ROLES_UNAVAILABLE") return <RoleGateState reason={form.viewerAccess}/>;

    const definition: FormDefinition = {
        id: form.id,
        slug: form.slug,
        serverId: "0",
        channelsIds: [],
        schema: form.schema,
        webhooks: [],
        active: form.active,
        createdAt: "",
        accessMode: form.accessMode,
    };
    return <FormRenderer form={definition}/>;
}
