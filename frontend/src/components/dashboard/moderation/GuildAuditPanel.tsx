import {useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import type {IconType} from "react-icons";
import {FiAlertTriangle, FiCheck, FiEdit2, FiFileText, FiLink, FiSlash, FiTrash2, FiUserMinus, FiUserPlus, FiX} from "react-icons/fi";
import type {MyGuild} from "../../../api/dashboard";
import {type GuildAuditAction, type GuildAuditEntry, getGuildAuditActors, getGuildAuditLog} from "../../../api/moderation";
import {describeApiError} from "../../../api/errors";
import {cx, EmptyState, ErrorState, Skeleton, Spinner} from "../../../ui";
import FilterSelect from "./FilterSelect";
import {foldRuns} from "../auditRuns";

// Docs: docs/design/mockups/WsAudit.dc.html; ТЗ 4.6.

const PAGE_SIZE = 30;

/** «Действие»: kinds of actions, each a set of journal actions (the API takes several). */
const GROUPS: Record<string, GuildAuditAction[]> = {
    decisions: ["SUBMISSION_DECIDED"],
    forms: ["FORM_CREATED", "FORM_UPDATED", "FORM_STATUS_CHANGED", "FORM_DELETED", "WEBHOOK_CREATED"],
    moderators: ["MODERATOR_ADDED", "MODERATOR_REMOVED", "MODERATOR_FORMS_CHANGED", "GUILD_ROLE_REVOKED", "GUILD_ROLE_GRANTED", "GUILD_ADMIN_ROLES_CHANGED"],
    bans: ["GUILD_BAN_ADDED", "GUILD_BAN_REMOVED"],
    submissions: ["SUBMISSION_DELETED"],
    bot: ["BOT_REMOVED", "BOT_RECONNECTED", "BOT_PERMISSIONS_MISSING", "WEBHOOK_FAILING", "SUBMISSION_DM_FAILED", "GUILD_CONNECTED", "GUILD_LOG_CHANNELS_CREATED"],
};
const PERIODS = [1, 7, 30, 90, 0];

const TONE = {
    ok: "bg-gnb text-gnt",
    no: "bg-rdb text-rdt",
    rev: "bg-prs text-prt",
    form: "bg-s2 text-tx",
    warn: "bg-amb text-amt",
} as const;

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);

/** The line's kind: its i18n key, icon and colour. */
function kindOf(e: GuildAuditEntry): { key: string; icon: IconType; tone: keyof typeof TONE } {
    const m = e.metadata ?? {};
    switch (e.action) {
        case "SUBMISSION_DECIDED": {
            const to = str(m.to);
            if (to === "APPROVED") return {key: "decided.APPROVED", icon: FiCheck, tone: "ok"};
            if (to === "REJECTED") return {key: "decided.REJECTED", icon: FiX, tone: "no"};
            if (to === "NEEDS_REVISION") return {key: "decided.NEEDS_REVISION", icon: FiEdit2, tone: "rev"};
            return {key: "decided.PENDING", icon: FiEdit2, tone: "rev"};
        }
        case "FORM_STATUS_CHANGED":
            return {key: `formStatus.${str(m.to) ?? "PUBLISHED"}`, icon: FiFileText, tone: "form"};
        case "FORM_CREATED":
        case "FORM_UPDATED":
            return {key: e.action, icon: FiFileText, tone: "form"};
        case "FORM_DELETED":
        case "SUBMISSION_DELETED":
            return {key: e.action, icon: FiTrash2, tone: "no"};
        case "GUILD_BAN_ADDED":
            return {key: e.action, icon: FiSlash, tone: "no"};
        case "GUILD_BAN_REMOVED":
            return {key: e.action, icon: FiCheck, tone: "ok"};
        case "MODERATOR_ADDED":
        case "GUILD_ROLE_GRANTED":
            return {key: e.action, icon: FiUserPlus, tone: "warn"};
        case "GUILD_ADMIN_ROLES_CHANGED":
            return {key: e.action, icon: FiEdit2, tone: "warn"};
        case "WEBHOOK_CREATED":
        case "GUILD_LOG_CHANNELS_CREATED":
            return {key: e.action, icon: FiLink, tone: "ok"};
        case "MODERATOR_FORMS_CHANGED":
            return {key: e.action, icon: FiFileText, tone: "warn"};
        case "MODERATOR_REMOVED":
        case "GUILD_ROLE_REVOKED":
            return {key: e.action, icon: FiUserMinus, tone: "warn"};
        case "GUILD_CONNECTED":
        case "BOT_RECONNECTED":
            return {key: e.action, icon: FiLink, tone: "ok"};
        case "BOT_REMOVED":
            return {key: e.action, icon: FiX, tone: "no"};
        default:
            return {key: e.action, icon: FiAlertTriangle, tone: "warn"};
    }
}

