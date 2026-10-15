import {type ReactNode, useEffect, useId, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import {FiSearch} from "react-icons/fi";
import {useNavigate} from "react-router-dom";
import {search, type SearchResults} from "../api/search";
import {useTheme} from "../theme/theme";
import {cx, useFocusTrap} from "../ui";
import {formTarget, newFormTarget, queueTarget, submissionTarget, userTarget} from "./commands";
import type {MyGuild} from "../api/dashboard";

// Docs: docs/design/mockups/Components.dc.html — "Командная палитра ⌘K"; ТЗ ФТ-4.1.3.

interface Command {
    key: string;
    group: string;
    label: ReactNode;
    meta?: ReactNode;
    hint?: string;
    run: () => void;
}

const EMPTY: SearchResults = {forms: [], submissions: [], users: []};

function bold(text: string, query: string): ReactNode {
    const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (i < 0) return text;
    return <>{text.slice(0, i)}<b>{text.slice(i, i + query.length)}</b>{text.slice(i + query.length)}</>;
}

export default function CommandPalette({open, onClose, guilds}: { open: boolean; onClose: () => void; guilds: MyGuild[] | null }) {
    if (!open) return null;
    return createPortal(<PaletteDialog onClose={onClose} guilds={guilds}/>, document.body);
}

function PaletteDialog({onClose, guilds}: { onClose: () => void; guilds: MyGuild[] | null }) {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {theme, setPreference} = useTheme();
    const listId = useId();
    const ref = useRef<HTMLDivElement>(null);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResults>(EMPTY);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(0);
    useFocusTrap(ref, true, onClose);

    const q = query.trim();
    useEffect(() => {
        if (q.length < 2) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setLoading(true);
            search(q, controller.signal)
                .then(setResults)
                .catch(() => !controller.signal.aborted && setResults(EMPTY))
                .finally(() => !controller.signal.aborted && setLoading(false));
        }, 200);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [q]);

    const go = (to: string) => {
        onClose();
        navigate(to);
    };

    const commands = useMemo<Command[]>(() => {
        const shown = q.length >= 2 ? results : EMPTY;
        const list: Command[] = [
            ...shown.forms.map(f => ({
                key: `f-${f.id}`, group: t("palette.forms"), run: () => go(formTarget(f)),
                label: <>{bold(f.title, q)}{f.guildName && <span className="text-mu"> · {f.guildName}</span>}</>,
            })),
            ...shown.submissions.map(s => ({
                key: `s-${s.id}`, group: t("palette.submissions"), run: () => go(submissionTarget(s)),
                label: <>{bold(s.authorName ?? s.authorDiscordId ?? "—", q)}<span className="text-mu"> · {s.formTitle ?? "—"}</span></>,
                meta: s.guildName ?? undefined,
            })),
            ...shown.users.map(u => ({
                key: `u-${u.discordId}`, group: t("palette.users"), run: () => go(userTarget(u)),
                label: <>{bold(u.username, q)} <span className="font-mono text-xs text-mu">{u.discordId}</span></>,
            })),
        ];
        const actions: Command[] = [
            {key: "a-new", group: t("palette.actions"), label: t("palette.newForm"), hint: "N", run: () => go(newFormTarget(guilds))},
            {key: "a-queue", group: t("palette.actions"), label: t("palette.queue"), hint: "G Q", run: () => go(queueTarget(guilds))},
            {key: "a-subs", group: t("palette.actions"), label: t("shell.mySubmissions"), run: () => go("/me/submissions")},
            {key: "a-theme", group: t("palette.actions"), label: t("palette.toggleTheme"), run: () => {
                setPreference(theme === "dark" ? "light" : "dark");
                onClose();
            }},
        ];
        const filteredActions = q ? actions.filter(a => String(a.label).toLowerCase().includes(q.toLowerCase())) : actions;
        return [...list, ...filteredActions];
        // go/onClose are stable enough for the lifetime of the dialog.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [results, q, guilds, theme, t]);

    const current = Math.min(active, Math.max(commands.length - 1, 0));
    useEffect(() => {
        document.getElementById(`${listId}-${current}`)?.scrollIntoView?.({block: "nearest"});
    }, [current, listId]);

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (commands.length) setActive((current + (e.key === "ArrowDown" ? 1 : -1) + commands.length) % commands.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            commands[current]?.run();
        }
    };

    let lastGroup = "";
    return (
        <div className="fixed inset-0 z-[55] flex items-start justify-center bg-ov px-4 pt-[14vh]"
             onMouseDown={e => e.target === e.currentTarget && onClose()}>
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("palette.title")}
                 className="w-[560px] max-w-full overflow-hidden rounded-[14px] bg-sf text-tx shadow-palette">
                <div className="flex h-[46px] items-center gap-2.5 border-b border-bd px-3.5">
                    <FiSearch size={16} className="flex-none text-mu" aria-hidden="true"/>
                    <input role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
                           aria-activedescendant={commands.length ? `${listId}-${current}` : undefined}
                           aria-label={t("palette.title")} placeholder={t("palette.placeholder")} data-autofocus
                           value={query} onKeyDown={onKeyDown} autoComplete="off" spellCheck={false}
                           onChange={e => {
                               setQuery(e.target.value);
                               setActive(0);
                               if (e.target.value.trim().length < 2) setResults(EMPTY);
                           }}
                           className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-tx placeholder:text-mu/70 focus:outline-none"/>
                    {loading && <span className="text-xs text-mu" aria-live="polite">{t("palette.searching")}</span>}
                    <kbd className="rounded-md border border-bd px-1.5 py-0.5 text-[11px] text-mu">Esc</kbd>
                </div>
                <div id={listId} role="listbox" aria-label={t("palette.title")} className="flex max-h-[min(420px,60vh)] flex-col gap-0.5 overflow-auto p-1.5 text-[13px]">
                    {q.length >= 2 && !loading && commands.length === 0 && (
                        <div className="px-2 py-3 text-mu">{t("ui.nothingFound")}</div>
                    )}
                    {commands.map((c, i) => {
                        const heading = c.group !== lastGroup ? c.group : null;
                        lastGroup = c.group;
                        return (
                            <div key={c.key} role="presentation">
                                {heading && (
                                    <div role="presentation" className="px-2 pb-1.5 pt-1.5 text-[11px] font-bold uppercase text-mu">{heading}</div>
                                )}
                                <div id={`${listId}-${i}`} role="option" aria-selected={i === current}
                                     onMouseMove={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={c.run}
                                     className={cx("flex cursor-pointer items-center justify-between gap-3 rounded-lg p-2", i === current && "bg-prs")}>
                                    <span className="min-w-0 truncate">{c.label}</span>
                                    <span className="flex flex-none items-center gap-2 text-mu">
                                        {c.meta && <span className="text-xs">{c.meta}</span>}
                                        {c.hint ? <span className="font-mono">{c.hint}</span> : i === current ? "↵" : null}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
