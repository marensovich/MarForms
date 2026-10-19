import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCheck, FiCloud, FiEye, FiX} from "react-icons/fi";
import {Link, useNavigate, useParams, useSearchParams} from "react-router-dom";
import {ApiError, apiRequest} from "../../api/client";
import {
    createGuildForm,
    getForm,
    getMyGuilds,
    type MyGuild,
    publishGuildForm,
    publishGuildFormChanges,
} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import type {FormStatus} from "../../types/forms";
import {cx, ErrorState, Skeleton, Spinner, useToast} from "../../ui";
import DesktopOnly from "../../shell/DesktopOnly";
import {useIsMobile} from "../../shell/useIsMobile";
import AccessTab from "./AccessTab";
import BasicTab from "./BasicTab";
import {useSlugCheck} from "./useSlugCheck";
import FieldsTab from "./FieldsTab";
import {fieldProblem} from "./fieldTypes";
import NotificationsTab from "./NotificationsTab";
import MessageTab from "./MessageTab";
import PreviewOverlay from "./PreviewOverlay";
import {type EditorState, type SaveStatus, useFormEditor} from "./useFormEditor";

// Docs: docs/design/mockups/FormEdit.dc.html, WizStepper.dc.html, Wizard1–4.dc.html, R1024Builder.dc.html; ТЗ 5.1–5.7.

const TABS = ["basic", "fields", "access", "notifications", "message"] as const;
type Tab = typeof TABS[number];

interface PublishIssue {
    area: string;
    fieldId: string | null;
    message: string;
}

const STATUS_CLS: Record<FormStatus, string> = {
    DRAFT: "border border-dashed border-bd bg-s2 text-mu",
    PUBLISHED: "bg-gnb text-gnt",
    CLOSED: "bg-amb text-amt",
    ARCHIVED: "bg-s2 text-mu",
};

/** Why a step of the wizard can't be left forward (ФТ-5.1.2). */
function stepErrors(tab: Tab, state: EditorState, slugProblem: string | null): string[] {
    if (tab === "basic") return [...(!state.title.trim() ? ["title"] : []), ...(slugProblem ? ["slug"] : [])];
    if (tab === "fields") {
        const inputs = state.fields.filter(f => f.type !== "SECTION_BREAK");
        return [...(inputs.length === 0 ? ["noFields"] : []), ...state.fields.filter(f => fieldProblem(f)).map(f => f.id)];
    }
    if (tab === "access" && state.accessMode === "ROLE_GATED" && !state.allowedRoleIds.length && !state.deniedRoleIds.length) return ["roles"];
    return [];
}

function SaveIndicator({status}: { status: SaveStatus }) {
    const {t, i18n} = useTranslation();
    if (status.kind === "saving") return <span className="inline-flex items-center gap-1.5 text-xs text-mu"><Spinner/>{t("builder.save.saving")}</span>;
    if (status.kind === "unsaved" || status.kind === "conflict") {
        return <span className="inline-flex items-center gap-1.5 text-xs text-amt"><FiAlertTriangle size={13} aria-hidden="true"/>{t("builder.save.unsaved")}</span>;
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-mu">
            <FiCloud size={13} aria-hidden="true"/>
            {t("builder.save.saved", {time: status.at.toLocaleTimeString(i18n.language, {hour: "2-digit", minute: "2-digit"})})}
        </span>
    );
}

