import {useEffect, useId, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import type {IconType} from "react-icons";
import {FiAlertTriangle, FiEyeOff, FiGlobe, FiSearch, FiTag, FiUsers, FiX} from "react-icons/fi";
import {type DiscordRole, getGuildRoles, type MyGuild} from "../../api/dashboard";
import type {FormAccessMode} from "../../types/forms";
import {cx, Modal, ServerIcon, Switch} from "../../ui";
import type {EditorState} from "./useFormEditor";

// Docs: docs/design/mockups/Wizard3.dc.html, AnonDialog.dc.html; ТЗ 5.4.

const MODES: { mode: FormAccessMode; icon: IconType; warn?: boolean }[] = [
    {mode: "OPEN", icon: FiGlobe},
    {mode: "AUTHENTICATED", icon: FiUsers},
    {mode: "ROLE_GATED", icon: FiTag},
    {mode: "ANONYMOUS", icon: FiEyeOff, warn: true},
];

const colorOf = (role?: DiscordRole) => (role?.color ? `#${role.color.toString(16).padStart(6, "0")}` : "rgb(var(--mu))");

/** «+ Добавить роль»: the server's roles with how many hold them, searchable (ТЗ ФТ-5.4.2). */
function RolePicker({roles, taken, onPick, dashed}: { roles: DiscordRole[]; taken: Set<string>; onPick: (id: string) => void; dashed?: boolean }) {
    const {t} = useTranslation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const listId = useId();
    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);
    const shown = roles.filter(r => !taken.has(r.id) && r.name.toLowerCase().includes(query.trim().toLowerCase()));
    const pick = (role: DiscordRole) => {
        onPick(role.id);
        setQuery("");
        setOpen(false);
    };
    return (
        <div ref={ref} className="relative">
            <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
                    className={cx("h-[30px] rounded-full px-2.5 text-[13px] font-semibold",
                        open ? "border-[1.5px] border-pr bg-prs text-prt" : dashed ? "border border-dashed border-bd bg-sf text-tx" : "border-[1.5px] border-pr bg-prs text-prt")}>
                + {t("builder.access.addRole")}
            </button>
            {open && (
                <div className="absolute left-0 top-[calc(100%+6px)] z-20 flex w-[300px] flex-col gap-0.5 rounded-[14px] border border-bd bg-sf p-1.5 shadow-popover">
                    <label className="flex h-9 items-center gap-2 rounded-[9px] bg-s2 px-2.5 text-mu">
                        <FiSearch size={14} aria-hidden="true"/>
                        <input autoFocus value={query} role="combobox" aria-expanded aria-controls={listId}
                               aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                               aria-label={t("builder.access.findRole")} placeholder={t("builder.access.findRole")}
                               onChange={e => {
                                   setQuery(e.target.value);
                                   setActive(0);
                               }}
                               onKeyDown={e => {
                                   if (e.key === "ArrowDown") {
                                       e.preventDefault();
                                       setActive(i => Math.min(i + 1, shown.length - 1));
                                   } else if (e.key === "ArrowUp") {
                                       e.preventDefault();
                                       setActive(i => Math.max(i - 1, 0));
                                   } else if (e.key === "Enter" && shown[active]) {
                                       e.preventDefault();
                                       pick(shown[active]);
                                   } else if (e.key === "Escape") {
                                       setOpen(false);
                                   }
                               }}
                               className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-tx outline-none"/>
                    </label>
                    <div id={listId} role="listbox" className="flex max-h-[240px] flex-col gap-0.5 overflow-auto">
                        {shown.map((r, i) => (
                            <div key={r.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                                 onMouseDown={e => e.preventDefault()} onClick={() => pick(r)} onMouseEnter={() => setActive(i)}
                                 className={cx("flex h-9 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-sm", i === active && "bg-s2")}>
                                <span className="h-2.5 w-2.5 rounded-full" style={{background: colorOf(r)}} aria-hidden="true"/>
                                <span className="flex-1 truncate">{r.name}</span>
                                {r.memberCount != null && <span className="text-xs tabular-nums text-mu">{r.memberCount.toLocaleString()}</span>}
                            </div>
                        ))}
                        {shown.length === 0 && <span className="px-2.5 py-2 text-[13px] text-mu">{t("builder.access.noRoles")}</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

function RoleChips({ids, roles, onRemove}: { ids: string[]; roles: DiscordRole[]; onRemove: (id: string) => void }) {
    const {t} = useTranslation();
    return (
        <>
            {ids.map(id => {
                const role = roles.find(r => r.id === id);
                return (
                    <span key={id} className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-bd bg-sf pl-2.5 pr-1 text-[13px] font-medium">
                        <span className="h-[9px] w-[9px] rounded-full" style={{background: colorOf(role)}} aria-hidden="true"/>
                        {role?.name ?? id}
                        <button type="button" onClick={() => onRemove(id)} aria-label={t("builder.access.removeRole", {name: role?.name ?? id})}
                                className="grid h-6 w-6 place-items-center rounded-full text-mu hover:bg-s2 hover:text-tx">
                            <FiX size={12} aria-hidden="true"/>
                        </button>
                    </span>
                );
            })}
        </>
    );
}

/**
 * «Доступ» (ТЗ 5.4): who may fill the form in — four modes; for «Определённые
 * роли» the allowed and denied lists (deny wins, a role in one list only);
 * «Анонимно» only after its risks are accepted; the per-person limit and the
 * opening window.
 */
export default function AccessTab({state, update, guild, roleGateError}: {
    state: EditorState;
    update: (patch: Partial<EditorState>) => void;
    guild: MyGuild | null;
    roleGateError?: boolean;
}) {
    const {t} = useTranslation();
    const ids = {limit: useId(), opens: useId(), closes: useId(), ack: useId()};
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [asking, setAsking] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);

    useEffect(() => {
        if (!guild) return;
        getGuildRoles(guild.guildId).then(setRoles).catch(() => setRoles([]));
    }, [guild]);

    const choose = (mode: FormAccessMode) => {
        if (mode === "ANONYMOUS" && state.accessMode !== "ANONYMOUS") {
            setAcknowledged(false);
            setAsking(true);
            return;
        }
        update({accessMode: mode});
    };
    const taken = new Set([...state.allowedRoleIds, ...state.deniedRoleIds]);
    const unlimited = state.submissionLimitPerUser === null;

    return (
        <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-[26px] px-4 pb-10 pt-8 md:px-7">
            <div className="flex flex-col gap-1.5">
                <h1 className="m-0 text-[26px] font-bold">{t("builder.access.title")}</h1>
                <p className="m-0 text-[15px] text-mu">{t("builder.access.text")}</p>
            </div>

            {guild && (
                <div className="flex max-w-[320px] flex-col gap-1.5">
                    <span className="text-[13px] font-semibold">{t("builder.basic.server")}</span>
                    <div aria-disabled="true" className="flex h-11 items-center gap-2.5 rounded-xl border border-bd bg-s2 px-3 text-sm text-mu">
                        <ServerIcon name={guild.guildName} src={guild.guildIconUrl} size={22}/>{guild.guildName}
                    </div>
                </div>
            )}

            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
                <legend className="mb-3 p-0 text-base font-bold">{t("builder.access.who")}</legend>
                <div role="radiogroup" aria-label={t("builder.access.who")} className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                    {MODES.map(({mode, icon: Icon, warn}) => {
                        const on = state.accessMode === mode;
                        return (
                            <button key={mode} type="button" role="radio" aria-checked={on} onClick={() => choose(mode)}
                                    className={cx("flex flex-col gap-2.5 rounded-2xl p-4 text-left",
                                        on ? "border-[1.5px] border-pr bg-prs" : "border border-bd bg-sf hover:border-pr")}>
                                <span className="flex items-center justify-between">
                                    <span className={cx("grid h-9 w-9 place-items-center rounded-[11px]",
                                        warn ? "bg-amb text-amt" : on ? "bg-pr text-white" : "bg-s2 text-tx")}>
                                        <Icon size={18} aria-hidden="true"/>
                                    </span>
                                    <span className={cx("box-border h-5 w-5 rounded-full", on ? "border-[6px] border-pr bg-white" : "border-2 border-bd")}
                                          aria-hidden="true"/>
                                </span>
                                <span className="text-[15px] font-semibold">{t(`builder.access.mode.${mode}.title`)}</span>
                                <span className="text-[13px] leading-[1.45] text-mu">
                                    {t(`builder.access.mode.${mode}.text`, {server: guild?.guildName ?? ""})}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            {state.accessMode === "ROLE_GATED" && (
                <section aria-label={t("builder.access.roles")} className="flex flex-col gap-4 rounded-2xl border border-bd bg-sf p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <h2 className="m-0 text-[17px] font-bold">{t("builder.access.roles")}</h2>
                        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-amb px-2.5 py-1.5 text-[13px] font-semibold text-amt">
                            <FiAlertTriangle size={14} aria-hidden="true"/>{t("builder.access.denyWins")}
                        </span>
                    </div>
                    {roleGateError && <p role="alert" className="m-0 text-[13px] text-rdt">{t("builder.access.needRoles")}</p>}
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                        <div className="flex flex-col gap-3 rounded-[14px] bg-s2 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gnt">{t("builder.access.allowed")}</span>
                                <span className="text-xs text-mu">{t("builder.access.allowedHint")}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <RoleChips ids={state.allowedRoleIds} roles={roles}
                                           onRemove={id => update({allowedRoleIds: state.allowedRoleIds.filter(r => r !== id)})}/>
                                <RolePicker roles={roles} taken={taken} onPick={id => update({allowedRoleIds: [...state.allowedRoleIds, id]})}/>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 self-start rounded-[14px] bg-s2 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-rdt">{t("builder.access.denied")}</span>
                                <span className="text-xs text-mu">{t("builder.access.deniedHint")}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <RoleChips ids={state.deniedRoleIds} roles={roles}
                                           onRemove={id => update({deniedRoleIds: state.deniedRoleIds.filter(r => r !== id)})}/>
                                <RolePicker dashed roles={roles} taken={taken} onPick={id => update({deniedRoleIds: [...state.deniedRoleIds, id]})}/>
                            </div>
                            <p className="m-0 text-[13px] leading-[1.45] text-mu">{t("builder.access.deniedText")}</p>
                        </div>
                    </div>
                </section>
            )}

            <section className="flex flex-wrap gap-6 rounded-2xl border border-bd bg-sf p-5">
                <div className="flex min-w-[240px] flex-1 flex-col gap-2">
                    <label htmlFor={ids.limit} className="text-sm font-semibold">{t("builder.access.limit")}</label>
                    {state.accessMode === "ANONYMOUS" ? (
                        <span className="text-[13px] text-mu">{t("builder.access.limitAnonymous")}</span>
                    ) : (
                        <>
                            <input id={ids.limit} type="number" min={1} disabled={unlimited} value={state.submissionLimitPerUser ?? ""}
                                   onChange={e => update({submissionLimitPerUser: e.target.value === "" ? 1 : Math.max(1, Number(e.target.value))})}
                                   className="h-11 w-32 rounded-xl border border-bd bg-sf px-3 text-sm text-tx outline-none focus:border-pr disabled:bg-s2 disabled:text-mu"/>
                            <span className="flex items-center gap-2.5 text-sm">
                                <Switch checked={unlimited} onChange={on => update({submissionLimitPerUser: on ? null : 1})}
                                        ariaLabel={t("builder.access.unlimited")}/>
                                {t("builder.access.unlimited")}
                            </span>
                        </>
                    )}
                </div>
                <div className="flex min-w-[240px] flex-1 flex-col gap-2">
                    <span className="text-sm font-semibold">{t("builder.access.window")}</span>
                    <label htmlFor={ids.opens} className="text-xs text-mu">{t("builder.access.opensAt")}</label>
                    <input id={ids.opens} type="datetime-local" value={state.opensAt} onChange={e => update({opensAt: e.target.value})}
                           className="h-11 rounded-xl border border-bd bg-sf px-3 text-sm text-tx outline-none focus:border-pr"/>
                    <label htmlFor={ids.closes} className="text-xs text-mu">{t("builder.access.closesAt")}</label>
                    <input id={ids.closes} type="datetime-local" value={state.closesAt} min={state.opensAt || undefined}
                           onChange={e => update({closesAt: e.target.value})}
                           className="h-11 rounded-xl border border-bd bg-sf px-3 text-sm text-tx outline-none focus:border-pr"/>
                </div>
            </section>

            <Modal open={asking} onClose={() => setAsking(false)} role="alertdialog" width={520} hideClose
                   title={t("builder.access.anon.title")} description={t("builder.access.anon.text")}
                   footer={(
                       <>
                           <button type="button" onClick={() => setAsking(false)}
                                   className="h-11 rounded-xl border border-bd bg-sf px-4 text-sm font-medium text-tx hover:bg-s2">
                               {t("common.cancel")}
                           </button>
                           <button type="button" disabled={!acknowledged}
                                   onClick={() => {
                                       update({accessMode: "ANONYMOUS", submissionLimitPerUser: null});
                                       setAsking(false);
                                   }}
                                   className="h-11 rounded-xl bg-[#B45309] px-4 text-sm font-semibold text-white disabled:opacity-50">
                               {t("builder.access.anon.confirm")}
                           </button>
                       </>
                   )}>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {[0, 1, 2, 3].map(i => (
                        <li key={i} className="flex gap-2.5 text-sm leading-[1.45]">
                            <FiAlertTriangle size={16} aria-hidden="true" className="mt-0.5 flex-none text-amt"/>{t(`builder.access.anon.risk${i}`)}
                        </li>
                    ))}
                </ul>
                <label htmlFor={ids.ack} className="mt-4 flex cursor-pointer gap-2.5 rounded-xl bg-s2 p-3 text-sm leading-[1.45]">
                    <input id={ids.ack} type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}
                           className="mt-0.5 h-4 w-4 flex-none accent-pr"/>
                    {t("builder.access.anon.ack")}
                </label>
            </Modal>
        </div>
    );
}