/** The grey mono line under an entry: the comment, reason, what changed. */
function detailOf(e: GuildAuditEntry & { count?: number }, t: (k: string, o?: Record<string, unknown>) => string): string | null {
    const m = e.metadata ?? {};
    const parts: string[] = [];
    if (str(m.comment)) parts.push(t("guildAudit.detail.comment", {text: str(m.comment)}));
    if (str(m.reason) && e.action !== "WEBHOOK_FAILING") parts.push(t("guildAudit.detail.reason", {text: str(m.reason)}));
    if (e.action === "WEBHOOK_FAILING" && str(m.reason)) {
        parts.push(t(`guildForms.banner.reason.${str(m.reason)}`, {defaultValue: str(m.reason)}));
    }
    if (Array.isArray(m.changes) && m.changes.length) {
        parts.push(t("guildAudit.detail.changes", {list: m.changes.map(c => t(`guildAudit.change.${c}`)).join(", ")}));
    }
    if (Array.isArray(m.permissions) && m.permissions.length) {
        parts.push(m.permissions.map(p => t(`servers.permission.${p}`)).join(", "));
    }
    if (e.action === "FORM_DELETED" && m.submissions !== undefined) {
        parts.push(t("guildAudit.detail.submissionsRemoved", {count: Number(m.submissions)}));
    }
    if ((e.count ?? 1) > 1) parts.push(t("guildAudit.edits", {count: e.count}));
    if (e.targetType === "USER" && e.targetId) parts.push(`ID ${e.targetId}`);
    return parts.length ? parts.join(" · ") : null;
}

/** «Сегодня, 15 октября» / «Вчера, 14 октября» / «13 октября». */
function dayLabel(iso: string, lang: string, t: (k: string, o?: Record<string, unknown>) => string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString(lang, {
        day: "numeric", month: "long", ...(date.getFullYear() !== new Date().getFullYear() ? {year: "numeric"} : {}),
    });
    const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((start(new Date()) - start(date)) / 86_400_000);
    if (diff === 0) return t("guildAudit.today", {day});
    if (diff === 1) return t("guildAudit.yesterday", {day});
    return day;
}

/**
 * A server's journal (ТЗ 4.6): staff actions as a feed by day — who, what,
 * on what, with the comment or reason — filtered by who, the kind of action
 * and the period, loaded further as the reader scrolls.
 */
