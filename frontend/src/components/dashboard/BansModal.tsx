import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiSlash, FiUserCheck} from "react-icons/fi";
import {banGuildUser, type GuildBan, getGuildBans, type MyGuild, unbanGuildUser} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import {ActionBtn, EmptyState, Modal} from "./shared";

/**
 * A guild's ban list for its owner and moderators (task #69): banned users
 * can't open or submit the guild's forms.
 */
export default function BansModal({guild, onClose}: { guild: MyGuild; onClose: () => void }) {
    const {t} = useTranslation();
    const [bans, setBans] = useState<GuildBan[]>([]);
    const [loading, setLoading] = useState(true);
    const [target, setTarget] = useState("");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getGuildBans(guild.guildId)
            .then(list => {
                if (!cancelled) setBans(list);
            })
            .catch(e => {
                if (!cancelled) setError(describeApiError(e, t("bans.loadError")));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, t]);

    const ban = async () => {
        const value = target.trim();
        if (!value) return;
        setBusy(true);
        setError(null);
        try {
            const who = /^\d{5,20}$/.test(value) ? {discordId: value} : {username: value};
            const added = await banGuildUser(guild.guildId, {...who, reason: reason.trim() || undefined});
            setBans(prev => [added, ...prev.filter(b => b.discordId !== added.discordId)]);
            setTarget("");
            setReason("");
        } catch (e) {
            setError(describeApiError(e, t("bans.addError")));
        } finally {
            setBusy(false);
        }
    };

    const unban = async (discordId: string) => {
        setBusy(true);
        setError(null);
        try {
            await unbanGuildUser(guild.guildId, discordId);
            setBans(prev => prev.filter(b => b.discordId !== discordId));
        } catch (e) {
            setError(describeApiError(e, t("bans.removeError")));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title={t("bans.title")} subtitle={guild.guildName} onClose={onClose} width="max-w-lg">
            <div className="mb-2 flex gap-2">
                <input
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") ban();
                    }}
                    placeholder={t("bans.placeholder")}
                    className="flex-1 rounded-lg border border-bd px-3 py-2 text-sm outline-none focus:border-pr"
                />
                <button
                    onClick={ban}
                    disabled={busy || !target.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-dg px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-dgh disabled:opacity-40"
                >
                    <FiSlash size={14}/>
                    {t("bans.add")}
                </button>
            </div>
            <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={500}
                placeholder={t("bans.reasonPlaceholder")}
                className="mb-2 w-full rounded-lg border border-bd px-3 py-2 text-sm outline-none focus:border-pr"
            />
            <p className="mb-4 text-xs text-mu">{t("bans.hint")}</p>

            {error && (
                <div className="mb-4 rounded-lg border border-rdb bg-rdb px-3 py-2 text-xs text-rdt">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-sm text-mu">{t("common.loading")}</p>
            ) : bans.length === 0 ? (
                <EmptyState message={t("bans.empty")}/>
            ) : (
                <ul className="max-h-[50vh] divide-y divide-bd overflow-y-auto rounded-lg border border-bd">
                    {bans.map(b => (
                        <li key={b.discordId} className="flex items-start justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-tx">
                                    {b.username ?? t("moderation.unknownUser")}
                                    <span className="ml-2 font-mono text-xs font-normal text-mu">{b.discordId}</span>
                                </p>
                                {b.reason && <p className="mt-0.5 break-words text-xs text-mu">{b.reason}</p>}
                                <p className="mt-0.5 text-[11px] text-mu">
                                    {t("bans.meta", {
                                        date: new Date(b.createdAt).toLocaleDateString(),
                                        by: b.bannedByUsername ?? b.bannedBy ?? "—",
                                    })}
                                </p>
                            </div>
                            <ActionBtn variant="success" disabled={busy} onClick={() => unban(b.discordId)}>
                                <FiUserCheck size={11} className="mr-1 inline"/>
                                {t("bans.remove")}
                            </ActionBtn>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
}
