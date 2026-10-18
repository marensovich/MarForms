import {useMemo, useState} from "react";
import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiArrowRight, FiCheck, FiPlus, FiRefreshCw, FiSearch, FiServer, FiX} from "react-icons/fi";
import {ApiError} from "../../api/client";
import {getGuildConnectUrl, type MyGuild, refreshMyGuilds} from "../../api/dashboard";
import {useDashboard} from "../../shell/dashboardContext";
import {cx, SegmentedControl, ServerIcon, Skeleton} from "../../ui";

// Docs: docs/design/mockups/Servers.dc.html, DarkServers.dc.html; ТЗ 4.2, #125.

type RoleFilter = "all" | "OWNER" | "MODERATOR";

const BOT = {
    CONNECTED: {cls: "bg-gnb text-gnt", icon: FiCheck},
    MISSING_PERMISSIONS: {cls: "bg-amb text-amt", icon: FiAlertTriangle},
    KICKED: {cls: "bg-rdb text-rdt", icon: FiX},
} as const;

/**
 * «Мои серверы»: the servers the user owns or moderates as cards — members,
 * role, the bot's state with a way to fix it, active forms and waiting
 * submissions — with role segments, search, «Обновить» and «Добавить бота на сервер».
 */
export default function ServersTab() {
    const {t} = useTranslation();
    const {guilds: all, reloadGuilds} = useDashboard();
    const [filter, setFilter] = useState<RoleFilter>("all");
    const [query, setQuery] = useState("");
    const [refreshed, setRefreshed] = useState<MyGuild[] | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [connecting, setConnecting] = useState<string | null>(null);
    // The result of a bot install: Discord comes back to /dashboard/servers?connectedGuild=… (#151).
    const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const connected = params.get("connectedGuild");
        const error = params.get("guildConnectError");
        if (!connected && !error) return null;
        window.history.replaceState(null, "", window.location.pathname);
        if (connected) return {type: "success", text: t("forms.connectSuccess", {guildId: connected})};
        return {type: "error", text: error === "manager" ? t("forms.connectErrorManager")
                : error === "bot" ? t("forms.connectErrorBot") : t("forms.connectError")};
    });

    const staff = useMemo(() => (refreshed ?? all ?? []).filter(g => g.role !== "RESPONDENT"), [refreshed, all]);
    const counts = {
        all: staff.length,
        OWNER: staff.filter(g => g.role === "OWNER").length,
        MODERATOR: staff.filter(g => g.role === "MODERATOR").length,
    };
    const q = query.trim().toLowerCase();
    const shown = staff.filter(g => (filter === "all" || g.role === filter)
        && (!q || g.guildName.toLowerCase().includes(q) || g.guildId.includes(q)));

    const connect = async (guildId?: string) => {
        setConnecting(guildId ?? "new");
        try {
            const {url} = await getGuildConnectUrl(guildId);
            window.location.href = url;
        } catch (e) {
            setBanner({type: "error", text: e instanceof ApiError && e.status === 429
                    ? t("forms.connectErrorTooMany") : t("forms.connectError")});
            setConnecting(null);
        }
    };

    const refresh = async () => {
        setRefreshing(true);
        try {
            setRefreshed(await refreshMyGuilds());
            reloadGuilds();
        } catch (e) {
            setBanner({type: "error", text: e instanceof ApiError && e.status === 429
                    ? t("servers.refreshTooOften") : t("servers.refreshError")});
        } finally {
            setRefreshing(false);
        }
    };

    const addButton = (
        <button type="button" onClick={() => connect()} disabled={connecting !== null}
                className="flex h-10 items-center gap-2 rounded-xl bg-pr px-4 text-sm font-semibold text-white hover:bg-prh disabled:opacity-60">
            <FiPlus size={16} aria-hidden="true"/>{t("servers.addBot")}
        </button>
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="m-0 text-[28px] font-bold tracking-[-0.01em]">{t("servers.title")}</h1>
                    <p className="m-0 text-[15px] text-mu">{t("servers.subtitle")}</p>
                </div>
                <div className="flex gap-2.5">
                    <button type="button" onClick={refresh} disabled={refreshing}
                            className="flex h-10 items-center gap-2 rounded-xl border border-bd bg-sf px-3.5 text-sm font-medium text-tx hover:bg-s2 disabled:opacity-60">
                        <FiRefreshCw size={15} aria-hidden="true" className={refreshing ? "animate-spin" : undefined}/>
                        {t("servers.refresh")}
                    </button>
                    {addButton}
                </div>
            </div>

            {banner && (
                <div role={banner.type === "error" ? "alert" : "status"}
                     className={cx("flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm",
                         banner.type === "success" ? "bg-gnb text-gnt" : "bg-rdb text-rdt")}>
                    <span>{banner.text}</span>
                    <button type="button" onClick={() => setBanner(null)} aria-label={t("common.close")}
                            className="opacity-70 hover:opacity-100"><FiX size={14}/></button>
                </div>
            )}

            {all === null ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4" aria-busy="true">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-[260px] rounded-2xl"/>)}
                </div>
            ) : staff.length === 0 ? (
                <div className="flex flex-col items-center gap-3.5 rounded-2xl border border-bd bg-sf px-6 py-[72px] text-center">
                    <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-prs text-prt"><FiServer size={28} aria-hidden="true"/></span>
                    <h2 className="m-0 text-xl font-bold">{t("servers.emptyTitle")}</h2>
                    <p className="m-0 max-w-[440px] text-[15px] leading-normal text-mu">{t("servers.emptyText")}</p>
                    {addButton}
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <SegmentedControl ariaLabel={t("servers.filterLabel")} value={filter} onChange={setFilter}
                                          options={(["all", "OWNER", "MODERATOR"] as const).map(v => ({
                                              value: v, count: counts[v],
                                              label: v === "all" ? t("servers.filter.all") : t(`forms.guilds.role.${v.toLowerCase()}`),
                                          }))}/>
                        <label className="flex h-10 w-[280px] max-w-full items-center gap-2 rounded-xl border border-bd bg-sf px-3 text-mu focus-within:border-pr">
                            <FiSearch size={15} aria-hidden="true"/>
                            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("servers.search")}
                                   aria-label={t("servers.search")}
                                   className="min-w-0 flex-1 border-0 bg-transparent text-sm text-tx outline-none placeholder:text-mu"/>
                        </label>
                    </div>
                    <ul className="m-0 flex list-none flex-col gap-2.5 p-0 md:hidden">
                        {shown.map(g => <ServerRow key={g.guildId} guild={g}/>)}
                    </ul>
                    <div className="hidden grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 md:grid">
                        {shown.map(g => <ServerCard key={g.guildId} guild={g} onFix={() => connect(g.guildId)}
                                                    fixing={connecting === g.guildId}/>)}
                        <button type="button" onClick={() => connect()} disabled={connecting !== null}
                                className="flex min-h-[260px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-bd text-mu hover:border-pr hover:bg-prs/40">
                            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-prs text-prt"><FiPlus size={20} aria-hidden="true"/></span>
                            <span className="text-[15px] font-semibold text-tx">{t("servers.addCard")}</span>
                            <span className="text-[13px]">{t("servers.addCardHint")}</span>
                        </button>
                    </div>
                    {shown.length === 0 && <p className="m-0 text-center text-sm text-mu">{t("servers.nothingFound")}</p>}
                </>
            )}
        </div>
    );
}

