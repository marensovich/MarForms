import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiTrash2, FiUserPlus} from "react-icons/fi";
import {
    addGuildModerator,
    getGuildModerators,
    type GuildModerator,
    type MyGuild,
    removeGuildModerator,
} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import {ActionBtn, EmptyState, Modal} from "./shared";

/**
 * Owner-only screen for a guild's moderators (task #61): list, add by
 * Discord ID or username, remove.
 */
export default function ModeratorsModal({guild, onClose}: { guild: MyGuild; onClose: () => void }) {
    const {t} = useTranslation();
    const [moderators, setModerators] = useState<GuildModerator[]>([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getGuildModerators(guild.guildId)
            .then(list => {
                if (!cancelled) setModerators(list);
            })
            .catch(e => {
                if (!cancelled) setError(describeApiError(e, t("moderators.loadError")));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, t]);

    const add = async () => {
        const value = input.trim();
        if (!value) return;
        setBusy(true);
        setError(null);
        try {
            const target = /^\d{5,20}$/.test(value) ? {discordId: value} : {username: value};
            const added = await addGuildModerator(guild.guildId, target);
            setModerators(prev => prev.some(m => m.discordId === added.discordId) ? prev : [...prev, added]);
            setInput("");
        } catch (e) {
            setError(describeApiError(e, t("moderators.addError")));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (discordId: string) => {
        setBusy(true);
        setError(null);
        try {
            await removeGuildModerator(guild.guildId, discordId);
            setModerators(prev => prev.filter(m => m.discordId !== discordId));
        } catch (e) {
            setError(describeApiError(e, t("moderators.removeError")));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title={t("moderators.title")} subtitle={guild.guildName} onClose={onClose}>
            <div className="mb-4 flex gap-2">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") add();
                    }}
                    placeholder={t("moderators.placeholder")}
                    className="flex-1 rounded-lg border border-[#E4E4E7] px-3 py-2 text-sm outline-none focus:border-[#3730A3]"
                />
                <button
                    onClick={add}
                    disabled={busy || !input.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-[#3730A3] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2D2682] disabled:opacity-40"
                >
                    <FiUserPlus size={14}/>
                    {t("moderators.add")}
                </button>
            </div>
            <p className="mb-4 text-xs text-[#8B8B96]">{t("moderators.hint")}</p>

            {error && (
                <div className="mb-4 rounded-lg border border-[#EAD4D3] bg-[#F7EEEE] px-3 py-2 text-xs text-[#8B4A46]">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-sm text-[#8B8B96]">{t("common.loading")}</p>
            ) : moderators.length === 0 ? (
                <EmptyState message={t("moderators.empty")}/>
            ) : (
                <ul className="divide-y divide-[#E4E4E7] rounded-lg border border-[#E4E4E7]">
                    {moderators.map(m => (
                        <li key={m.discordId} className="flex items-center justify-between px-3 py-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[#1E1E24]">{m.username}</p>
                                <p className="text-xs text-[#8B8B96]">{m.discordId}</p>
                            </div>
                            <ActionBtn variant="danger" disabled={busy} onClick={() => remove(m.discordId)}
                                       title={t("moderators.remove")}>
                                <FiTrash2 size={13}/>
                            </ActionBtn>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
}
