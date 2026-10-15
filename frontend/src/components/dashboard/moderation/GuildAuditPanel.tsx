import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiArrowLeft, FiChevronLeft, FiChevronRight, FiList} from "react-icons/fi";
import {getGuildModerators, type GuildModerator, type MyGuild} from "../../../api/dashboard";
import {type GuildAuditAction, type GuildAuditEntry, getGuildAuditLog} from "../../../api/moderation";
import {describeApiError} from "../../../api/errors";
import {Badge, EmptyState, TabSkeleton} from "../shared";

const ACTIONS: GuildAuditAction[] = [
    "SUBMISSION_DECIDED", "SUBMISSION_DM_FAILED", "MODERATOR_ADDED", "MODERATOR_REMOVED", "GUILD_BAN_ADDED", "GUILD_BAN_REMOVED",
    "GUILD_CONNECTED", "GUILD_ROLE_REVOKED", "SUBMISSION_DELETED", "FORM_DELETED",
];

const COLOR: Record<GuildAuditAction, "purple" | "green" | "red"> = {
    SUBMISSION_DECIDED: "purple",
    SUBMISSION_DM_FAILED: "red",
    MODERATOR_ADDED: "green",
    MODERATOR_REMOVED: "red",
    GUILD_BAN_ADDED: "red",
    GUILD_BAN_REMOVED: "green",
    GUILD_CONNECTED: "purple",
    GUILD_ROLE_REVOKED: "red",
    SUBMISSION_DELETED: "red",
    FORM_DELETED: "red",
};

const PAGE_SIZE = 30;

function Details({entry}: { entry: GuildAuditEntry }) {
    const {t} = useTranslation();
    const m = entry.metadata ?? {};
    return (
        <div className="min-w-0">
            <p className="truncate text-sm text-tx">
                {entry.targetName ?? entry.targetId ?? "—"}
                {entry.targetType === "USER" && entry.targetId && (
                    <span className="ml-1.5 font-mono text-[11px] text-mu">{entry.targetId}</span>
                )}
            </p>
            {m.from && m.to && (
                <p className="text-xs text-mu">
                    {t("guildAudit.statusChange", {
                        from: t(`moderation.status.${m.from}`),
                        to: t(`moderation.status.${m.to}`),
                    })}
                </p>
            )}
            {m.comment && <p className="break-words text-xs text-mu">{t("guildAudit.comment", {comment: m.comment})}</p>}
            {m.reason && <p className="break-words text-xs text-mu">{t("guildAudit.reason", {reason: m.reason})}</p>}
        </div>
    );
}

/**
 * A server's audit log for its owner (task #78): who decided what, who
 * was made or removed as moderator, who was banned. Moderators can't open
 * it; the API refuses them too.
 */
export default function GuildAuditPanel({guild, onBack}: { guild: MyGuild; onBack: () => void }) {
    const {t} = useTranslation();
    const [entries, setEntries] = useState<GuildAuditEntry[]>([]);
    const [moderators, setModerators] = useState<GuildModerator[]>([]);
    const [action, setAction] = useState<GuildAuditAction | "">("");
    const [actorId, setActorId] = useState("");
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getGuildModerators(guild.guildId).then(setModerators).catch(() => setModerators([]));
    }, [guild.guildId]);

    useEffect(() => {
        let cancelled = false;
        getGuildAuditLog(guild.guildId, {action: action || undefined, actorId: actorId || undefined, page, size: PAGE_SIZE})
            .then(r => {
                if (cancelled) return;
                setEntries(r.content);
                setTotalPages(r.page.totalPages);
                setError(null);
            })
            .catch(e => {
                if (!cancelled) setError(describeApiError(e, t("guildAudit.loadError")));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, action, actorId, page, t]);

    const changePage = (next: number) => {
        setLoading(true);
        setPage(next);
    };

    return (
        <div>
            <button onClick={onBack}
                    className="mb-4 flex items-center gap-1.5 text-sm text-mu transition-colors hover:text-tx">
                <FiArrowLeft size={14}/>
                {t("servers.title")}
            </button>

            <div className="mb-6">
                <h1 className="text-xl font-semibold text-tx">{guild.guildName}</h1>
                <p className="mt-0.5 text-sm text-mu">{t("guildAudit.subtitle")}</p>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <select
                    value={action}
                    onChange={e => {
                        setLoading(true);
                        setPage(0);
                        setAction(e.target.value as GuildAuditAction | "");
                    }}
                    className="rounded-lg border border-bd bg-sf px-3 py-2 text-xs text-mu outline-none focus:border-pr"
                >
                    <option value="">{t("guildAudit.filter.allActions")}</option>
                    {ACTIONS.map(a => <option key={a} value={a}>{t(`guildAudit.actions.${a}`)}</option>)}
                </select>
                <select
                    value={actorId}
                    onChange={e => {
                        setLoading(true);
                        setPage(0);
                        setActorId(e.target.value);
                    }}
                    className="rounded-lg border border-bd bg-sf px-3 py-2 text-xs text-mu outline-none focus:border-pr"
                >
                    <option value="">{t("guildAudit.filter.allActors")}</option>
                    {moderators.map(m => <option key={m.discordId} value={m.discordId}>{m.username}</option>)}
                </select>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-rdb bg-rdb px-3 py-2 text-xs text-rdt">
                    {error}
                </div>
            )}

            {loading ? (
                <TabSkeleton rows={5}/>
            ) : entries.length === 0 ? (
                <EmptyState message={t("guildAudit.empty")} icon={<FiList/>}/>
            ) : (
                <ul className="divide-y divide-bd overflow-hidden rounded-xl border border-bd bg-sf">
                    {entries.map(entry => (
                        <li key={entry.id} className="grid grid-cols-[150px_170px_1fr] items-start gap-4 px-5 py-3">
                            <div>
                                <p className="text-xs text-mu">{new Date(entry.createdAt).toLocaleString()}</p>
                                <p className="mt-0.5 truncate text-xs font-medium text-tx">
                                    {entry.actorUsername ?? entry.actorDiscordId ?? t("guildAudit.unknownActor")}
                                </p>
                            </div>
                            <div>
                                <Badge color={COLOR[entry.action]} dot>{t(`guildAudit.actions.${entry.action}`)}</Badge>
                            </div>
                            <Details entry={entry}/>
                        </li>
                    ))}
                </ul>
            )}

            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-1.5">
                    <button onClick={() => changePage(Math.max(0, page - 1))} disabled={page === 0}
                            className="flex items-center gap-1 rounded-lg border border-bd px-3 py-1.5 text-xs text-mu transition-colors hover:text-tx disabled:cursor-not-allowed disabled:opacity-30">
                        <FiChevronLeft size={13}/> {t("responses.pagination.prev")}
                    </button>
                    <span className="px-2 text-xs text-mu">{page + 1} / {totalPages}</span>
                    <button onClick={() => changePage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                            className="flex items-center gap-1 rounded-lg border border-bd px-3 py-1.5 text-xs text-mu transition-colors hover:text-tx disabled:cursor-not-allowed disabled:opacity-30">
                        {t("responses.pagination.next")} <FiChevronRight size={13}/>
                    </button>
                </div>
            )}
        </div>
    );
}