/** The stepper of a new form (WizStepper.dc.html). */
function Stepper({step}: { step: number }) {
    const {t} = useTranslation();
    return (
        <ol aria-label={t("builder.wizard.steps")} className="m-0 flex list-none items-center gap-2 p-0">
            {TABS.map((tab, i) => {
                const done = i < step;
                const current = i === step;
                return (
                    <li key={tab} aria-current={current ? "step" : undefined} className="flex items-center gap-2">
                        <span className={cx("box-border grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold",
                            done ? "bg-pr text-white" : current ? "border-2 border-pr text-prt" : "border-2 border-bd text-mu")}>
                            {done ? <FiCheck size={14} aria-hidden="true"/> : i + 1}
                        </span>
                        <span className={cx("hidden whitespace-nowrap text-sm lg:inline", current ? "font-semibold text-tx" : "text-mu")}>
                            {t(`builder.tabs.${tab}`)}
                        </span>
                        {i < TABS.length - 1 && <span className={cx("h-0.5 w-8 rounded", done ? "bg-pr" : "bg-bd")} aria-hidden="true"/>}
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * /dashboard/servers/:guildId/forms/new — the first step of a new form: once
 * it has a title it is created as a draft and the wizard carries on in the
 * editor (autosaved from then on).
 */
export function NewFormPage() {
    const {t} = useTranslation();
    const {guildId = ""} = useParams();
    const navigate = useNavigate();
    const mobile = useIsMobile();
    const [guild, setGuild] = useState<MyGuild | null>(null);
    const [state, setState] = useState({title: "", description: "", reviewTime: "", slug: ""});
    const [touched, setTouched] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const slugProblem = useSlugCheck(state.slug, null, "");

    useEffect(() => {
        getMyGuilds().then(list => setGuild(list.find(g => g.guildId === guildId) ?? null)).catch(() => setGuild(null));
    }, [guildId]);

    const next = async () => {
        setTouched(true);
        if (!state.title.trim() || slugProblem) return;
        setBusy(true);
        setError(null);
        try {
            const created = await createGuildForm(guildId, {
                schema: {title: state.title.trim(), description: state.description, reviewTime: state.reviewTime || null, fields: []},
                ...(state.slug ? {slug: state.slug} : {}),
            });
            navigate(`/dashboard/forms/${created.id}/edit?wizard=1&tab=fields`, {replace: true});
        } catch (e) {
            setError(describeApiError(e, t("builder.wizard.createError")));
            setBusy(false);
        }
    };

    if (mobile) return <div className="p-4"><DesktopOnly onBack={() => navigate(-1)}/></div>;
    return (
        <div className="flex min-h-screen flex-col bg-bg text-tx">
            <header className="flex min-h-[88px] flex-wrap items-center gap-5 border-b border-bd bg-sf px-7 py-4">
                <div className="flex flex-[1_1_220px] flex-col gap-0.5">
                    <span className="text-[17px] font-bold">{t("builder.wizard.newForm")}</span>
                    <span className="text-[13px] text-mu">{t("builder.wizard.autosave", {server: guild?.guildName ?? ""})}</span>
                </div>
                <Stepper step={0}/>
                <div className="flex flex-[1_1_220px] justify-end gap-2">
                    <Link to={`/dashboard/servers/${guildId}/forms`} aria-label={t("builder.wizard.close")}
                          className="grid h-10 w-10 place-items-center rounded-xl bg-s2 text-tx hover:bg-bd"><FiX size={18} aria-hidden="true"/></Link>
                </div>
            </header>
            <main className="flex-1">
                <BasicTab state={state} update={patch => setState(s => ({...s, ...patch}))} guild={guild} formId={null}
                          savedSlug="" published={false} titleError={touched && !state.title.trim()}/>
                {error && <p role="alert" className="mx-auto max-w-[1120px] px-7 text-sm text-rdt">{error}</p>}
            </main>
            <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-bd bg-sf px-7 py-3.5">
                <Link to={`/dashboard/servers/${guildId}/forms`} className="flex h-11 items-center rounded-xl px-4 text-sm font-medium text-tx hover:bg-s2">
                    {t("common.cancel")}
                </Link>
                <button type="button" onClick={next} disabled={busy}
                        className="flex h-11 items-center gap-2 rounded-xl bg-pr px-[18px] text-sm font-semibold text-white hover:bg-prh disabled:opacity-60">
                    {busy && <Spinner/>}{t("builder.wizard.next.fields")}<FiArrowRight size={16} aria-hidden="true"/>
                </button>
            </footer>
        </div>
    );
}

/**
 * /dashboard/forms/:formId/edit — the form builder (ТЗ 5.1): the top bar with
 * «Назад к формам», the form's and server's names, its status, the autosave
 * indicator, the four tabs (a dot marks a problem), «Предпросмотр» and
 * «Опубликовать» / «Опубликовать изменения». With ?wizard=1 it is the new
 * form's wizard: the same steps with a stepper, forward blocked by a step's errors.
 */
export default function FormEditorPage() {
    const {t} = useTranslation();
    const {formId = ""} = useParams();
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToast();
    const mobile = useIsMobile();
    const wizard = params.get("wizard") === "1";
    const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? params.get("tab") as Tab : "basic";
    const {definition, state, loadError, status, dirty, update, flush, accept} = useFormEditor(formId);
    const [guild, setGuild] = useState<MyGuild | null>(null);
    const [issues, setIssues] = useState<{ errors: PublishIssue[]; warnings: PublishIssue[] } | null>(null);
    const [showIssues, setShowIssues] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [preview, setPreview] = useState(false);
    const [focusField, setFocusField] = useState<string | null>(null);
    const [tried, setTried] = useState(false);
    const guildId = definition?.serverId ?? "";
    const slugProblem = useSlugCheck(state?.slug ?? "", formId, definition?.slug ?? "");

    useEffect(() => {
        if (!guildId) return;
        getMyGuilds().then(list => setGuild(list.find(g => g.guildId === guildId) ?? null)).catch(() => setGuild(null));
    }, [guildId]);

    // The checklist of ФТ-5.6.1, for the tabs' dots — refreshed once a save lands.
    const refreshIssues = useCallback(() => {
        if (!guildId) return;
        apiRequest<{ errors: PublishIssue[]; warnings: PublishIssue[] }>(`/guilds/${guildId}/forms/${formId}/publish-check`)
            .then(setIssues).catch(() => undefined);
    }, [guildId, formId]);
    const savedAt = status.kind === "saved" ? status.at.getTime() : 0;
    useEffect(() => {
        if (savedAt) refreshIssues();
    }, [savedAt, refreshIssues]);

    // Leaving with edits not yet saved asks first.
    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const go = (next: Tab, field?: string) => {
        setParams(p => {
            const n = new URLSearchParams(p);
            n.set("tab", next);
            return n;
        }, {replace: true});
        if (field) setFocusField(field);
    };

    const reload = () => getForm(formId).then(accept).catch(() => undefined);

    const publish = async () => {
        if (!definition) return;
        setPublishing(true);
        try {
            if (!(await flush())) {
                toast({tone: "error", text: t("builder.save.cantPublish")});
                return;
            }
            const live = definition.status === "PUBLISHED";
            const done = live ? await publishGuildFormChanges(guildId, formId) : await publishGuildForm(guildId, formId);
            accept(done);
            setShowIssues(false);
            toast({tone: "success", text: t(live ? "builder.publish.changesDone" : "builder.publish.done")});
            if (wizard) navigate(`/dashboard/servers/${guildId}/forms`);
        } catch (e) {
            if (e instanceof ApiError && e.status === 400) {
                refreshIssues();
                setShowIssues(true);
            } else {
                toast({tone: "error", text: describeApiError(e, t("builder.publish.error"))});
            }
        } finally {
            setPublishing(false);
        }
    };

    if (mobile) return <div className="p-4"><DesktopOnly onBack={() => navigate(-1)}/></div>;
    if (loadError) {
        return (
            <div className="grid min-h-screen place-items-center bg-bg p-6">
                <ErrorState title={t("builder.loadError")} text={describeApiError(loadError, "")}
                            onRetry={() => window.location.reload()} retryLabel={t("ui.retry")}/>
            </div>
        );
    }
    if (!definition || !state) {
        return (
            <div className="flex min-h-screen flex-col gap-4 bg-bg p-6" aria-busy="true">
                <Skeleton className="h-[60px] rounded-xl"/><Skeleton className="h-[480px] rounded-xl"/>
            </div>
        );
    }

    const formStatus = definition.status ?? "DRAFT";
    const live = formStatus === "PUBLISHED";
    const errorsOf = (area: string) => issues?.errors.filter(i => i.area === area || (area === "fields" && i.area === "conditions")) ?? [];
    const dots: Record<Tab, boolean> = {
        basic: !state.title.trim() || !!slugProblem,
        fields: errorsOf("fields").length > 0 || state.fields.some(f => fieldProblem(f)),
        access: errorsOf("access").length > 0,
        notifications: (issues?.warnings.some(w => w.area === "notifications") ?? false)
            || state.webhooks.some(w => w.invalid || (w.health && w.health !== "HEALTHY")),
        message: false,
    };
    const step = TABS.indexOf(tab);
    const blocking = stepErrors(tab, state, slugProblem);
    const nextStep = () => {
        setTried(true);
        if (blocking.length) return;
        setTried(false);
        go(TABS[step + 1]);
    };
    const publishLabel = live ? (definition.hasUnpublishedChanges || dirty ? t("builder.publish.changes") : t("builder.publish.upToDate"))
        : t("builder.publish.publish");
    const publishDisabled = publishing || status.kind === "conflict" || formStatus === "ARCHIVED"
        || (live && !definition.hasUnpublishedChanges && !dirty);
    const editorTitle = state.title || t("builder.basic.untitled");

    const content = (() => {
        switch (tab) {
            case "fields":
                return <FieldsTab fields={state.fields} onChange={fields => update({fields})} focusFieldId={focusField}/>;
            case "access":
                return <AccessTab state={state} update={update} guild={guild} roleGateError={(tried && blocking.includes("roles")) || errorsOf("access").length > 0}/>;
            case "notifications":
                return <NotificationsTab guildId={guildId} formId={formId} webhooks={state.webhooks}
                                         onChange={webhooks => update({webhooks})} beforeTest={flush} onTested={reload}/>;
            case "message":
                return <MessageTab guildId={guildId} guildName={guild?.guildName ?? ""} formTitle={state.title} formSlug={state.slug}
                                   reviewEnabled={state.reviewEnabled} fields={state.fields}
                                   message={state.discordMessage} onMessage={discordMessage => update({discordMessage})}
                                   webhooks={state.webhooks} onWebhooks={webhooks => update({webhooks})}/>;
            default:
                return <BasicTab state={state} update={update} guild={guild} formId={formId} savedSlug={definition.slug ?? ""}
                                 published={!!definition.slug} titleError={!state.title.trim()}/>;
        }
    })();

    return (
        <div className="flex min-h-screen flex-col bg-bg text-tx">
            {wizard ? (
                <header className="flex min-h-[88px] flex-wrap items-center gap-5 border-b border-bd bg-sf px-7 py-4">
                    <div className="flex flex-[1_1_220px] flex-col gap-0.5">
                        <span className="text-[17px] font-bold">{t("builder.wizard.newForm")}</span>
                        <span className="flex items-center gap-2 text-[13px] text-mu">
                            {t("builder.wizard.autosave", {server: guild?.guildName ?? ""})} · <SaveIndicator status={status}/>
                        </span>
                    </div>
                    <Stepper step={step}/>
                    <div className="flex flex-[1_1_220px] justify-end gap-2">
                        <button type="button" onClick={() => setPreview(true)}
                                className="flex h-10 items-center gap-2 rounded-xl border border-bd px-3.5 text-sm font-medium text-tx hover:bg-s2">
                            <FiEye size={16} aria-hidden="true"/>{t("builder.preview.open")}
                        </button>
                        <Link to={`/dashboard/servers/${guildId}/forms`} aria-label={t("builder.wizard.close")}
                              className="grid h-10 w-10 place-items-center rounded-xl bg-s2 text-tx hover:bg-bd"><FiX size={18} aria-hidden="true"/></Link>
                    </div>
                </header>
            ) : (
                <header className="flex min-h-[60px] flex-wrap items-center gap-3 border-b border-bd bg-sf px-4 py-2">
                    <Link to={`/dashboard/servers/${guildId}/forms`} aria-label={t("builder.back")}
                          className="grid h-9 w-9 place-items-center rounded-[10px] border border-bd text-tx hover:bg-s2">
                        <FiArrowLeft size={16} aria-hidden="true"/>
                    </Link>
                    <div className="flex min-w-0 flex-col gap-px">
                        <span className="max-w-[260px] truncate text-[15px] font-bold">{editorTitle}</span>
                        <span className="text-xs text-mu">{guild?.guildName ?? ""}</span>
                    </div>
                    <span className={cx("rounded-full px-[9px] py-[3px] text-xs font-semibold", STATUS_CLS[formStatus])}>
                        {t(`guildForms.status.${formStatus}`)}
                    </span>
                    <SaveIndicator status={status}/>
                    <nav role="tablist" aria-label={t("builder.tabs.label")} className="mx-auto flex rounded-[10px] border border-bd bg-bg p-[3px]">
                        {TABS.map(item => (
                            <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => go(item)}
                                    className={cx("flex h-[30px] items-center gap-1.5 rounded-lg px-3.5 text-[13px]",
                                        tab === item ? "bg-sf font-semibold text-tx shadow-sm" : "font-medium text-mu hover:text-tx")}>
                                {t(`builder.tabs.${item}`)}
                                {dots[item] && <span className="h-1.5 w-1.5 rounded-full bg-wr" aria-label={t("builder.tabs.problem")}/>}
                            </button>
                        ))}
                    </nav>
                    <button type="button" onClick={() => setPreview(true)}
                            className="flex h-9 items-center gap-2 rounded-[10px] border border-bd px-3 text-sm font-medium text-tx hover:bg-s2">
                        <FiEye size={16} aria-hidden="true"/>{t("builder.preview.open")}
                    </button>
                    <button type="button" onClick={publish} disabled={publishDisabled}
                            className="flex h-9 items-center gap-2 rounded-[10px] bg-pr px-3.5 text-sm font-semibold text-white hover:bg-prh disabled:opacity-50">
                        {publishing && <Spinner/>}{publishLabel}
                    </button>
                </header>
            )}

            {status.kind === "conflict" && (
                <div role="alert" className="flex items-center gap-2.5 border-b border-bd bg-amb px-5 py-2.5 text-sm text-amt">
                    <FiAlertTriangle size={16} aria-hidden="true" className="flex-none"/>
                    <span className="flex-1">
                        <b>{t("builder.conflict.title")}</b>{" "}
                        {t("builder.conflict.text", {
                            name: status.by ?? "—",
                            time: status.at ? new Date(status.at).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) : "",
                        })}
                    </span>
                    <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">{t("builder.conflict.reload")}</button>
                </div>
            )}

            {showIssues && issues && issues.errors.length > 0 && (
                <div role="alert" className="border-b border-bd bg-rdb px-5 py-3 text-sm text-rdt">
                    <div className="flex items-center justify-between gap-3">
                        <b>{t("builder.publish.issues")}</b>
                        <button type="button" onClick={() => setShowIssues(false)} aria-label={t("ui.close")}><FiX size={16} aria-hidden="true"/></button>
                    </div>
                    <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                        {issues.errors.map((issue, i) => {
                            const field = issue.fieldId ? state.fields.find(f => f.id === issue.fieldId) : null;
                            const target: Tab = issue.area === "access" ? "access" : issue.area === "notifications" ? "notifications" : "fields";
                            return (
                                <li key={i}>
                                    <button type="button" onClick={() => go(target, issue.fieldId ?? undefined)} className="text-left underline">
                                        {field ? `«${field.label || t("builder.fields.untitled")}»: ` : ""}{t(`builder.publish.issue.${issue.area}`, {defaultValue: issue.message})}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <main className="flex flex-1 flex-col">{content}</main>

            {wizard && (
                <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-bd bg-sf px-7 py-3.5">
                    {step > 0 ? (
                        <button type="button" onClick={() => go(TABS[step - 1])}
                                className="flex h-11 items-center gap-2 rounded-xl border border-bd px-4 text-sm font-medium text-tx hover:bg-s2">
                            <FiArrowLeft size={16} aria-hidden="true"/>{t("builder.wizard.back")}
                        </button>
                    ) : <span/>}
                    <div className="flex items-center gap-2">
                        {tried && blocking.length > 0 && <span role="alert" className="text-[13px] text-rdt">{t(`builder.wizard.blocked.${tab}`)}</span>}
                        {step < TABS.length - 1 ? (
                            <button type="button" onClick={nextStep}
                                    className="flex h-11 items-center gap-2 rounded-xl bg-pr px-[18px] text-sm font-semibold text-white hover:bg-prh">
                                {t(`builder.wizard.next.${TABS[step + 1]}`)}<FiArrowRight size={16} aria-hidden="true"/>
                            </button>
                        ) : (
                            <>
                                <button type="button" onClick={async () => (await flush()) && navigate(`/dashboard/servers/${guildId}/forms`)}
                                        className="flex h-11 items-center rounded-xl border border-bd px-4 text-sm font-medium text-tx hover:bg-s2">
                                    {t("builder.wizard.saveDraft")}
                                </button>
                                <button type="button" onClick={publish} disabled={publishing || status.kind === "conflict"}
                                        className="flex h-11 items-center gap-2 rounded-xl bg-pr px-[18px] text-sm font-semibold text-white hover:bg-prh disabled:opacity-60">
                                    {publishing && <Spinner/>}{t("builder.wizard.publish")}
                                </button>
                            </>
                        )}
                    </div>
                </footer>
            )}

            {preview && (
                <PreviewOverlay guildId={guildId} title={state.title} description={state.description} fields={state.fields}
                                accessMode={state.accessMode} allowedRoleIds={state.allowedRoleIds} deniedRoleIds={state.deniedRoleIds}
                                onClose={() => setPreview(false)}/>
            )}
        </div>
    );
}

