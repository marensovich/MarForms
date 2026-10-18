import {type FormEvent, useEffect, useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiChevronDown, FiSearch} from "react-icons/fi";
import {banGuildUser, getGuildBans, type GuildBan, type MyGuild, unbanGuildUser} from "../../../api/dashboard";
import {describeApiError} from "../../../api/errors";
import {Avatar, ConfirmDialog, EmptyState, ErrorState, Skeleton, Spinner, useToast} from "../../../ui";

// Docs: docs/design/mockups/WsBans.dc.html; ТЗ 4.8.

/** Term presets in days; 0 = forever, -1 = a chosen date. */
const TERMS = [0, 1, 3, 7, 30, -1];

/** LocalDateTime for the API: the end of the chosen day, or now plus the days. */
function expiryOf(term: number, date: string): string | null {
    if (term === 0) return null;
    const end = term === -1 ? new Date(`${date}T23:59:00`) : new Date(Date.now() + term * 86_400_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`;
}

/**
 * A server's bans (ТЗ 4.8): «Забанить пользователя» by Discord ID or name,
 * with a reason the user sees and a term, and the list — who, why, when and
 * by whom, until when — with «Снять бан» after a confirmation. A lapsed ban
 * ends by itself and leaves the list.
 */
export default function BansPanel({guild}: { guild: MyGuild }) {
    const {t, i18n} = useTranslation();
    const toast = useToast();
    const ids = {user: useId(), reason: useId(), term: useId(), date: useId()};
    const [bans, setBans] = useState<GuildBan[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [target, setTarget] = useState("");
    const [reason, setReason] = useState("");
    const [term, setTerm] = useState(0);
    const [date, setDate] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [lifting, setLifting] = useState<GuildBan | null>(null);

    useEffect(() => {
        let cancelled = false;
        getGuildBans(guild.guildId)
            .then(list => {
                if (cancelled) return;
                setBans(list);
                setLoadError(null);
            })
            .catch(e => !cancelled && setLoadError(describeApiError(e, t("bans.loadError"))));
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, reloadKey, t]);

    const day = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, {day: "numeric", month: "short"});
    const today = new Date().toISOString().slice(0, 10);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const value = target.trim();
        if (!value || busy) return;
        if (term === -1 && !date) {
            setError(t("bans.pickDate"));
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const ban = await banGuildUser(guild.guildId, {
                ...(/^\d{5,20}$/.test(value) ? {discordId: value} : {username: value}),
                reason: reason.trim() || undefined,
                expiresAt: expiryOf(term, date),
            });
            setBans(list => list && [ban, ...list.filter(b => b.discordId !== ban.discordId)]);
            setTarget("");
            setReason("");
            setTerm(0);
            setDate("");
            toast({tone: "success", text: t("bans.banned", {name: ban.username ?? ban.discordId})});
        } catch (err) {
            setError(describeApiError(err, t("bans.addError")));
        } finally {
            setBusy(false);
        }
    };

    const lift = async () => {
        const ban = lifting!;
        try {
            await unbanGuildUser(guild.guildId, ban.discordId);
            setBans(list => list && list.filter(b => b.discordId !== ban.discordId));
            toast({tone: "success", text: t("bans.lifted", {name: ban.username ?? ban.discordId})});
        } catch (err) {
            toast({tone: "error", text: describeApiError(err, t("bans.removeError"))});
        } finally {
            setLifting(null);
        }
    };

    const q = query.trim().toLowerCase();
    const shown = (bans ?? []).filter(b => !q || (b.username ?? "").toLowerCase().includes(q)
        || b.discordId.includes(q) || (b.reason ?? "").toLowerCase().includes(q));
    const field = "h-11 rounded-xl border border-bd bg-sf px-3 text-sm text-tx outline-none focus:border-pr";

    return (
        <div className="flex flex-wrap items-start gap-5 pt-6">
            <form onSubmit={submit} className="flex max-w-[380px] flex-[1_1_320px] flex-col gap-3.5 rounded-2xl border border-bd bg-sf p-5">
                <div className="flex flex-col gap-1">
                    <h2 className="m-0 text-[17px] font-bold">{t("bans.formTitle")}</h2>
                    <p className="m-0 text-sm leading-[1.45] text-mu">{t("bans.formText")}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor={ids.user} className="text-[13px] font-semibold">{t("bans.who")}</label>
                    <input id={ids.user} value={target} onChange={e => setTarget(e.target.value)}
                           placeholder={t("bans.whoPlaceholder")} className={field}/>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor={ids.reason} className="text-[13px] font-semibold">{t("bans.reason")}</label>
                    <textarea id={ids.reason} value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500}
                              placeholder={t("bans.reasonPlaceholder")}
                              className="resize-y rounded-xl border border-bd bg-sf px-3 py-2.5 text-sm text-tx outline-none focus:border-pr"/>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor={ids.term} className="text-[13px] font-semibold">{t("bans.term")}</label>
                    <span className="relative">
                        <select id={ids.term} value={term} onChange={e => setTerm(Number(e.target.value))}
                                className={`${field} w-full cursor-pointer appearance-none pr-9`}>
                            {TERMS.map(d => (
                                <option key={d} value={d}>
                                    {d === 0 ? t("bans.forever") : d === -1 ? t("bans.untilDate") : t("bans.days", {count: d})}
                                </option>
                            ))}
                        </select>
                        <FiChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-3.5 text-mu"/>
                    </span>
                    {term === -1 && (
                        <input id={ids.date} type="date" min={today} value={date} onChange={e => setDate(e.target.value)}
                               aria-label={t("bans.untilDate")} className={field}/>
                    )}
                </div>
                {error && <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>}
                <button type="submit" disabled={busy || !target.trim()}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-dg text-sm font-semibold text-white hover:bg-dgh disabled:opacity-50">
                    {busy && <Spinner/>}{t("bans.add")}
                </button>
            </form>

            <section className="min-w-0 flex-[999_1_520px] overflow-x-auto rounded-2xl border border-bd bg-sf">
                <div className="flex items-center justify-between gap-3 border-b border-bd px-[18px] py-3.5">
                    <h2 className="m-0 text-[17px] font-bold">{t("bans.listTitle", {count: bans?.length ?? 0})}</h2>
                    <label className="flex h-9 w-[240px] max-w-full items-center gap-2 rounded-[10px] border border-bd px-2.5 text-mu focus-within:border-pr">
                        <FiSearch size={14} aria-hidden="true"/>
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("bans.search")}
                               aria-label={t("bans.search")}
                               className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-tx outline-none placeholder:text-mu"/>
                    </label>
                </div>
                {loadError ? (
                    <ErrorState className="m-4" title={t("bans.loadError")} text={loadError}
                                onRetry={() => setReloadKey(k => k + 1)} retryLabel={t("ui.retry")}/>
                ) : bans === null ? (
                    <div className="flex flex-col gap-2 p-4" aria-busy="true">
                        {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 rounded-lg"/>)}
                    </div>
                ) : bans.length === 0 ? (
                    <EmptyState className="m-4" title={t("bans.empty")} text={t("bans.emptyText")}/>
                ) : (
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                        <thead>
                        <tr className="text-left text-xs text-mu">
                            {(["user", "reason", "when", "until"] as const).map(c => (
                                <th key={c} className="border-b border-bd px-[18px] py-2.5 font-semibold">{t(`bans.columns.${c}`)}</th>
                            ))}
                            <th className="border-b border-bd px-[18px] py-2.5"><span className="sr-only">{t("ui.actions")}</span></th>
                        </tr>
                        </thead>
                        <tbody>
                        {shown.map(b => (
                            <tr key={b.discordId}>
                                <td className="border-b border-bd px-[18px] py-3">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar name={b.username ?? b.discordId} size={32}/>
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate font-semibold">{b.username ?? t("moderation.unknownUser")}</span>
                                            <span className="font-mono text-[11px] text-mu">{b.discordId}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="max-w-[240px] break-words border-b border-bd px-[18px] py-3">{b.reason ?? "—"}</td>
                                <td className="whitespace-nowrap border-b border-bd px-[18px] py-3 text-mu">
                                    {day(b.createdAt)}{b.bannedByUsername && ` · ${b.bannedByUsername}`}
                                </td>
                                <td className="whitespace-nowrap border-b border-bd px-[18px] py-3">
                                    {b.expiresAt ? t("bans.until", {date: day(b.expiresAt)}) : t("bans.forever")}
                                </td>
                                <td className="border-b border-bd px-[18px] py-3 text-right">
                                    <button type="button" onClick={() => setLifting(b)}
                                            aria-label={t("bans.removeNamed", {name: b.username ?? b.discordId})}
                                            className="h-[34px] whitespace-nowrap rounded-[10px] border border-bd bg-sf px-3 text-[13px] font-medium text-tx hover:bg-s2">
                                        {t("bans.remove")}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
                {bans && bans.length > 0 && shown.length === 0 && (
                    <p className="m-0 p-6 text-center text-sm text-mu">{t("ui.nothingFound")}</p>
                )}
            </section>

            <ConfirmDialog open={lifting !== null} tone="primary" title={t("bans.confirmTitle")}
                           text={lifting && t("bans.confirmText", {name: lifting.username ?? lifting.discordId})}
                           confirmLabel={t("bans.remove")} onConfirm={lift} onCancel={() => setLifting(null)}/>
        </div>
    );
}
