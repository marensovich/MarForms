import {type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState} from "react";
import {AnimatePresence} from "framer-motion";
import {useTranslation} from "react-i18next";
import {useSearchParams} from "react-router-dom";
import type {IconType} from "react-icons";
import {
    FiAlertTriangle,
    FiArchive,
    FiCheck,
    FiCopy,
    FiDownload,
    FiEdit2,
    FiEye,
    FiEyeOff,
    FiGlobe,
    FiMinus,
    FiMoreHorizontal,
    FiRotateCcw,
    FiSearch,
    FiSend,
    FiSlash,
    FiTag,
    FiTrash2,
    FiUsers,
} from "react-icons/fi";
import {
    copyGuildForm,
    type DashboardForm,
    deleteGuildForm,
    exportFormCsv,
    getGuildForm,
    getGuildForms,
    getGuildUsage,
    type GuildUsage,
    type MyGuild,
    publishGuildForm,
    setGuildFormStatus,
} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import type {FormAccessMode, FormDefinition, FormStatus} from "../../types/forms";
import {ConfirmDialog, cx, EmptyState, ErrorState, SegmentedControl, Skeleton, useToast} from "../../ui";
import FormWizard from "./forms/FormWizard";
import FormEditModal from "./forms/FormEditModal";
import FormPreviewModal from "./forms/FormPreviewModal";

// Docs: docs/design/mockups/WsForms.dc.html; ТЗ 4.4, #127.

type Segment = "all" | FormStatus;
const SEGMENTS: Segment[] = ["all", "DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"];

const STATUS_CLS: Record<FormStatus, string> = {
    DRAFT: "border border-dashed border-bd bg-s2 text-mu",
    PUBLISHED: "bg-gnb text-gnt",
    CLOSED: "bg-amb text-amt",
    ARCHIVED: "bg-s2 text-mu",
};

const ACCESS_ICON: Record<FormAccessMode, IconType> = {
    ROLE_GATED: FiTag,
    AUTHENTICATED: FiUsers,
    OPEN: FiGlobe,
    ANONYMOUS: FiEyeOff,
};

const statusOf = (f: DashboardForm): FormStatus => f.status ?? (f.active ? "PUBLISHED" : "CLOSED");
const isBroken = (f: DashboardForm) => statusOf(f) !== "ARCHIVED"
    && !!f.notificationHealth && f.notificationHealth !== "HEALTHY";
const linkOf = (slug: string) => `${window.location.host}/f/${slug}`;

/** «2 ч назад», «вчера», «3 окт» — the «Изменена» column. */
function useUpdatedLabel() {
    const {i18n} = useTranslation();
    return (iso?: string) => {
        if (!iso) return "—";
        const date = new Date(iso);
        const minutes = Math.round((Date.now() - date.getTime()) / 60000);
        const rtf = new Intl.RelativeTimeFormat(i18n.language, {numeric: "auto"});
        if (minutes < 60) return rtf.format(-Math.max(1, minutes), "minute");
        if (minutes < 24 * 60) return rtf.format(-Math.round(minutes / 60), "hour");
        if (minutes < 48 * 60) return rtf.format(-1, "day");
        return date.toLocaleDateString(i18n.language, {
            day: "numeric", month: "short",
            ...(date.getFullYear() !== new Date().getFullYear() ? {year: "numeric"} : {}),
        });
    };
}

interface MenuItem {
    label: string;
    icon: IconType;
    onSelect: () => void;
    danger?: boolean;
}

