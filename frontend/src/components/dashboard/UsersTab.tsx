import {type ReactElement, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiCopy, FiSearch} from "react-icons/fi";
import {ApiError} from "../../api/client";
import {type DashboardRole, getRoles} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import {
    assignUserRoles,
    banUser,
    getPlatformUsers,
    getRestrictions,
    getUserStats,
    liftTimeout,
    type PlatformUser,
    type Restriction,
    timeoutUser,
    unbanUser,
    type UserFilters,
    type UserStats,
} from "../../api/users";
import {useAuth} from "../../hooks/useAuth";
import {Avatar, Button, ConfirmDialog, cx, DataTable, EmptyState, Field, KpiCard, Modal, RoleChip, Textarea, Tooltip, useToast} from "../../ui";
import FilterSelect from "./moderation/FilterSelect";

// Docs: docs/design/mockups/AdminUsers.dc.html (+ Roles, Timeout, Ban, Unban), R1024Users, DarkAdmin; ТЗ 2.3, 6.3.

const PAGE_SIZE = 25;
const PRESETS = [10, 60, 1440, 10080];
const DEFAULT_COLOR = "rgb(var(--mu))";

type Status = "" | NonNullable<UserFilters["status"]>;

/**
 * Платформа · Пользователи (ТЗ 6.3): KPIs, search by username or Discord ID,
 * filters by platform role and status, and per row «Роли», «Тайм-аут» and
 * «Бан» / «Разбан». A time-out closes the panel and sending submissions, a
 * ban the whole platform; both carry a reason the user sees. Actions on a
 * user of a higher platform role are off, with the reason in a tooltip (2.3).
 */
