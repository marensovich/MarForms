import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiPlus} from "react-icons/fi";
import {createRole, type DashboardRole, deleteRole, getRoles, updateRole} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import {Button, ConfirmDialog, cx, EmptyState, ErrorState, Field, Input, KpiCard, Modal, Select, Skeleton, Switch, Tooltip, useToast} from "../../ui";
import {useLeaveGuard} from "./useLeaveGuard";
import {useAuth} from "../../hooks/useAuth";

// Docs: docs/design/mockups/AdminRoles.dc.html (+ Create, Delete); ТЗ 2.2, 2.3, 6.4.

/** The rights of ТЗ 2.2 in their order, each with its area. */
const PERMISSIONS = ["DASHBOARD_ACCESS", "FORMS_MANAGE", "RESPONSES_MANAGE", "USERS_MODERATE", "ROLES_MANAGE", "SYSTEM_ADMIN"] as const;
const PALETTE = ["#DC2626", "#7C3AED", "#2563EB", "#0891B2", "#16A34A", "#CA8A04", "#EA580C", "#DB2777", "#475569"];
const DEFAULT_COLOR = "#475569";

interface Draft {
    name: string;
    color: string;
    permissions: Set<string>;
}

const draftOf = (r: DashboardRole): Draft => ({name: r.name, color: r.color ?? DEFAULT_COLOR, permissions: new Set(r.permissions)});

/**
 * Платформа · Роли (ТЗ 6.4, ROLES_MANAGE): the roles on the left with their
 * colour, rights, holders and «системная»; on the right the editor — name,
 * colour and the rights of 2.2 by area, SYSTEM_ADMIN marked «Опасно» — with a
 * sticky «Несохранённые изменения» bar and a question before leaving.
 * Changes apply at once after saving.
 */