/** «Ещё»: the row's status actions. Fixed-positioned so the table's scroll box doesn't clip it. */
function RowMenu({label, items}: { label: string; items: MenuItem[] }) {
    const [open, setOpen] = useState<{ top: number; right: number } | null>(null);
    const menuId = useId();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
        const close = (e: Event) => {
            if (e.type === "mousedown" && (menuRef.current?.contains(e.target as Node)
                || buttonRef.current?.contains(e.target as Node))) return;
            setOpen(null);
        };
        document.addEventListener("mousedown", close);
        window.addEventListener("resize", close);
        window.addEventListener("scroll", close, true);
        return () => {
            document.removeEventListener("mousedown", close);
            window.removeEventListener("resize", close);
            window.removeEventListener("scroll", close, true);
        };
    }, [open]);

    const toggle = () => {
        if (open) return setOpen(null);
        const r = buttonRef.current!.getBoundingClientRect();
        setOpen({top: r.bottom + 6, right: window.innerWidth - r.right});
    };
    const onKey = (e: KeyboardEvent) => {
        const all = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
        const i = all.indexOf(document.activeElement as HTMLElement);
        if (e.key === "Escape") {
            setOpen(null);
            buttonRef.current?.focus();
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            all[(i + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length]?.focus();
        }
    };

    return (
        <>
            <button ref={buttonRef} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={!!open}
                    aria-controls={open ? menuId : undefined} onClick={toggle}
                    className={cx("grid h-[34px] w-[34px] place-items-center rounded-[10px] text-tx",
                        open ? "border border-pr bg-prs" : "hover:bg-s2")}>
                <FiMoreHorizontal size={16} strokeWidth={2.6} aria-hidden="true"/>
            </button>
            {open && (
                <div ref={menuRef} id={menuId} role="menu" aria-label={label} onKeyDown={onKey}
                     style={{top: open.top, right: open.right}}
                     className="fixed z-40 flex w-[220px] flex-col gap-0.5 rounded-[14px] border border-bd bg-sf p-1.5 shadow-popover">
                    {items.map(item => (
                        <button key={item.label} type="button" role="menuitem"
                                onClick={() => {
                                    setOpen(null);
                                    item.onSelect();
                                }}
                                className={cx("flex h-[38px] items-center gap-2.5 rounded-lg px-2.5 text-left text-sm hover:bg-s2 focus-visible:bg-s2 focus-visible:outline-none",
                                    item.danger ? "text-rdt" : "text-tx")}>
                            <item.icon size={16} aria-hidden="true"/>{item.label}
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}

function IconLink({label, onClick, disabled, children}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
                className="grid h-[34px] w-[34px] place-items-center rounded-[10px] text-mu hover:bg-s2 hover:text-tx disabled:opacity-40 disabled:hover:bg-transparent">
            {children}
        </button>
    );
}

/**
 * A server's «Формы» tab (ТЗ 4.4): status segments with counts, search by
 * title or link, a webhook banner, and the forms table with each row's
 * actions — status changes strictly by table 4.4.2, an archived form coming
 * back as a draft copy. Moderators see the list, preview and links only.
 */
export default function GuildFormsPanel({guild}: { guild: MyGuild }) {
    const {t} = useTranslation();
    const toast = useToast();
    const updated = useUpdatedLabel();
    const isOwner = guild.role === "OWNER";
    const [forms, setForms] = useState<DashboardForm[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [usage, setUsage] = useState<GuildUsage | null>(null);
    const [segment, setSegment] = useState<Segment>("all");
    const [query, setQuery] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    // ?new=1 (the header's «Новая форма» and the command palette, #107) opens the wizard.
    const [searchParams, setSearchParams] = useSearchParams();
    const showWizard = isOwner && searchParams.get("new") === "1";
    const closeWizard = () => setSearchParams({}, {replace: true});
    const [edit, setEdit] = useState<{ form: DashboardForm; tab?: "webhooks" } | null>(null);
    const [preview, setPreview] = useState<FormDefinition | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DashboardForm | null>(null);

    // Archived forms too: they have their own segment. Usage is the owner's only (the footer's «4 из 5»).
    const fetchAll = useCallback(() => Promise.all([
        getGuildForms(guild.guildId, true),
        isOwner ? getGuildUsage(guild.guildId).catch(() => null) : Promise.resolve(null),
    ]), [guild.guildId, isOwner]);

    const load = useCallback(async () => {
        try {
            const [page, u] = await fetchAll();
            setForms(page.content);
            setUsage(u);
            setError(null);
        } catch (e) {
            setError(describeApiError(e, t("guildForms.loadError")));
        }
    }, [fetchAll, t]);

    useEffect(() => {
        let cancelled = false;
        fetchAll()
            .then(([page, u]) => {
                if (cancelled) return;
                setForms(page.content);
                setUsage(u);
                setError(null);
            })
            .catch(e => !cancelled && setError(describeApiError(e, t("guildForms.loadError"))));
        return () => {
            cancelled = true;
        };
    }, [fetchAll, t]);

    const run = async (form: DashboardForm, action: () => Promise<unknown>, done?: string) => {
        setBusyId(form.id);
        try {
            await action();
            if (done) toast({tone: "success", text: done});
            await load();
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("guildForms.actionError"))});
        } finally {
            setBusyId(null);
        }
    };

    const copyLink = (slug: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`)
            .then(() => toast({tone: "success", text: t("guildForms.linkCopied", {link: linkOf(slug)})}))
            .catch(() => toast({tone: "error", text: t("guildForms.actionError")}));
    };

    const openPreview = async (f: DashboardForm) => {
        try {
            setPreview(await getGuildForm(guild.guildId, f.id));
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("guildForms.actionError"))});
        }
    };

    const menuItems = (f: DashboardForm): MenuItem[] => {
        const status = statusOf(f);
        const setStatus = (target: FormStatus) => run(f, () => setGuildFormStatus(guild.guildId, f.id, target),
            t(`guildForms.done.${target}`, {title: f.title}));
        const items: MenuItem[] = [];
        // ТЗ 4.4.2: Черновик → Опубликована; Опубликована → Закрыта, Архив; Закрыта → Опубликована, Архив;
        // Архив → Черновик (a copy).
        if (status === "DRAFT" || status === "CLOSED") {
            items.push({label: t("guildForms.publish"), icon: FiSend, onSelect: () =>
                    run(f, () => publishGuildForm(guild.guildId, f.id), t("guildForms.done.PUBLISHED", {title: f.title}))});
        }
        if (status === "PUBLISHED") items.push({label: t("guildForms.close"), icon: FiSlash, onSelect: () => setStatus("CLOSED")});
        if (status === "PUBLISHED" || status === "CLOSED") {
            items.push({label: t("guildForms.archive"), icon: FiArchive, onSelect: () => setStatus("ARCHIVED")});
        }
        if (status === "ARCHIVED") {
            items.push({label: t("guildForms.restoreCopy"), icon: FiRotateCcw, onSelect: () =>
                    run(f, () => copyGuildForm(guild.guildId, f.id), t("guildForms.done.copy", {title: f.title}))});
        }
        if (f.submissionCount > 0) {
            items.push({label: t("guildForms.exportCsv"), icon: FiDownload, onSelect: () => run(f, () => exportFormCsv(f.id))});
        }
        items.push({label: t("guildForms.delete"), icon: FiTrash2, danger: true, onSelect: () => setDeleteTarget(f)});
        return items;
    };

    const all = forms ?? [];
    const counts = Object.fromEntries(SEGMENTS.map(s => [s, s === "all" ? all.length
        : all.filter(f => statusOf(f) === s).length])) as Record<Segment, number>;
    const q = query.trim().toLowerCase();
    const shown = all.filter(f => (segment === "all" || statusOf(f) === segment)
        && (!q || f.title.toLowerCase().includes(q) || (f.slug ?? "").toLowerCase().includes(q)));
    const broken = all.filter(isBroken);
    const activeForms = usage?.usage.find(u => u.metric === "ACTIVE_FORMS");

    return (
        <div className="flex flex-col gap-4 pt-6">
            {broken.length > 0 && (
                <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-amb px-3.5 py-3 text-sm text-amt">
                    <FiAlertTriangle size={18} aria-hidden="true" className="flex-none"/>
                    <span className="flex-1">
                        {broken.length === 1
                            ? t("guildForms.banner.one", {
                                title: broken[0].title,
                                reason: t(`guildForms.banner.reason.${broken[0].notificationReason ?? broken[0].notificationHealth}`,
                                    {defaultValue: t("guildForms.banner.reason.DELIVERY_FAILING")}),
                            })
                            : t("guildForms.banner.many", {count: broken.length})}
                    </span>
                    {isOwner && (
                        <button type="button" onClick={() => setEdit({form: broken[0], tab: "webhooks"})}
                                className="font-semibold underline">
                            {t("guildForms.banner.check")}
                        </button>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl ariaLabel={t("guildForms.filterLabel")} value={segment} onChange={setSegment}
                                  options={SEGMENTS.map(s => ({
                                      value: s, count: counts[s], label: t(`guildForms.segment.${s}`),
                                  }))}/>
                <label className="flex h-10 w-[280px] max-w-full items-center gap-2 rounded-xl border border-bd bg-sf px-3 text-mu focus-within:border-pr">
                    <FiSearch size={16} aria-hidden="true"/>
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("guildForms.search")}
                           aria-label={t("guildForms.search")}
                           className="min-w-0 flex-1 border-0 bg-transparent text-sm text-tx outline-none placeholder:text-mu"/>
                </label>
            </div>

            {error ? (
                <ErrorState title={t("guildForms.loadError")} text={error} onRetry={load} retryLabel={t("ui.retry")}/>
            ) : forms === null ? (
                <div className="flex flex-col gap-2" aria-busy="true">
                    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl"/>)}
                </div>
            ) : all.length === 0 ? (
                <EmptyState title={t("guildForms.emptyTitle")} text={isOwner ? t("guildForms.emptyOwner") : t("guildForms.empty")}/>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-bd bg-sf">
                    <table className="w-full min-w-[960px] border-collapse text-sm">
                        <thead>
                        <tr className="text-left text-xs text-mu">
                            <th className="border-b border-bd px-4 py-3 font-semibold">{t("guildForms.columns.title")}</th>
                            <th className="border-b border-bd px-4 py-3 font-semibold">{t("guildForms.columns.status")}</th>
                            <th className="border-b border-bd px-4 py-3 font-semibold">{t("guildForms.columns.access")}</th>
                            <th className="border-b border-bd px-4 py-3 text-right font-semibold">{t("guildForms.columns.responses")}</th>
                            <th className="border-b border-bd px-4 py-3 font-semibold">{t("guildForms.columns.notifications")}</th>
                            <th className="border-b border-bd px-4 py-3 font-semibold">{t("guildForms.columns.updated")}</th>
                            <th className="border-b border-bd px-4 py-3"><span className="sr-only">{t("guildForms.columns.actions")}</span></th>
                        </tr>
                        </thead>
                        <tbody>
                        {shown.map(f => {
                            const status = statusOf(f);
                            const access = f.accessMode ?? "AUTHENTICATED";
                            const AccessIcon = ACCESS_ICON[access];
                            const busy = busyId === f.id;
                            return (
                                <tr key={f.id} aria-busy={busy || undefined} className={cx(busy && "opacity-60")}>
                                    <td className="border-b border-bd px-4 py-3.5">
                                        <div className="flex flex-col gap-[3px]">
                                            <span className="font-semibold text-tx">{f.title}</span>
                                            <span className="font-mono text-xs text-mu">
                                                {f.slug ? `/f/${f.slug}` : t("guildForms.noLinkYet")}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="border-b border-bd px-4 py-3.5">
                                        <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_CLS[status])}>
                                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"/>
                                            {t(`guildForms.status.${status}`)}
                                        </span>
                                    </td>
                                    <td className="border-b border-bd px-4 py-3.5">
                                        <span className="inline-flex items-center gap-2 text-tx">
                                            <AccessIcon size={16} aria-hidden="true" className="text-mu"/>
                                            {t(`guildForms.access.${access}`)}
                                        </span>
                                    </td>
                                    <td className="border-b border-bd px-4 py-3.5 text-right tabular-nums">
                                        <span className="font-semibold">{f.submissionCount}</span>
                                        {(f.pendingCount ?? 0) > 0 && (
                                            <span className="ml-1.5 text-xs font-semibold text-prt"
                                                  title={t("guildForms.pending", {count: f.pendingCount})}>
                                                +{f.pendingCount}
                                            </span>
                                        )}
                                    </td>
                                    <td className="border-b border-bd px-4 py-3.5"><NotificationCell form={f}/></td>
                                    <td className="whitespace-nowrap border-b border-bd px-4 py-3.5 text-mu">{updated(f.updatedAt ?? f.createdAt)}</td>
                                    <td className="border-b border-bd px-3 py-2.5">
                                        <div className="flex justify-end gap-0.5">
                                            {isOwner && status !== "ARCHIVED" && (
                                                <IconLink label={t("common.edit")} onClick={() => setEdit({form: f})} disabled={busy}>
                                                    <FiEdit2 size={16} aria-hidden="true"/>
                                                </IconLink>
                                            )}
                                            <IconLink label={t("guildForms.preview")} onClick={() => openPreview(f)}>
                                                <FiEye size={16} aria-hidden="true"/>
                                            </IconLink>
                                            <IconLink label={f.slug ? t("guildForms.copyLink") : t("guildForms.noLinkYet")}
                                                      onClick={() => f.slug && copyLink(f.slug)} disabled={!f.slug}>
                                                <FiCopy size={16} aria-hidden="true"/>
                                            </IconLink>
                                            {isOwner && <RowMenu label={t("guildForms.more", {title: f.title})} items={menuItems(f)}/>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                    {shown.length === 0 && <p className="m-0 p-6 text-center text-sm text-mu">{t("guildForms.nothingFound")}</p>}
                </div>
            )}

            {forms && (
                <span className="text-[13px] text-mu">
                    {t("guildForms.subtitle", {count: all.length})}
                    {activeForms && activeForms.limit !== null && usage && ` · ${t("guildForms.activeOfLimit", {
                        used: activeForms.used, limit: activeForms.limit,
                        plan: usage.plan.charAt(0) + usage.plan.slice(1).toLowerCase(),
                    })}`}
                </span>
            )}

            <AnimatePresence>
                {showWizard && (
                    <FormWizard
                        guildId={guild.guildId}
                        onClose={closeWizard}
                        onCreated={() => {
                            closeWizard();
                            load();
                        }}
                    />
                )}
                {edit && (
                    <FormEditModal
                        form={edit.form}
                        initialTab={edit.tab}
                        onClose={() => setEdit(null)}
                        onUpdated={load}
                    />
                )}
                {preview && (
                    <FormPreviewModal
                        title={preview.schema.title}
                        description={preview.schema.description}
                        fields={preview.schema.fields}
                        onClose={() => setPreview(null)}
                    />
                )}
            </AnimatePresence>
            <ConfirmDialog
                open={deleteTarget !== null}
                title={t("forms.deleteConfirm.title")}
                text={deleteTarget && t("forms.deleteConfirm.message", {
                    title: deleteTarget.title,
                    count: deleteTarget.submissionCount,
                })}
                confirmLabel={t("forms.deleteConfirm.confirm")}
                onConfirm={async () => {
                    const target = deleteTarget!;
                    setDeleteTarget(null);
                    await run(target, () => deleteGuildForm(guild.guildId, target.id),
                        t("guildForms.done.deleted", {title: target.title}));
                }}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}

/** «В норме» / why notifications fail / «Не настроены» (no webhooks). */
function NotificationCell({form}: { form: DashboardForm }) {
    const {t} = useTranslation();
    const health = form.notificationHealth;
    if (!health) {
        return (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-mu">
                <FiMinus size={15} strokeWidth={2.2} aria-hidden="true"/>{t("guildForms.notif.none")}
            </span>
        );
    }
    if (health === "HEALTHY") {
        return (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gnt">
                <FiCheck size={15} strokeWidth={2.2} aria-hidden="true"/>{t("guildForms.notif.ok")}
            </span>
        );
    }
    return (
        <span className={cx("inline-flex items-center gap-1.5 text-[13px] font-medium", health === "INVALID" ? "text-rdt" : "text-amt")}
              title={t(`webhookHealth.reasons.${form.notificationReason ?? "DELIVERY_FAILING"}`)}>
            <FiAlertTriangle size={15} strokeWidth={2.2} aria-hidden="true"/>
            {t(`guildForms.notif.reason.${form.notificationReason ?? health}`, {defaultValue: t(`webhookHealth.${health}`)})}
        </span>
    );
}