export default function UsersTab() {
    const {t, i18n} = useTranslation();
    const toast = useToast();
    const {user: me} = useAuth();
    const canModerate = me?.permissions.includes("USERS_MODERATE") ?? false;
    const canAssign = me?.permissions.includes("ROLES_MANAGE") ?? false;
    const [query, setQuery] = useState("");
    const [search, setSearch] = useState("");
    const [roleId, setRoleId] = useState("");
    const [status, setStatus] = useState<Status>("");
    const [page, setPage] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);
    const [data, setData] = useState<{ key: string; rows: PlatformUser[]; total: number; pages: number } | null>(null);
    const [error, setError] = useState<{ message: string; code?: string } | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [roles, setRoles] = useState<DashboardRole[]>([]);
    const [editingRoles, setEditingRoles] = useState<PlatformUser | null>(null);
    const [timingOut, setTimingOut] = useState<PlatformUser | null>(null);
    const [banning, setBanning] = useState<PlatformUser | null>(null);
    const [unbanning, setUnbanning] = useState<PlatformUser | null>(null);
    const [lifting, setLifting] = useState<PlatformUser | null>(null);

    // The search box applies once typing pauses.
    useEffect(() => {
        const id = setTimeout(() => {
            setSearch(query.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(id);
    }, [query]);

    const key = JSON.stringify({search, roleId, status, page, reloadKey});
    useEffect(() => {
        let cancelled = false;
        getPlatformUsers({q: search || undefined, roleId: roleId || undefined, status: status || undefined, page, size: PAGE_SIZE})
            .then(r => {
                if (cancelled) return;
                setData({key, rows: r.content, total: r.page.totalElements, pages: r.page.totalPages});
                setError(null);
            })
            .catch(e => !cancelled && setError({
                message: describeApiError(e, t("adminUsers.loadError")),
                code: e instanceof ApiError ? `HTTP ${e.status}` : undefined,
            }));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- key carries every input
    }, [key, t]);

    useEffect(() => {
        getUserStats().then(setStats).catch(() => undefined);
    }, [reloadKey]);
    useEffect(() => {
        getRoles().then(setRoles).catch(() => undefined);
    }, []);

    const reload = () => setReloadKey(k => k + 1);
    const loading = !error && data?.key !== key;
    const rows = data?.key === key ? data.rows : [];
    const filtered = search !== "" || roleId !== "" || status !== "";
    const n = (v: number) => v.toLocaleString(i18n.language);
    const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});
    const roleColor = (id: string, color: string | null | undefined) => color ?? roles.find(r => r.id === id)?.color ?? DEFAULT_COLOR;

    const act = async (action: () => Promise<PlatformUser>, done: string) => {
        try {
            await action();
            toast({tone: "success", text: done});
            reload();
            return true;
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("adminUsers.actionError"))});
            return false;
        }
    };
    const copyId = (id: string) => navigator.clipboard.writeText(id)
        .then(() => toast({tone: "success", text: t("adminUsers.idCopied")})).catch(() => undefined);

    /** A row action; off with the reason in a tooltip when the hierarchy or the caller's rights forbid it. */
    const action = (label: string, onClick: () => void, blockedBy: string | null, tone: "plain" | "danger" = "plain"): ReactElement => {
        const btn = (
            <button type="button" aria-disabled={blockedBy ? true : undefined}
                    onClick={() => !blockedBy && onClick()}
                    className={cx("h-[30px] rounded-lg border px-2.5 text-[13px] font-medium",
                        blockedBy ? "cursor-not-allowed border-bd bg-s2 text-mu opacity-60"
                            : tone === "danger" ? "border-rdb bg-rdb text-rdt hover:brightness-95" : "border-bd bg-sf text-tx hover:bg-s2")}>
                {label}
            </button>
        );
        return blockedBy ? <Tooltip content={blockedBy}>{btn}</Tooltip> : btn;
    };
    const why = (u: PlatformUser, needed: boolean) =>
        !needed ? t("adminUsers.noRight") : u.self ? t("adminUsers.notYourself") : u.outranked ? t("adminUsers.hierarchy") : null;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
                <h1 className="m-0 text-[26px] font-bold tracking-[-0.01em]">{t("adminUsers.title")}</h1>
                <p className="m-0 text-sm text-mu">{t("adminUsers.subtitle")}</p>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                <KpiCard label={t("adminUsers.kpi.total")} value={stats ? n(stats.total) : "—"}
                         extra={stats ? t("adminUsers.kpi.lastWeek", {value: n(stats.lastWeek)}) : undefined}/>
                <KpiCard label={t("adminUsers.kpi.active")} value={stats ? n(stats.active30) : "—"}
                         extra={stats && stats.total ? t("adminUsers.kpi.share", {value: Math.round(stats.active30 / stats.total * 100)}) : undefined}/>
                <KpiCard label={t("adminUsers.kpi.restricted")} value={stats ? n(stats.banned + stats.timedOut) : "—"}
                         extra={stats ? `${t("adminUsers.kpi.bans", {count: stats.banned, value: n(stats.banned)})} · ${t("adminUsers.kpi.timeouts", {count: stats.timedOut, value: n(stats.timedOut)})}` : undefined}/>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex h-[38px] flex-[1_1_240px] items-center gap-2 rounded-[10px] border border-bd bg-sf px-3 text-mu focus-within:border-pr">
                    <FiSearch size={15} aria-hidden="true"/>
                    <input value={query} onChange={e => setQuery(e.target.value)} aria-label={t("adminUsers.search")}
                           placeholder={t("adminUsers.searchPlaceholder")}
                           className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-tx outline-none placeholder:text-mu"/>
                </label>
                <FilterSelect label={t("adminUsers.role")} value={roleId} strong={roleId !== ""}
                              onChange={v => {
                                  setRoleId(v);
                                  setPage(0);
                              }}>
                    <option value="">{t("adminUsers.any")}</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </FilterSelect>
                <FilterSelect label={t("adminUsers.status")} value={status} strong={status !== ""}
                              onChange={v => {
                                  setStatus(v as Status);
                                  setPage(0);
                              }}>
                    <option value="">{t("adminUsers.anyStatus")}</option>
                    <option value="active">{t("adminUsers.statusName.ACTIVE")}</option>
                    <option value="timeout">{t("adminUsers.statusName.TIMEOUT")}</option>
                    <option value="banned">{t("adminUsers.statusName.BANNED")}</option>
                </FilterSelect>
            </div>

            <DataTable<PlatformUser>
                caption={t("adminUsers.title")}
                rows={rows}
                rowKey={u => u.discordId}
                loading={loading}
                skeletonRows={8}
                error={error}
                onRetry={reload}
                minWidth={900}
                empty={(
                    <EmptyState title={t("ui.nothingFound")} text={filtered ? t("adminUsers.emptyFiltered") : t("adminUsers.empty")}
                                action={filtered ? (
                                    <button type="button" className="font-semibold text-prt hover:underline" onClick={() => {
                                        setQuery("");
                                        setRoleId("");
                                        setStatus("");
                                    }}>{t("ui.resetFilters")}</button>
                                ) : undefined}/>
                )}
                columns={[
                    {key: "user", header: t("adminUsers.col.user"), render: u => (
                        <span className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={u.username} src={u.avatarUrl} size={32}/>
                            <span className="truncate font-semibold">{u.username}</span>
                        </span>
                    )},
                    {key: "id", header: t("adminUsers.col.id"), width: "210px", render: u => (
                        <button type="button" onClick={() => copyId(u.discordId)} title={t("adminUsers.copyId")}
                                aria-label={t("adminUsers.copyIdOf", {id: u.discordId})}
                                className="group inline-flex items-center gap-1.5 font-mono text-xs text-mu hover:text-tx">
                            {u.discordId}<FiCopy size={12} aria-hidden="true" className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"/>
                        </button>
                    )},
                    {key: "roles", header: t("adminUsers.col.roles"), render: u => u.roles.length ? (
                        <span className="flex flex-wrap gap-1.5">
                            {u.roles.map(r => <RoleChip key={r.id} name={r.name} color={roleColor(r.id, r.color)} className="py-0.5 text-xs"/>)}
                        </span>
                    ) : <span className="text-mu">—</span>},
                    {key: "status", header: t("adminUsers.col.status"), width: "190px", render: u => (
                        <span title={u.reason ?? undefined}
                              className={cx("inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px] text-xs font-semibold",
                                  u.status === "ACTIVE" ? "bg-gnb text-gnt" : u.status === "TIMEOUT" ? "bg-amb text-amt" : "bg-rdb text-rdt")}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"/>
                            {u.status === "TIMEOUT" && u.until ? t("adminUsers.timeoutUntil", {date: when(u.until)}) : t(`adminUsers.statusName.${u.status}`)}
                        </span>
                    )},
                    {key: "actions", header: t("adminUsers.col.actions"), width: "250px", align: "right", render: u => (
                        <span className="inline-flex flex-wrap justify-end gap-1.5">
                            {action(t("adminUsers.roles"), () => setEditingRoles(u), canAssign ? null : t("adminUsers.noRight"))}
                            {u.status === "TIMEOUT"
                                ? action(t("adminUsers.liftTimeout"), () => setLifting(u), why(u, canModerate))
                                : action(t("adminUsers.timeout"), () => setTimingOut(u), u.status === "BANNED" ? t("adminUsers.alreadyBanned") : why(u, canModerate))}
                            {u.status === "BANNED"
                                ? action(t("adminUsers.unban"), () => setUnbanning(u), canModerate ? null : t("adminUsers.noRight"))
                                : action(t("adminUsers.ban"), () => setBanning(u), why(u, canModerate), "danger")}
                        </span>
                    )},
                ]}
                pagination={{page, pageCount: data?.pages ?? 0, total: data?.total ?? 0, onPageChange: setPage}}
            />

            {editingRoles && (
                <RolesModal user={editingRoles} roles={roles}
                            onClose={() => setEditingRoles(null)}
                            onSave={ids => act(() => assignUserRoles(editingRoles.discordId, ids), t("adminUsers.rolesSaved", {name: editingRoles.username}))}/>
            )}
            {timingOut && (
                <TimeoutModal user={timingOut} when={when}
                              onClose={() => setTimingOut(null)}
                              onSave={(minutes, reason) => act(() => timeoutUser(timingOut.discordId, minutes, reason),
                                  t("adminUsers.timedOut", {name: timingOut.username}))}/>
            )}
            {banning && <BanDialog user={banning} onClose={() => setBanning(null)}
                                   onBan={reason => act(() => banUser(banning.discordId, reason), t("adminUsers.banned", {name: banning.username}))}/>}
            {unbanning && <UnbanDialog user={unbanning} when={when} onClose={() => setUnbanning(null)}
                                       onUnban={() => act(() => unbanUser(unbanning.discordId), t("adminUsers.unbanned", {name: unbanning.username}))}/>}
            <ConfirmDialog open={lifting !== null} tone="primary" title={t("adminUsers.liftTitle", {name: lifting?.username ?? ""})}
                           text={t("adminUsers.liftText")} confirmLabel={t("adminUsers.liftTimeout")}
                           onConfirm={async () => {
                               const u = lifting!;
                               setLifting(null);
                               await act(() => liftTimeout(u.discordId), t("adminUsers.timeoutLifted", {name: u.username}));
                           }}
                           onCancel={() => setLifting(null)}/>
        </div>
    );
}

