import {useCallback, useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {useAuth} from "../hooks/useAuth";
import {fetchPublicForm, type PublicForm} from "../api/forms";
import {ApiError} from "../api/client";
import LoadingScreen from "../components/LoadingScreen";
import AccessScreen from "../components/access/AccessScreen";
import FormRenderer from "../components/form/FormRenderer";
import type {FormDefinition} from "../types/forms";

type LoadState =
    | { kind: "loading" }
    | { kind: "not_found" }
    | { kind: "error"; status?: number; correlationId?: string }
    | { kind: "loaded"; form: PublicForm };

/**
 * The public form page, `/f/{slug}` (task #48).
 * <p>
 * The server's `viewerAccess` is the source of truth — the same check
 * submission intake applies. Any refusal shows the access screen of its code
 * (ТЗ 3.5, #111); the form renders only when access is granted.
 */
export default function PublicFormPage() {
    const {t} = useTranslation();
    const {slug = ""} = useParams<{ slug: string }>();
    const {user, loading: authLoading} = useAuth();
    const [state, setState] = useState<LoadState>({kind: "loading"});
    const [reload, setReload] = useState<{ n: number; refreshRoles: boolean }>({n: 0, refreshRoles: false});

    useEffect(() => {
        // Wait for the session to settle so viewerAccess reflects the login.
        if (authLoading) return;
        const controller = new AbortController();
        fetchPublicForm(slug, controller.signal, reload.refreshRoles)
            .then(form => setState({kind: "loaded", form}))
            .catch(err => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                if (err instanceof ApiError && err.status === 404) setState({kind: "not_found"});
                else setState({
                    kind: "error",
                    status: err instanceof ApiError ? err.status : undefined,
                    correlationId: err instanceof ApiError ? err.body?.correlationId : undefined,
                });
            });
        return () => controller.abort();
    }, [slug, authLoading, user?.id, reload]);

    const retry = useCallback((refreshRoles = false) => {
        setState({kind: "loading"});
        setReload(r => ({n: r.n + 1, refreshRoles}));
    }, []);

    if (authLoading || state.kind === "loading") return <LoadingScreen label={t("formGate.loadingForm")}/>;
    if (state.kind === "not_found") return <AccessScreen code="FORM_NOT_FOUND"/>;
    if (state.kind === "error") return <AccessScreen code="ERROR" error={state} onRetry={() => retry()}/>;

    const {form} = state;
    if (form.viewerAccess !== "GRANTED") {
        const rolesCode = form.viewerAccess === "ROLE_REQUIRED" || form.viewerAccess === "ROLE_CHECK_FAILED";
        return (
            <AccessScreen code={form.viewerAccess} details={form.access}
                          form={{slug: form.slug, title: form.schema.title, guildName: form.guildName, guildIconUrl: form.guildIconUrl}}
                          onRetry={() => retry(rolesCode)}/>
        );
    }

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
    return <FormRenderer form={definition} meta={{
        guildName: form.guildName, guildIconUrl: form.guildIconUrl,
        closesAt: form.closesAt, submissionLimitPerUser: form.submissionLimitPerUser,
    }}/>;
}
