import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiInfo, FiX} from "react-icons/fi";
import {type DiscordRole, getGuildRoles} from "../../../api/dashboard";

export interface RoleGateValue {
    allowedRoleIds: string[];
    deniedRoleIds: string[];
}

function roleColor(role: DiscordRole | undefined): string {
    return role && role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#8B8B96";
}

function RoleList({label, hint, ids, others, roles, onChange, tone}: {
    label: string;
    hint: string;
    ids: string[];
    /** Roles already in the other list — a role can't be both allowed and denied. */
    others: string[];
    roles: DiscordRole[];
    onChange: (ids: string[]) => void;
    tone: "allow" | "deny";
}) {
    const {t} = useTranslation();
    const byId = new Map(roles.map(r => [r.id, r]));
    const available = roles.filter(r => !ids.includes(r.id) && !others.includes(r.id));
    return (
        <div>
            <p className={`text-xs font-medium ${tone === "allow" ? "text-[#1E1E24]" : "text-[#B42318]"}`}>{label}</p>
            <p className="mb-2 mt-0.5 text-xs text-[#8B8B96]">{hint}</p>
            <div className="flex flex-wrap items-center gap-1.5">
                {ids.length === 0 && <span className="text-xs text-[#8B8B96]">{t("access.roleGate.none")}</span>}
                {ids.map(id => {
                    const role = byId.get(id);
                    return (
                        <span key={id}
                              className="flex items-center gap-1.5 rounded-full border border-[#E4E4E7] bg-white py-0.5 pl-2 pr-1 text-xs text-[#1E1E24]">
                            <span className="h-2 w-2 rounded-full" style={{backgroundColor: roleColor(role)}}/>
                            {role ? role.name : id}
                            <button type="button" onClick={() => onChange(ids.filter(x => x !== id))}
                                    aria-label={`${t("common.remove")} ${role?.name ?? id}`}
                                    className="rounded-full p-0.5 text-[#8B8B96] hover:bg-[#F0F0F2] hover:text-[#1E1E24]">
                                <FiX size={11}/>
                            </button>
                        </span>
                    );
                })}
                {available.length > 0 && (
                    <select value="" onChange={e => e.target.value && onChange([...ids, e.target.value])}
                            className="rounded-full border border-dashed border-[#D4D4D9] bg-white px-2 py-0.5 text-xs text-[#55555F] hover:border-[#3730A3]">
                        <option value="">+ {t("access.roleGate.add")}</option>
                        {available.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                )}
            </div>
        </div>
    );
}

/**
 * RoleGate settings of a ROLE_GATED form (E2.1, #66): an allow list and a
 * deny list of the server's Discord roles; deny wins (owner decision, question 2 = B).
 */
export default function RoleGateEditor({guildId, value, onChange}: {
    guildId: string;
    value: RoleGateValue;
    onChange: (value: RoleGateValue) => void;
}) {
    const {t} = useTranslation();
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getGuildRoles(guildId)
            .then(list => {
                if (cancelled) return;
                setRoles(list);
                setFailed(list.length === 0);
            })
            .catch(() => !cancelled && setFailed(true));
        return () => {
            cancelled = true;
        };
    }, [guildId]);

    const empty = value.allowedRoleIds.length === 0 && value.deniedRoleIds.length === 0;

    return (
        <div className="mt-3 space-y-4 rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] p-3">
            <p className="text-sm font-medium text-[#1E1E24]">{t("access.roleGate.title")}</p>
            {failed && <p className="text-xs text-[#B42318]">{t("access.roleGate.loadFailed")}</p>}
            <RoleList label={t("access.roleGate.allowed")} hint={t("access.roleGate.allowedHint")} tone="allow"
                      ids={value.allowedRoleIds} others={value.deniedRoleIds} roles={roles}
                      onChange={allowedRoleIds => onChange({...value, allowedRoleIds})}/>
            <RoleList label={t("access.roleGate.denied")} hint={t("access.roleGate.deniedHint")} tone="deny"
                      ids={value.deniedRoleIds} others={value.allowedRoleIds} roles={roles}
                      onChange={deniedRoleIds => onChange({...value, deniedRoleIds})}/>
            <p className="flex gap-1.5 text-xs text-[#8B8B96]">
                <FiInfo size={12} className="mt-0.5 flex-shrink-0"/>{t("access.roleGate.hint")}
            </p>
            {empty && <p className="text-xs text-[#92702A]">{t("access.roleGate.needOne")}</p>}
        </div>
    );
}