/** A server on the phone (MobileShell.dc.html): icon, name, the bot's state, how many wait. */
function ServerRow({guild}: { guild: MyGuild }) {
    const {t} = useTranslation();
    const state = guild.botState ?? (guild.botStatus === "KICKED" ? "KICKED" : "CONNECTED");
    return (
        <li>
            <Link to={`/dashboard/servers/${guild.guildId}/submissions`}
                  className="flex items-center gap-3 rounded-[14px] border border-bd bg-sf p-3.5 text-tx no-underline">
                <ServerIcon name={guild.guildName} src={guild.guildIconUrl} size={42}/>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold">{guild.guildName}</span>
                    <span className={cx("self-start rounded-full px-2 py-0.5 text-[11px] font-semibold", BOT[state].cls)}>
                        {t(`servers.botShort.${state}`)}
                    </span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                    <span className="font-bold tabular-nums">{guild.pendingSubmissions ?? 0}</span>
                    <span className="text-[11px] text-mu">{t("servers.waiting")}</span>
                </span>
            </Link>
        </li>
    );
}

function ServerCard({guild, onFix, fixing}: { guild: MyGuild; onFix: () => void; fixing: boolean }) {
    const {t} = useTranslation();
    const state = guild.botState ?? (guild.botStatus === "KICKED" ? "KICKED" : "CONNECTED");
    const bot = BOT[state];
    const isOwner = guild.role === "OWNER";
    const permissions = (guild.missingPermissions ?? []).map(p => t(`servers.permission.${p}`)).join(", ");
    return (
        <article className="flex flex-col gap-4 rounded-2xl border border-bd bg-sf p-5">
            <div className="flex items-center gap-3">
                <ServerIcon name={guild.guildName} src={guild.guildIconUrl} size={48}/>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 className="m-0 truncate text-[17px] font-bold">{guild.guildName}</h2>
                    <span className="text-[13px] text-mu">
                        {guild.memberCount != null ? t("servers.members", {count: guild.memberCount}) : t("servers.membersUnknown")}
                    </span>
                </div>
                <span className="rounded-full border border-bd px-2.5 py-1 text-xs font-semibold">
                    {t(`forms.guilds.role.${guild.role.toLowerCase()}`)}
                </span>
            </div>
            <div className={cx("flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium", bot.cls)}>
                <bot.icon size={15} aria-hidden="true" className="flex-none"/>
                <span className="flex-1">{t(`servers.bot.${state}`, {permissions})}</span>
                {state !== "CONNECTED" && isOwner && (
                    <button type="button" onClick={onFix} disabled={fixing} className="font-semibold underline">
                        {t(state === "KICKED" ? "servers.inviteAgain" : "servers.grant")}
                    </button>
                )}
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-mu">{t("servers.activeForms")}</span>
                    <span className="text-xl font-semibold tabular-nums">{guild.activeForms ?? 0}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-mu">{t("servers.pending")}</span>
                    <span className="text-xl font-semibold tabular-nums">{guild.pendingSubmissions ?? 0}</span>
                </div>
            </div>
            <Link to={`/dashboard/servers/${guild.guildId}/forms`}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-bd text-sm font-semibold text-tx hover:bg-s2">
                {t("servers.open")}<FiArrowRight size={15} aria-hidden="true"/>
            </Link>
        </article>
    );
}
