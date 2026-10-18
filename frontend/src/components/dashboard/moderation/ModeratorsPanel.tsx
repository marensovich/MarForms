import {type KeyboardEvent, useEffect, useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiSearch} from "react-icons/fi";
import {
    addGuildModerator,
    getGuildModerators,
    type GuildModerator,
    type MemberCandidate,
    type MyGuild,
    removeGuildModerator,
    searchGuildMembers,
} from "../../../api/dashboard";
import {describeApiError} from "../../../api/errors";
import {Avatar, ConfirmDialog, cx, ErrorState, Skeleton, Spinner, useToast} from "../../../ui";

// Docs: docs/design/mockups/WsModerators.dc.html; ТЗ 4.7.

const ID = /^\d{5,20}$/;

/** «lena» in «lena.vibe» in bold, as the mockup's suggestions show the typed part. */
function Highlight({text, query}: { text: string; query: string }) {
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (!query || i < 0) return <>{text}</>;
    return <>{text.slice(0, i)}<b>{text.slice(i, i + query.length)}</b>{text.slice(i + query.length)}</>;
}

/**
 * A server's team for its owner (ТЗ 4.7): «Добавить модератора» with server
 * members suggested through the bot, and «Команда · N» — who, their role, who
 * added them and when, removal with confirmation. The owner can't be removed.
 */