/** «Назначить роли»: every platform role with how many rights it gives (AdminUsersRoles.dc.html). */
function RolesModal({user, roles, onClose, onSave}: {
    user: PlatformUser;
    roles: DashboardRole[];
    onClose: () => void;
    onSave: (roleIds: string[]) => Promise<boolean>;
}) {
    const {t} = useTranslation();
    const [picked, setPicked] = useState(() => new Set(user.roles.map(r => r.id)));
    const [busy, setBusy] = useState(false);
    const toggle = (id: string) => setPicked(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
    return (
        <Modal open onClose={onClose} width={460} title={t("adminUsers.rolesTitle")} description={`${user.username} · ${user.discordId}`}
               footer={(
                   <>
                       <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
                       <Button loading={busy} onClick={async () => {
                           setBusy(true);
                           const ok = await onSave([...picked]);
                           setBusy(false);
                           if (ok) onClose();
                       }}>{t("common.save")}</Button>
                   </>
               )}>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {roles.map(r => (
                    <li key={r.id}>
                        <label className={cx("flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5", picked.has(r.id) ? "bg-prs" : "hover:bg-s2")}>
                            <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-pr"/>
                            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{background: r.color ?? DEFAULT_COLOR}} aria-hidden="true"/>
                            <span className="flex-1 text-sm font-medium">{r.name}</span>
                            <span className="text-xs text-mu">{t("adminUsers.rightsCount", {count: r.permissions.length})}</span>
                        </label>
                    </li>
                ))}
            </ul>
        </Modal>
    );
}

