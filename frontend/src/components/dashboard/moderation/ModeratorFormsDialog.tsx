import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {type DashboardForm, getGuildForms, type GuildModerator, setModeratorForms} from "../../../api/dashboard";
import {describeApiError} from "../../../api/errors";
import {Button, cx, ErrorState, Modal, Radio, Skeleton} from "../../../ui";

// Not in the mockup (WsModerators.dc.html): the owner's answer to question 3
// (2026-10-11, #18) — a moderator works with every form unless the owner
// narrows them to some. Built from the roles picker of the admin users page.

/** The moderator's forms: all of the server's, or only the chosen ones. */
export default function ModeratorFormsDialog({guildId, moderator, onClose, onSaved}: {
    guildId: string;
    moderator: GuildModerator;
    onClose: () => void;
    onSaved: (updated: GuildModerator) => void;
}) {
    const {t} = useTranslation();
    const [forms, setForms] = useState<DashboardForm[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [restricted, setRestricted] = useState(moderator.formsRestricted ?? false);
    const [picked, setPicked] = useState<Set<string>>(() => new Set(moderator.formIds ?? []));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getGuildForms(guildId, true)
            .then(page => {
                if (cancelled) return;
                setForms(page.content);
                setLoadError(null);
            })
            .catch(e => !cancelled && setLoadError(describeApiError(e, t("moderators.formsLoadError"))));
        return () => {
            cancelled = true;
        };
    }, [guildId, reloadKey, t]);

    const toggle = (id: string) => setPicked(s => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            // Only forms that still exist go back; a deleted one has left the list on the server already.
            const known = new Set((forms ?? []).map(f => f.id));
            const updated = await setModeratorForms(guildId, moderator.discordId, {
                restricted,
                formIds: restricted ? [...picked].filter(id => known.has(id)) : [],
            });
            onSaved(updated);
        } catch (e) {
            setError(describeApiError(e, t("moderators.formsError")));
            setBusy(false);
        }
    };

    const chosen = forms ? forms.filter(f => picked.has(f.id)).length : 0;

    return (
        <Modal open onClose={onClose} width={480} title={t("moderators.formsTitle")}
               description={t("moderators.formsText", {name: moderator.username})}
               footer={(
                   <>
                       <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
                       <Button loading={busy} disabled={forms === null} onClick={save}>{t("common.save")}</Button>
                   </>
               )}>
            <div className="flex flex-col gap-3">
                <div role="radiogroup" aria-label={t("moderators.formsTitle")} className="flex flex-col gap-2">
                    <label className={cx("flex cursor-pointer items-start gap-3 rounded-[10px] border px-3 py-2.5",
                        !restricted ? "border-pr bg-prs" : "border-bd hover:bg-s2")}>
                        <Radio name="moderator-forms" checked={!restricted} onChange={() => setRestricted(false)} className="mt-0.5"/>
                        <span className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{t("moderators.formsAllOption")}</span>
                            <span className="text-xs text-mu">{t("moderators.formsAllHint")}</span>
                        </span>
                    </label>
                    <label className={cx("flex cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2.5",
                        restricted ? "border-pr bg-prs" : "border-bd hover:bg-s2")}>
                        <Radio name="moderator-forms" checked={restricted} onChange={() => setRestricted(true)}/>
                        <span className="text-sm font-medium">{t("moderators.formsSomeOption")}</span>
                    </label>
                </div>

                {restricted && (loadError ? (
                    <ErrorState title={t("moderators.formsLoadError")} text={loadError}
                                onRetry={() => setReloadKey(k => k + 1)} retryLabel={t("ui.retry")}/>
                ) : forms === null ? (
                    <div className="flex flex-col gap-2" aria-busy="true">
                        {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 rounded-lg"/>)}
                    </div>
                ) : forms.length === 0 ? (
                    <p className="m-0 px-1 text-sm text-mu">{t("moderators.formsEmpty")}</p>
                ) : (
                    <ul className="m-0 flex max-h-[320px] list-none flex-col gap-1 overflow-y-auto p-0">
                        {forms.map(f => (
                            <li key={f.id}>
                                <label className={cx("flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5",
                                    picked.has(f.id) ? "bg-prs" : "hover:bg-s2")}>
                                    <input type="checkbox" checked={picked.has(f.id)} onChange={() => toggle(f.id)}
                                           className="h-4 w-4 accent-pr"/>
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.title}</span>
                                    {f.status === "ARCHIVED" && <span className="text-xs text-mu">{t("moderators.formsArchived")}</span>}
                                </label>
                            </li>
                        ))}
                    </ul>
                ))}

                {restricted && forms !== null && forms.length > 0 && chosen === 0 && (
                    <p className="m-0 rounded-[10px] bg-amb px-3 py-2 text-[13px] text-amt">{t("moderators.formsNoneWarning")}</p>
                )}
                {error && <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>}
            </div>
        </Modal>
    );
}