export default function ModeratorsPanel({guild}: { guild: MyGuild }) {
    const {t, i18n} = useTranslation();
    const toast = useToast();
    const listId = useId();
    const [team, setTeam] = useState<GuildModerator[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [query, setQuery] = useState("");
    const [found, setFound] = useState<{ q: string; members: MemberCandidate[] } | null>(null);
    const [active, setActive] = useState(0);
    const [picked, setPicked] = useState<MemberCandidate | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [removing, setRemoving] = useState<GuildModerator | null>(null);

    useEffect(() => {
        let cancelled = false;
        getGuildModerators(guild.guildId)
            .then(list => {
                if (cancelled) return;
                setTeam(list);
                setLoadError(null);
            })
            .catch(e => !cancelled && setLoadError(describeApiError(e, t("moderators.loadError"))));
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, reloadKey, t]);

    // Suggestions once typing pauses; an ID is added as is.
    const q = query.trim();
    useEffect(() => {
        if (q.length < 2 || ID.test(q) || picked) return;
        const controller = new AbortController();
        const id = setTimeout(() => {
            searchGuildMembers(guild.guildId, q, controller.signal)
                .then(members => {
                    setFound({q, members});
                    setActive(0);
                })
                .catch(() => undefined);
        }, 250);
        return () => {
            clearTimeout(id);
            controller.abort();
        };
    }, [guild.guildId, q, picked]);

    const suggestions = !picked && found && found.q === q && q.length >= 2 ? found.members : [];
    const open = suggestions.length > 0;

    const pick = (m: MemberCandidate) => {
        setPicked(m);
        setQuery(m.username);
        setError(null);
    };

    const add = async () => {
        const target = picked ? {discordId: picked.discordId} : ID.test(q) ? {discordId: q} : suggestions[active]
            ? {discordId: suggestions[active].discordId} : q ? {username: q} : null;
        if (!target || busy) return;
        setBusy(true);
        setError(null);
        try {
            const added = await addGuildModerator(guild.guildId, target);
            setTeam(list => list && (list.some(m => m.discordId === added.discordId) ? list : [...list, added]));
            setQuery("");
            setPicked(null);
            setFound(null);
            toast({tone: "success", text: t("moderators.added", {name: added.username})});
        } catch (e) {
            setError(describeApiError(e, t("moderators.addError")));
        } finally {
            setBusy(false);
        }
    };

    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown" && open) {
            e.preventDefault();
            setActive(i => (i + 1) % suggestions.length);
        } else if (e.key === "ArrowUp" && open) {
            e.preventDefault();
            setActive(i => (i - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (open) pick(suggestions[active]);
            else add();
        } else if (e.key === "Escape") {
            setFound(null);
        }
    };

    const remove = async () => {
        const target = removing!;
        try {
            await removeGuildModerator(guild.guildId, target.discordId);
            setTeam(list => list && list.filter(m => m.discordId !== target.discordId));
            toast({tone: "success", text: t("moderators.removed", {name: target.username})});
        } catch (e) {
            toast({tone: "error", text: describeApiError(e, t("moderators.removeError"))});
        } finally {
            setRemoving(null);
        }
    };

    const addedLine = (m: GuildModerator) => {
        if (m.role === "OWNER") return t("moderators.owner");
        const date = new Date(m.since).toLocaleDateString(i18n.language, {day: "numeric", month: "short"});
        return m.addedByName ? t("moderators.addedBy", {date, name: m.addedByName}) : t("moderators.addedOn", {date});
    };

    return (
        <div className="flex max-w-[980px] flex-col gap-5 pt-6">
            <section className="relative flex flex-col gap-3 rounded-2xl border border-bd bg-sf p-5">
                <div className="flex flex-col gap-1">
                    <h2 className="m-0 text-[17px] font-bold">{t("moderators.addTitle")}</h2>
                    <p className="m-0 text-sm text-mu">{t("moderators.addText")}</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <label className="flex h-11 flex-[1_1_320px] items-center gap-2 rounded-xl border-[1.5px] border-bd bg-sf px-3 text-mu focus-within:border-pr">
                        <FiSearch size={16} aria-hidden="true"/>
                        <input value={query} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
                               aria-activedescendant={open ? `${listId}-${active}` : undefined}
                               aria-label={t("moderators.placeholder")} placeholder={t("moderators.placeholder")}
                               onChange={e => {
                                   setQuery(e.target.value);
                                   setPicked(null);
                                   setError(null);
                               }}
                               onKeyDown={onKey}
                               className="min-w-0 flex-1 border-0 bg-transparent text-sm text-tx outline-none placeholder:text-mu"/>
                    </label>
                    <button type="button" onClick={add} disabled={busy || !q}
                            className="flex h-11 items-center gap-2 rounded-xl bg-pr px-[18px] text-sm font-semibold text-white hover:bg-prh disabled:opacity-50">
                        {busy && <Spinner/>}{t("moderators.add")}
                    </button>
                </div>
                {open && (
                    <div id={listId} role="listbox" aria-label={t("moderators.members")}
                         className="flex max-w-[520px] flex-col gap-0.5 rounded-[14px] border border-bd bg-sf p-1.5 shadow-popover">
                        <span className="px-2.5 py-1.5 text-xs text-mu">{t("moderators.members")}</span>
                        {suggestions.map((m, i) => (
                            <div key={m.discordId} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                                 onMouseDown={e => e.preventDefault()} onClick={() => pick(m)} onMouseEnter={() => setActive(i)}
                                 className={cx("flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2", i === active && "bg-s2")}>
                                <Avatar name={m.username} src={m.avatarUrl} size={30}/>
                                <span className="flex-1 text-sm">
                                    <Highlight text={m.username} query={q}/>
                                    {m.displayName && m.displayName !== m.username && <span className="text-mu"> · {m.displayName}</span>}
                                    {m.role && <span className="ml-1.5 text-xs text-mu">({t(`forms.guilds.role.${m.role.toLowerCase()}`)})</span>}
                                </span>
                                <span className="font-mono text-[11px] text-mu">{m.discordId}</span>
                            </div>
                        ))}
                    </div>
                )}
                {error && <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>}
            </section>

            <section className="rounded-2xl border border-bd bg-sf">
                <div className="flex items-center justify-between border-b border-bd px-5 py-4">
                    <h2 className="m-0 text-[17px] font-bold">{t("moderators.team", {count: team?.length ?? 0})}</h2>
                </div>
                {loadError ? (
                    <ErrorState className="m-4" title={t("moderators.loadError")} text={loadError}
                                onRetry={() => setReloadKey(k => k + 1)} retryLabel={t("ui.retry")}/>
                ) : team === null ? (
                    <div className="flex flex-col gap-2 p-5" aria-busy="true">
                        {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 rounded-lg"/>)}
                    </div>
                ) : (
                    <ul className="m-0 list-none p-0">
                        {team.map(m => {
                            const owner = m.role === "OWNER";
                            return (
                                <li key={m.discordId} className="flex flex-wrap items-center gap-3.5 border-b border-bd px-5 py-3.5 last:border-0">
                                    <Avatar name={m.username} src={m.avatarUrl} size={40}/>
                                    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                                        <span className="truncate text-[15px] font-semibold">{m.username}</span>
                                        <span className="font-mono text-[11px] text-mu">ID {m.discordId}</span>
                                    </div>
                                    <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold",
                                        owner ? "bg-prs text-prt" : "border border-bd text-tx")}>
                                        {t(`forms.guilds.role.${owner ? "owner" : "moderator"}`)}
                                    </span>
                                    <span className="w-[180px] text-[13px] text-mu">{addedLine(m)}</span>
                                    {owner ? (
                                        <span className="px-3 text-[13px] font-medium text-mu">{t("moderators.cantRemove")}</span>
                                    ) : (
                                        <button type="button" onClick={() => setRemoving(m)}
                                                aria-label={t("moderators.removeNamed", {name: m.username})}
                                                className="h-9 rounded-[10px] border border-bd bg-sf px-3 text-[13px] font-medium text-rdt hover:bg-rdb">
                                            {t("common.delete")}
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <ConfirmDialog open={removing !== null} title={t("moderators.confirmTitle")}
                           text={removing && t("moderators.confirmText", {name: removing.username})}
                           confirmLabel={t("moderators.remove")} onConfirm={remove} onCancel={() => setRemoving(null)}/>
        </div>
    );
}