/** «Тайм-аут»: presets or minutes, a required reason, and when it ends (AdminUsersTimeout.dc.html). */
function TimeoutModal({user, when, onClose, onSave}: {
    user: PlatformUser;
    when: (iso: string) => string;
    onClose: () => void;
    onSave: (minutes: number, reason: string) => Promise<boolean>;
}) {
    const {t} = useTranslation();
    const [preset, setPreset] = useState<number | "custom">(60);
    const [custom, setCustom] = useState("");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [now] = useState(() => Date.now());
    const minutes = preset === "custom" ? Number(custom) : preset;
    const valid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 525_600;
    const ends = valid ? new Date(now + minutes * 60_000) : null;
    const label = (m: number) => m < 60 ? t("adminUsers.preset.min", {count: m}) : m < 1440 ? t("adminUsers.preset.hour", {count: m / 60})
        : t("adminUsers.preset.day", {count: m / 1440});
    const chip = (on: boolean) => cx("h-9 rounded-[10px] border px-3 text-[13px] font-medium",
        on ? "border-pr bg-prs text-prt" : "border-bd bg-sf text-tx hover:bg-s2");
    return (
        <Modal open onClose={onClose} width={480} title={t("adminUsers.timeoutTitle", {name: user.username})}
               description={t("adminUsers.timeoutText")}
               footer={(
                   <>
                       <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
                       <Button disabled={!valid || !reason.trim()} loading={busy} onClick={async () => {
                           setBusy(true);
                           const ok = await onSave(minutes, reason.trim());
                           setBusy(false);
                           if (ok) onClose();
                       }}>{t("adminUsers.giveTimeout")}</Button>
                   </>
               )}>
            <div className="flex flex-col gap-4">
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                    <legend className="mb-2 p-0 text-[13px] font-semibold">{t("adminUsers.duration")}</legend>
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map(m => (
                            <button key={m} type="button" aria-pressed={preset === m} onClick={() => setPreset(m)} className={chip(preset === m)}>
                                {label(m)}
                            </button>
                        ))}
                        <button type="button" aria-pressed={preset === "custom"} onClick={() => setPreset("custom")} className={chip(preset === "custom")}>
                            {t("adminUsers.preset.custom")}
                        </button>
                    </div>
                    {preset === "custom" && (
                        <label className="flex items-center gap-2 text-[13px] text-mu">
                            {t("adminUsers.orMinutes")}
                            <input type="number" min={1} max={525600} value={custom} onChange={e => setCustom(e.target.value)} autoFocus
                                   className="h-9 w-28 rounded-[10px] border border-bd bg-sf px-3 text-sm text-tx outline-none focus:border-pr"/>
                        </label>
                    )}
                </fieldset>
                <Field label={t("adminUsers.reason")} required>
                    <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500}/>
                </Field>
                <p className="m-0 text-xs text-mu">
                    {ends ? t("adminUsers.endsAt", {date: when(ends.toISOString())}) : t("adminUsers.badMinutes")}
                </p>
            </div>
        </Modal>
    );
}

