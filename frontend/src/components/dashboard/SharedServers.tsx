import {useState} from "react";
import {useTranslation} from "react-i18next";
import {FiLink2, FiServer} from "react-icons/fi";
import {type BillingStatus, getGuildBilling, joinWorkspace, leaveWorkspace, type MyGuild} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import {ActionBtn} from "./shared";

/**
 * The servers one subscription covers (E4.3, #101): an owner of several
 * servers adds them under one subscription, or takes one out, from here.
 */
export default function SharedServers({guild, billing, ownedGuilds, onChanged}: {
    guild: MyGuild;
    billing: BillingStatus;
    /** Every server the current user owns. */
    ownedGuilds: MyGuild[];
    onChanged: (billing: BillingStatus) => void;
}) {
    const {t} = useTranslation();
    const [adding, setAdding] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const included = new Set(billing.guilds.map(g => g.guildId));
    const candidates = ownedGuilds.filter(g => !included.has(g.guildId));

    const run = async (action: () => Promise<BillingStatus>, reloadFrom?: () => Promise<BillingStatus>) => {
        setBusy(true);
        setError(null);
        try {
            const result = await action();
            onChanged(reloadFrom ? await reloadFrom() : result);
        } catch (e) {
            setError(describeApiError(e, t("billing.shared.error")));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-xl border border-bd p-4">
            <p className="mb-1 text-sm font-medium text-tx">{t("billing.shared.title")}</p>
            <p className="mb-3 text-xs text-mu">{t("billing.shared.hint")}</p>

            <ul className="mb-3 divide-y divide-bd rounded-lg border border-bd">
                {billing.guilds.map(g => (
                    <li key={g.guildId} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm text-tx">
                            <FiServer size={13} className="flex-shrink-0 text-mu"/>
                            <span className="truncate">{g.name}</span>
                            {g.guildId === guild.guildId && (
                                <span className="text-[11px] text-mu">{t("billing.shared.thisServer")}</span>
                            )}
                        </span>
                        {billing.guilds.length > 1 && (
                            <ActionBtn
                                variant="danger"
                                disabled={busy}
                                // Detaching another server: reload this server's view, which still owns the subscription.
                                onClick={() => run(() => leaveWorkspace(g.guildId),
                                    g.guildId === guild.guildId ? undefined
                                        : () => getGuildBilling(guild.guildId))}
                            >
                                {t("billing.shared.detach")}
                            </ActionBtn>
                        )}
                    </li>
                ))}
            </ul>

            {candidates.length > 0 && (
                <div className="flex gap-2">
                    <select
                        value={adding}
                        onChange={e => setAdding(e.target.value)}
                        className="flex-1 rounded-lg border border-bd bg-sf px-3 py-2 text-sm text-tx outline-none focus:border-pr"
                    >
                        <option value="">{t("billing.shared.choose")}</option>
                        {candidates.map(g => <option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
                    </select>
                    <button
                        disabled={!adding || busy}
                        onClick={() => run(async () => {
                            await joinWorkspace(adding, guild.guildId);
                            setAdding("");
                            return getGuildBilling(guild.guildId);
                        })}
                        className="flex items-center gap-1.5 rounded-lg bg-pr px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-prh disabled:opacity-40"
                    >
                        <FiLink2 size={13}/>
                        {t("billing.shared.add")}
                    </button>
                </div>
            )}
            {error && <p className="mt-2 text-xs text-rdt">{error}</p>}
        </div>
    );
}
