import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiCheck, FiPlus, FiX} from "react-icons/fi";
import {Link} from "react-router-dom";
import {getGuildUsage, type GuildUsage, type MyGuild} from "../api/dashboard";
import {cx, ServerIcon} from "../ui";
import {GUILD_SECTIONS, type GuildSection, OWNER_ONLY_SECTIONS} from "./navigation";

// Docs: docs/design/mockups/WsHeader.dc.html; ТЗ 4.3, #126.

const BOT_BADGE = {
    CONNECTED: {cls: "bg-gnb text-gnt", icon: FiCheck},
    MISSING_PERMISSIONS: {cls: "bg-amb text-amt", icon: FiAlertTriangle},
    KICKED: {cls: "bg-rdb text-rdt", icon: FiX},
} as const;

function UsageBar({label, used, limit}: { label: string; used: number; limit: number | null }) {
    const {t} = useTranslation();
    const share = limit ? Math.min(1, used / limit) : 0;
    const near = limit !== null && limit > 0 && share >= 0.8;
    const tone = near && share >= 1 ? "bg-dg" : near ? "bg-wr" : "bg-pr";
    return (
        <div className="flex w-[200px] flex-col gap-1.5">
            <div className="flex justify-between text-xs">
                <span className="text-mu">{label}</span>
                <span className={cx("font-semibold tabular-nums", near && "text-amt")}>
                    {used.toLocaleString()} / {limit === null ? t("workspace.unlimited") : limit.toLocaleString()}
                </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-s2" role="progressbar" aria-label={label}
                 aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit ?? undefined}>
                <div className={cx("h-full rounded-full", tone)} style={{width: `${share * 100}%`}}/>
            </div>
        </div>
    );
}

/**
 * The top of a server's workspace: icon and name, the bot's state, the viewer's
 * role, the plan's counters (owner) and the tabs, each a route. Moderators and
 * billing are the owner's only — hidden here and refused by the server.
 */
export default function GuildWorkspaceHeader({guild, section}: { guild: MyGuild; section: GuildSection }) {
    const {t} = useTranslation();
    const isOwner = guild.role === "OWNER";
    const [usage, setUsage] = useState<GuildUsage | null>(null);

    useEffect(() => {
        if (!isOwner) return;
        let cancelled = false;
        getGuildUsage(guild.guildId).then(u => !cancelled && setUsage(u)).catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, isOwner]);

    const state = guild.botState ?? (guild.botStatus === "KICKED" ? "KICKED" : "CONNECTED");
    const bot = BOT_BADGE[state];
    const metric = (m: string) => usage?.usage.find(u => u.metric === m);
    const forms = metric("ACTIVE_FORMS");
    const submissions = metric("SUBMISSIONS_PER_MONTH");
    const tabs = GUILD_SECTIONS.filter(s => isOwner || !OWNER_ONLY_SECTIONS.includes(s));

    return (
        <div className="-mx-4 -mt-4 flex flex-col gap-[18px] border-b border-bd bg-sf px-4 pt-4 md:-mx-10 md:-mt-8 md:px-10 md:pt-6">
            <div className="flex flex-wrap items-center gap-4">
                <ServerIcon name={guild.guildName} src={guild.guildIconUrl} size={52}/>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:min-w-[240px]">
                    <h1 className="m-0 truncate text-xl font-bold tracking-[-0.01em] md:text-2xl">{guild.guildName}</h1>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-[9px] py-[3px]", bot.cls)}>
                            <bot.icon size={12} aria-hidden="true"/>
                            {t(`servers.bot.${state}`, {permissions: (guild.missingPermissions ?? []).map(p => t(`servers.permission.${p}`)).join(", ")})}
                        </span>
                        <span className="rounded-full border border-bd px-[9px] py-[3px]">
                            {t("workspace.you", {role: t(`forms.guilds.role.${guild.role.toLowerCase()}`)})}
                        </span>
                        <span className="rounded-full border border-bd px-[9px] py-[3px] font-mono font-medium text-mu">ID {guild.guildId}</span>
                    </div>
                </div>
                {/* The plan's counters and «Новая форма» are for the computer (ТЗ 4.10). */}
                <div className="hidden flex-wrap items-center gap-4 md:flex">
                    {forms && <UsageBar label={t("workspace.activeForms")} used={forms.used} limit={forms.limit}/>}
                    {submissions && <UsageBar label={t("workspace.submissionsThisMonth")} used={submissions.used} limit={submissions.limit}/>}
                    {usage && (
                        <span className="rounded-[10px] bg-s2 px-2.5 py-1.5 text-xs font-semibold">
                            {t("workspace.plan", {plan: usage.plan.charAt(0) + usage.plan.slice(1).toLowerCase()})}
                        </span>
                    )}
                    {isOwner && (
                        <Link to={`/dashboard/servers/${guild.guildId}/forms?new=1`}
                              className="flex h-10 items-center gap-2 rounded-xl bg-pr px-4 text-sm font-semibold text-white hover:bg-prh">
                            <FiPlus size={16} aria-hidden="true"/>{t("forms.newForm")}
                        </Link>
                    )}
                </div>
            </div>
            <nav aria-label={t("workspace.tabs")} className="flex gap-1 overflow-x-auto">
                {tabs.map(s => (
                    <Link key={s} to={`/dashboard/servers/${guild.guildId}/${s}`}
                             aria-current={s === section ? "page" : undefined}
                             className={cx("flex h-11 flex-none items-center gap-2 border-b-2 px-3.5 text-sm",
                                 s === section ? "border-pr font-semibold text-prt" : "border-transparent font-medium text-mu hover:text-tx")}>
                        {t(`shell.guild.${s}`)}
                        {s === "submissions" && (guild.pendingSubmissions ?? 0) > 0 && (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-pr px-1.5 text-[11px] font-bold text-white">
                                {guild.pendingSubmissions}
                            </span>
                        )}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