/** «Забанить … на платформе?» with the reason the user will see (AdminUsersBan.dc.html). */
function BanDialog({user, onClose, onBan}: { user: PlatformUser; onClose: () => void; onBan: (reason: string) => Promise<boolean> }) {
    const {t} = useTranslation();
    const [reason, setReason] = useState("");
    return (
        <ConfirmDialog open title={t("adminUsers.banTitle", {name: user.username})} text={t("adminUsers.banText")}
                       confirmLabel={t("adminUsers.ban")}
                       onConfirm={async () => {
                           if (await onBan(reason.trim())) onClose();
                       }}
                       onCancel={onClose}>
            <Field label={t("adminUsers.banReason")}>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500}/>
            </Field>
        </ConfirmDialog>
    );
}

/** «Разбанить …?» with who banned, when and why (AdminUsersUnban.dc.html), and the earlier restrictions. */
function UnbanDialog({user, when, onClose, onUnban}: {
    user: PlatformUser;
    when: (iso: string) => string;
    onClose: () => void;
    onUnban: () => Promise<boolean>;
}) {
    const {t} = useTranslation();
    const [history, setHistory] = useState<Restriction[] | null>(null);
    useEffect(() => {
        let cancelled = false;
        getRestrictions(user.discordId).then(h => !cancelled && setHistory(h)).catch(() => !cancelled && setHistory([]));
        return () => {
            cancelled = true;
        };
    }, [user.discordId]);
    const ban = history?.find(r => r.type === "BAN" && !r.liftedAt);
    const text = ban
        ? t("adminUsers.unbanText", {date: when(ban.createdAt), by: ban.createdByName ?? "—", reason: ban.reason ?? t("adminUsers.noReason")})
        : t("adminUsers.unbanPlain");
    return (
        <ConfirmDialog open tone="primary" title={t("adminUsers.unbanTitle", {name: user.username})} text={history ? text : t("adminUsers.loadingHistory")}
                       confirmLabel={t("adminUsers.unban")}
                       onConfirm={async () => {
                           if (await onUnban()) onClose();
                       }}
                       onCancel={onClose}>
            {history && history.length > 1 && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-mu">{t("adminUsers.history")}</span>
                    <ul className="m-0 flex max-h-40 list-none flex-col gap-1.5 overflow-y-auto p-0 text-[13px]">
                        {history.filter(r => r !== ban).map((r, i) => (
                            <li key={i} className="rounded-lg bg-s2 px-3 py-2">
                                <span className="font-semibold">{t(`adminUsers.kind.${r.type}`)}</span>
                                {" · "}{when(r.createdAt)}{r.createdByName && ` · ${r.createdByName}`}
                                {r.reason && <span className="block text-mu">«{r.reason}»</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </ConfirmDialog>
    );
}