export default function GuildAuditPanel({guild}: { guild: MyGuild }) {
    const {t, i18n} = useTranslation();
    const [actor, setActor] = useState("");
    const [group, setGroup] = useState("");
    const [days, setDays] = useState(7);
    const [actors, setActors] = useState<{ discordId: string; username: string | null }[]>([]);
    const [feed, setFeed] = useState<{ key: string; items: GuildAuditEntry[]; next: string | null } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [more, setMore] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const sentinel = useRef<HTMLDivElement>(null);

    const filters = {actions: group ? GROUPS[group] : undefined, actorId: actor || undefined, days: days || undefined};
    const key = `${guild.guildId}|${actor}|${group}|${days}|${reloadKey}`;

    useEffect(() => {
        getGuildAuditActors(guild.guildId).then(setActors).catch(() => setActors([]));
    }, [guild.guildId]);

    useEffect(() => {
        let cancelled = false;
        getGuildAuditLog(guild.guildId, {...filters, size: PAGE_SIZE})
            .then(r => {
                if (cancelled) return;
                setFeed({key, items: r.items, next: r.nextCursor});
                setError(null);
            })
            .catch(e => !cancelled && setError(describeApiError(e, t("guildAudit.loadError"))));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the filters
    }, [key, t]);

    const loading = !error && feed?.key !== key;
    const next = feed?.key === key ? feed.next : null;

    const loadMore = async () => {
        if (!next || more) return;
        setMore(true);
        try {
            const r = await getGuildAuditLog(guild.guildId, {...filters, cursor: next, size: PAGE_SIZE});
            setFeed(f => f && f.key === key ? {key, items: [...f.items, ...r.items], next: r.nextCursor} : f);
        } catch (e) {
            setError(describeApiError(e, t("guildAudit.loadError")));
        } finally {
            setMore(false);
        }
    };

    // Scrolling to the end loads the next page (ФТ-4.6.2); the button stays for keyboards and no-IO browsers.
    const loadMoreRef = useRef(loadMore);
    useEffect(() => {
        loadMoreRef.current = loadMore;
    });
    useEffect(() => {
        const node = sentinel.current;
        if (!node || !next || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver(entries => entries.some(e => e.isIntersecting) && loadMoreRef.current());
        io.observe(node);
        return () => io.disconnect();
    }, [next]);

    const items = feed?.key === key ? feed.items : [];
    const groups: { day: string; items: ReturnType<typeof foldRuns<GuildAuditEntry>> }[] = [];
    for (const e of foldRuns(items)) {
        const day = dayLabel(e.createdAt, i18n.language, t);
        if (groups.at(-1)?.day === day) groups.at(-1)!.items.push(e);
        else groups.push({day, items: [e]});
    }

    return (
        <div className="flex max-w-[980px] flex-col gap-5 pt-6">
            <div className="flex flex-wrap gap-2.5">
                <FilterSelect label={t("guildAudit.filter.who")} value={actor} onChange={setActor} strong={false}>
                    <option value="">{t("guildAudit.filter.allActors")}</option>
                    {actors.map(a => <option key={a.discordId} value={a.discordId}>{a.username ?? a.discordId}</option>)}
                </FilterSelect>
                <FilterSelect label={t("guildAudit.filter.action")} value={group} onChange={setGroup} strong={false}>
                    <option value="">{t("guildAudit.filter.anyAction")}</option>
                    {Object.keys(GROUPS).map(g => <option key={g} value={g}>{t(`guildAudit.group.${g}`)}</option>)}
                </FilterSelect>
                <FilterSelect label={t("guildAudit.filter.period")} value={String(days)} onChange={v => setDays(Number(v))} strong={false}>
                    {PERIODS.map(d => <option key={d} value={d}>{t(d ? "guildAudit.period.days" : "guildAudit.period.all", {count: d})}</option>)}
                </FilterSelect>
            </div>

            {error ? (
                <ErrorState title={t("guildAudit.loadError")} text={error} onRetry={() => setReloadKey(k => k + 1)}
                            retryLabel={t("ui.retry")}/>
            ) : loading ? (
                <div className="flex flex-col gap-2" aria-busy="true">
                    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl"/>)}
                </div>
            ) : items.length === 0 ? (
                <EmptyState title={t("guildAudit.empty")} text={t("guildAudit.emptyHint")}/>
            ) : (
                groups.map(g => (
                    <section key={g.day} className="flex flex-col">
                        <h2 className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-mu">{g.day}</h2>
                        <ol className="m-0 list-none rounded-2xl border border-bd bg-sf p-0 py-1">
                            {g.items.map(e => {
                                const kind = kindOf(e);
                                const detail = detailOf(e, t);
                                const who = e.actorUsername ?? (e.actorDiscordId ? e.actorDiscordId : t("guildAudit.unknownActor"));
                                return (
                                    <li key={e.id} className="flex gap-3.5 px-[18px] py-3.5">
                                        <span className={cx("grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px]", TONE[kind.tone])}>
                                            <kind.icon size={16} aria-hidden="true"/>
                                        </span>
                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                            <span className="text-sm leading-[1.45]">
                                                <b>{who}</b> {t(`guildAudit.what.${kind.key}`)}{" "}
                                                {e.targetName && <span className="font-medium text-prt">{e.targetName}</span>}
                                            </span>
                                            {detail && (
                                                <span className="break-words rounded-[10px] bg-s2 px-2.5 py-2 font-mono text-[13px] text-mu">{detail}</span>
                                            )}
                                        </div>
                                        <time dateTime={e.createdAt} className="flex-none text-[13px] tabular-nums text-mu">
                                            {(() => {
                                                const at = (iso: string) => new Date(iso).toLocaleTimeString(i18n.language, {hour: "2-digit", minute: "2-digit"});
                                                // Back-to-back edits merged into one entry read as a span (2026-10-19).
                                                return e.lastAt && at(e.lastAt) !== at(e.createdAt)
                                                    ? t("guildAudit.range", {from: at(e.createdAt), to: at(e.lastAt)}) : at(e.createdAt);
                                            })()}
                                        </time>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                ))
            )}

            {next && !loading && (
                <div ref={sentinel} className="self-center">
                    <button type="button" onClick={loadMore} disabled={more}
                            className="flex h-10 items-center gap-2 rounded-xl border border-bd bg-sf px-4 text-sm font-medium text-tx hover:bg-s2 disabled:opacity-60">
                        {more && <Spinner/>}{t("guildAudit.more")}
                    </button>
                </div>
            )}
        </div>
    );
}
