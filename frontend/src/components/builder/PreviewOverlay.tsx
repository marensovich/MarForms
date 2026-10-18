import {useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import {FiArrowLeft, FiCheck, FiMonitor, FiSmartphone, FiX} from "react-icons/fi";
import {type DiscordRole, getGuildRoles} from "../../api/dashboard";
import type {FormAccessMode, FormDefinition, FormField} from "../../types/forms";
import FormRenderer from "../form/FormRenderer";
import {cx, useFocusTrap} from "../../ui";
import {roleGateVerdict} from "./roleGate";

// Docs: docs/design/mockups/Preview.dc.html; ТЗ ФТ-5.6.3.

/**
 * «Предпросмотр» (ТЗ ФТ-5.6.3): the public form as respondents will get it,
 * in a computer or a phone frame, answers not saved; «смотреть как» a member
 * without roles or with chosen roles tells whether the RoleGate lets them in,
 * and the conditions open as answers are given.
 */
export default function PreviewOverlay({guildId, title, description, fields, accessMode, allowedRoleIds, deniedRoleIds, onClose}: {
    guildId: string;
    title: string;
    description: string;
    fields: FormField[];
    accessMode: FormAccessMode;
    allowedRoleIds: string[];
    deniedRoleIds: string[];
    onClose: () => void;
}) {
    const {t} = useTranslation();
    const ref = useRef<HTMLDivElement>(null);
    const titleId = useId();
    useFocusTrap(ref, true, onClose);
    const [device, setDevice] = useState<"desktop" | "phone">("desktop");
    const [roles, setRoles] = useState<DiscordRole[]>([]);
    const [asRoles, setAsRoles] = useState<string[]>([]);
    const [picking, setPicking] = useState(false);

    useEffect(() => {
        if (accessMode !== "ROLE_GATED") return;
        getGuildRoles(guildId).then(setRoles).catch(() => setRoles([]));
    }, [guildId, accessMode]);

    const form: FormDefinition = {
        id: "preview", serverId: guildId, channelsIds: [], webhooks: [], active: true, createdAt: new Date().toISOString(),
        schema: {title: title || t("builder.basic.untitled"), description, fields},
    };
    const verdict = accessMode === "ROLE_GATED" ? roleGateVerdict(allowedRoleIds, deniedRoleIds, asRoles) : "GRANTED";
    const asLabel = asRoles.length === 0 ? t("builder.preview.asNoRoles")
        : t("builder.preview.asRoles", {roles: asRoles.map(id => roles.find(r => r.id === id)?.name ?? id).join(", ")});
    const seg = (on: boolean) => cx("flex h-[30px] items-center gap-1.5 rounded-lg px-3 text-[13px]",
        on ? "bg-sf font-semibold text-tx shadow-sm" : "text-mu");

    const body = verdict === "GRANTED"
        ? <FormRenderer key={fields.map(f => f.id).join()} form={form} preview/>
        : (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-rdb text-rdt"><FiX size={24} aria-hidden="true"/></span>
                <h2 className="m-0 text-lg font-bold">{t(`builder.preview.verdict.${verdict}`)}</h2>
                <p className="m-0 max-w-[380px] text-sm text-mu">{t(`builder.preview.verdictText.${verdict}`)}</p>
            </div>
        );

    return createPortal(
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
             className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-s2 text-tx outline-none">
            <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-bd bg-sf px-4 py-3">
                <button type="button" onClick={onClose}
                        className="flex h-9 items-center gap-1.5 rounded-[10px] border border-bd px-3 text-sm text-tx hover:bg-s2">
                    <FiArrowLeft size={15} aria-hidden="true"/>{t("builder.preview.back")}
                </button>
                <span id={titleId} className="text-[15px] font-bold">{t("builder.preview.title", {title: form.schema.title})}</span>
                <span className="rounded-full bg-amb px-[9px] py-[3px] text-xs font-semibold text-amt">{t("builder.preview.notSaved")}</span>
                <div role="tablist" aria-label={t("builder.preview.device")} className="ml-auto flex rounded-[10px] border border-bd bg-bg p-[3px]">
                    <button type="button" role="tab" aria-selected={device === "desktop"} onClick={() => setDevice("desktop")} className={seg(device === "desktop")}>
                        <FiMonitor size={14} aria-hidden="true"/>{t("builder.preview.desktop")}
                    </button>
                    <button type="button" role="tab" aria-selected={device === "phone"} onClick={() => setDevice("phone")} className={seg(device === "phone")}>
                        <FiSmartphone size={14} aria-hidden="true"/>{t("builder.preview.phone")}
                    </button>
                </div>
                {accessMode === "ROLE_GATED" && (
                    <div className="relative">
                        <button type="button" aria-expanded={picking} onClick={() => setPicking(p => !p)}
                                className="h-9 rounded-[10px] border border-bd bg-sf px-3 text-[13px] text-tx hover:bg-s2">
                            {asLabel} ▾
                        </button>
                        {picking && (
                            <div className="absolute right-0 top-[calc(100%+6px)] z-20 flex max-h-[320px] w-[260px] flex-col gap-0.5 overflow-auto rounded-[14px] border border-bd bg-sf p-1.5 shadow-popover">
                                <button type="button" onClick={() => setAsRoles([])}
                                        className="flex h-9 items-center justify-between rounded-[9px] px-2.5 text-left text-sm hover:bg-s2">
                                    {t("builder.preview.asNoRoles")}{asRoles.length === 0 && <FiCheck size={14} aria-hidden="true"/>}
                                </button>
                                {roles.map(r => {
                                    const on = asRoles.includes(r.id);
                                    return (
                                        <label key={r.id} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 text-sm hover:bg-s2">
                                            <input type="checkbox" checked={on} className="accent-pr"
                                                   onChange={() => setAsRoles(list => (on ? list.filter(x => x !== r.id) : [...list, r.id]))}/>
                                            <span className="h-2.5 w-2.5 rounded-full" aria-hidden="true"
                                                  style={{background: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "rgb(var(--mu))"}}/>
                                            <span className="truncate">{r.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </header>
            {accessMode === "ROLE_GATED" && (
                <div role="status" className={cx("px-4 py-2 text-center text-[13px] font-medium",
                    verdict === "GRANTED" ? "bg-gnb text-gnt" : "bg-rdb text-rdt")}>
                    {t(`builder.preview.gate.${verdict}`, {as: asLabel})}
                </div>
            )}
            <div className="flex flex-1 items-start justify-center p-4 md:p-7">
                {device === "desktop" ? (
                    <div className="w-full max-w-[1180px] overflow-hidden rounded-[14px] border border-bd bg-sf shadow-[0_20px_50px_rgba(10,10,30,0.12)]">
                        <div className="flex h-10 items-center gap-2.5 border-b border-bd bg-bg px-3.5" aria-hidden="true">
                            <span className="flex gap-1.5">
                                <span className="h-[11px] w-[11px] rounded-full bg-[#F87171]"/>
                                <span className="h-[11px] w-[11px] rounded-full bg-[#FBBF24]"/>
                                <span className="h-[11px] w-[11px] rounded-full bg-[#34D399]"/>
                            </span>
                        </div>
                        <div className="max-h-[760px] overflow-auto">{body}</div>
                    </div>
                ) : (
                    <div className="rounded-[54px] bg-[#1E1E24] p-3 shadow-[0_20px_50px_rgba(10,10,30,0.2)]">
                        <div className="h-[820px] w-[390px] max-w-[calc(100vw-56px)] overflow-auto rounded-[42px] bg-bg">{body}</div>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