export default function RolesTab() {
    const {t, i18n} = useTranslation();
    const toast = useToast();
    const {user: me} = useAuth();
    // SYSTEM_ADMIN is out of a roles manager's reach (#103, ТЗ 2.3): only a system administrator touches it.
    const isRoot = me?.permissions.includes("SYSTEM_ADMIN") ?? false;
    const [roles, setRoles] = useState<DashboardRole[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [switchTo, setSwitchTo] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        getRoles()
            .then(list => {
                if (cancelled) return;
                setRoles(list);
                setLoadError(null);
            })
            .catch(e => !cancelled && setLoadError(describeApiError(e, t("adminRoles.loadError"))));
        return () => {
            cancelled = true;
        };
    }, [reloadKey, t]);

    const selected = roles?.find(r => r.id === selectedId) ?? roles?.[0] ?? null;
    const current = selected && draft ? draft : selected ? draftOf(selected) : null;
    const changed = (p: string) => !!selected && current!.permissions.has(p) !== selected.permissions.includes(p);
    const changedRights = selected && current ? PERMISSIONS.filter(changed).length : 0;
    const dirty = !!selected && !!current && (changedRights > 0 || current.name.trim() !== selected.name
        || current.color.toLowerCase() !== (selected.color ?? DEFAULT_COLOR).toLowerCase());
    const guard = useLeaveGuard(dirty);

    const edit = (patch: Partial<Draft>) => current && setDraft({...current, ...patch});
    const pick = (id: string) => {
        if (id === selected?.id) return;
        if (dirty) setSwitchTo(id);
        else {
            setSelectedId(id);
            setDraft(null);
        }
    };
    const save = async () => {
        if (!selected || !current) return;
        setSaving(true);
        try {
            const saved = await updateRole(selected.id, {
                name: current.name.trim(), color: current.color, permissions: [...current.permissions],
            });
            setRoles(list => list?.map(r => r.id === saved.id ? saved : r) ?? null);
            setDraft(null);
            toast({tone: "success", text: t("adminRoles.saved", {name: saved.name})});
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminRoles.saveError"))});
        } finally {
            setSaving(false);
        }
    };

    const total = roles?.length ?? 0;
    const average = total ? roles!.reduce((sum, r) => sum + r.permissions.length, 0) / total : 0;
    const lockedSystemAdmin = selected?.system ?? false;
    const readOnly = !isRoot && (selected?.permissions.includes("SYSTEM_ADMIN") ?? false);

    return (
        <div className="flex flex-col gap-5 pb-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">{t("adminRoles.title")}</h1>
                    <p className="m-0 text-sm text-mu">{t("adminRoles.subtitle")}</p>
                </div>
                <Button icon={<FiPlus size={16} aria-hidden="true"/>} onClick={() => setCreating(true)} disabled={!roles}>
                    {t("adminRoles.create")}
                </Button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                <KpiCard label={t("adminRoles.kpi.total")} value={roles ? String(total) : "—"}/>
                <KpiCard label={t("adminRoles.kpi.rights")} value={roles ? average.toLocaleString(i18n.language, {maximumFractionDigits: 1}) : "—"}
                         extra={t("adminRoles.kpi.perRole")}/>
            </div>

            {loadError ? (
                <ErrorState title={t("adminRoles.loadError")} text={loadError} onRetry={() => setReloadKey(k => k + 1)}/>
            ) : !roles ? (
                <div className="flex gap-5" aria-busy="true">
                    <Skeleton className="h-80 w-[300px] rounded-[14px]"/>
                    <Skeleton className="h-80 flex-1 rounded-[14px]"/>
                </div>
            ) : roles.length === 0 ? (
                <EmptyState title={t("adminRoles.empty")} text={t("adminRoles.emptyText")}/>
            ) : (
                <div className="flex flex-wrap items-start gap-5">
                    <nav aria-label={t("adminRoles.list")} className="flex min-w-0 flex-[1_1_280px] flex-col gap-1 rounded-[14px] border border-bd bg-sf p-2">
                        {roles.map(r => (
                            <button key={r.id} type="button" onClick={() => pick(r.id)} aria-current={r.id === selected?.id ? "true" : undefined}
                                    className={cx("flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left",
                                        r.id === selected?.id ? "border-pr bg-prs" : "border-transparent hover:bg-s2")}>
                                <span className="h-3 w-3 flex-none rounded-full" style={{background: r.color ?? DEFAULT_COLOR}} aria-hidden="true"/>
                                <span className="flex min-w-0 flex-1 flex-col gap-px">
                                    <span className="truncate text-sm font-semibold">{r.name}</span>
                                    <span className="text-xs text-mu">
                                        {t("adminRoles.rights", {count: r.permissions.length})} · {t("adminRoles.holders", {count: r.users ?? 0})}
                                    </span>
                                </span>
                                {r.system && <span className="rounded-full bg-s2 px-2 py-0.5 text-[11px] font-semibold text-mu">{t("adminRoles.system")}</span>}
                            </button>
                        ))}
                    </nav>

                    {selected && current && (
                        <section aria-label={t("adminRoles.editor")} className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 rounded-[14px] border border-bd bg-sf p-5">
                            {readOnly && (
                                <p role="note" className="m-0 rounded-[10px] bg-amb px-3 py-2.5 text-[13px] text-amt">{t("adminRoles.rootOnly")}</p>
                            )}
                            <div className="flex flex-wrap items-end gap-4">
                                <Field label={t("adminRoles.name")} className="flex-[1_1_220px]">
                                    <Input value={current.name} onChange={e => edit({name: e.target.value})} maxLength={50} disabled={readOnly}/>
                                </Field>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[13px] font-semibold">{t("adminRoles.color")}</span>
                                    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={t("adminRoles.color")}>
                                        {PALETTE.map(c => (
                                            <button key={c} type="button" role="radio" aria-checked={current.color.toLowerCase() === c.toLowerCase()}
                                                    aria-label={c} disabled={readOnly} onClick={() => edit({color: c})}
                                                    className={cx("h-7 w-7 rounded-full border-2",
                                                        current.color.toLowerCase() === c.toLowerCase() ? "border-tx" : "border-transparent")}
                                                    style={{background: c}}/>
                                        ))}
                                        <input type="color" value={current.color} onChange={e => edit({color: e.target.value})} disabled={readOnly}
                                               aria-label={t("adminRoles.customColor")} className="h-7 w-9 cursor-pointer rounded border border-bd bg-sf"/>
                                    </div>
                                </div>
                                {selected.system || readOnly ? (
                                    <Tooltip content={t(selected.system ? "adminRoles.systemLocked" : "adminRoles.rootOnly")}>
                                        <button type="button" aria-disabled="true"
                                                className="ml-auto h-[38px] cursor-not-allowed rounded-[10px] border border-bd bg-s2 px-3 text-[13px] font-semibold text-mu opacity-60">
                                            {t("adminRoles.delete")}
                                        </button>
                                    </Tooltip>
                                ) : (
                                    <Button variant="dangerSoft" className="ml-auto" onClick={() => setDeleting(true)}>{t("adminRoles.delete")}</Button>
                                )}
                            </div>

                            <ul className="m-0 flex list-none flex-col p-0">
                                {PERMISSIONS.map(p => {
                                    const on = current.permissions.has(p);
                                    const danger = p === "SYSTEM_ADMIN";
                                    const locked = readOnly || (danger && (lockedSystemAdmin || !isRoot));
                                    return (
                                        <li key={p} className="flex items-center gap-4 border-t border-bd py-3.5 first:border-t-0">
                                            <span className="w-28 flex-none text-[13px] font-semibold text-mu">{t(`adminRoles.area.${p}`)}</span>
                                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <code className={cx("font-mono text-[13px] font-semibold", danger && on && "text-rdt")}>{p}</code>
                                                    {danger && <span className="rounded-full bg-rdb px-2 py-px text-[11px] font-semibold text-rdt">{t("adminRoles.danger")}</span>}
                                                    {changed(p) && <span className="rounded-full bg-amb px-2 py-px text-[11px] font-semibold text-amt">{t("adminRoles.changed")}</span>}
                                                </span>
                                                <span className="text-[13px] text-mu">{t(`adminRoles.describe.${p}`)}</span>
                                            </span>
                                            <Switch checked={on} danger={danger} disabled={locked}
                                                    ariaLabel={danger && lockedSystemAdmin ? t("adminRoles.systemKeeps") : danger && !isRoot ? t("adminRoles.rootOnlyRight") : p}
                                                    onChange={v => {
                                                        const next = new Set(current.permissions);
                                                        if (v) next.add(p);
                                                        else next.delete(p);
                                                        edit({permissions: next});
                                                    }}/>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}
                </div>
            )}

            {dirty && selected && (
                <div role="region" aria-label={t("adminRoles.unsaved")}
                     className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-[14px] border border-bd bg-inv px-4 py-3 text-white shadow-modal">
                    <span className="flex-1 text-sm">
                        {t("adminRoles.unsaved")}
                        {changedRights > 0 && ` · ${t("adminRoles.unsavedRights", {count: changedRights, role: selected.name})}`}
                    </span>
                    <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setDraft(null)}>{t("adminRoles.discard")}</Button>
                    <Button loading={saving} disabled={!current?.name.trim()} onClick={save}>{t("common.save")}</Button>
                </div>
            )}

            {creating && roles && (
                <CreateRoleModal roles={roles} onClose={() => setCreating(false)}
                                 onCreated={role => {
                                     setRoles(list => [...(list ?? []), role]);
                                     setSelectedId(role.id);
                                     setDraft(null);
                                 }}/>
            )}
            <ConfirmDialog open={deleting && !!selected} title={t("adminRoles.deleteTitle", {name: selected?.name ?? ""})}
                           text={selected && (selected.users ? t("adminRoles.deleteText", {count: selected.users}) : t("adminRoles.deleteUnused"))}
                           confirmLabel={t("adminRoles.delete")}
                           onConfirm={async () => {
                               const role = selected!;
                               setDeleting(false);
                               try {
                                   await deleteRole(role.id);
                                   toast({tone: "success", text: t("adminRoles.deleted", {name: role.name})});
                                   setRoles(list => list?.filter(r => r.id !== role.id) ?? null);
                                   setSelectedId(null);
                                   setDraft(null);
                               } catch (e) {
                                   toast({tone: "error", text: describeApiError(e, t("adminRoles.deleteError"))});
                               }
                           }}
                           onCancel={() => setDeleting(false)}/>
            <ConfirmDialog open={switchTo !== null || guard.pending !== null} tone="primary" title={t("adminRoles.leaveTitle")}
                           text={t("adminRoles.leaveText")} confirmLabel={t("adminRoles.leave")} cancelLabel={t("adminRoles.stay")}
                           onConfirm={() => {
                               if (switchTo) {
                                   setSelectedId(switchTo);
                                   setDraft(null);
                                   setSwitchTo(null);
                               } else guard.leave();
                           }}
                           onCancel={() => {
                               setSwitchTo(null);
                               guard.stay();
                           }}/>
        </div>
    );
}

/** «Создать роль»: a name, a colour and «Скопировать права из» (AdminRolesCreate.dc.html). */
function CreateRoleModal({roles, onClose, onCreated}: {
    roles: DashboardRole[];
    onClose: () => void;
    onCreated: (role: DashboardRole) => void;
}) {
    const {t} = useTranslation();
    const toast = useToast();
    const [name, setName] = useState("");
    const [copyFrom, setCopyFrom] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const taken = roles.some(r => r.name.toLowerCase() === name.trim().toLowerCase());
    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            const role = await createRole({
                name: name.trim(), color: PALETTE[roles.length % PALETTE.length],
                ...(copyFrom ? {copyFrom} : {permissions: []}),
            });
            toast({tone: "success", text: t("adminRoles.created", {name: role.name})});
            onCreated({...role, users: 0});
            onClose();
        } catch (e) {
            setError(describeApiError(e, t("adminRoles.createError")));
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal open onClose={onClose} width={440} title={t("adminRoles.create")}
               footer={(
                   <>
                       <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
                       <Button loading={busy} disabled={!name.trim() || taken} onClick={submit}>{t("adminRoles.createAction")}</Button>
                   </>
               )}>
            <div className="flex flex-col gap-4">
                <Field label={t("adminRoles.name")} required error={taken ? t("adminRoles.nameTaken") : error ?? undefined}>
                    <Input value={name} onChange={e => setName(e.target.value)} maxLength={50} autoFocus/>
                </Field>
                <Field label={t("adminRoles.copyFrom")}>
                    <Select value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>
                        <option value="">{t("adminRoles.copyNone")}</option>
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({t("adminRoles.rights", {count: r.permissions.length})})</option>
                        ))}
                    </Select>
                </Field>
            </div>
        </Modal>
    );
}
