import {useEffect, useState} from "react";
import {AnimatePresence} from "framer-motion";
import {useTranslation} from "react-i18next";
import {FiExternalLink, FiServer, FiUsers} from "react-icons/fi";
import {getGuildConnectUrl, getMyGuilds, type MyGuild} from "../../api/dashboard";
import {ActionBtn, Badge, EmptyState, TabSkeleton} from "./shared";
import ModeratorsModal from "./ModeratorsModal";

/**
 * The servers the current user owns or moderates — the entry point of the
 * owner panel. Owners manage their moderators from here (task #61).
 */
export default function ServersTab() {
    const {t} = useTranslation();
    const [guilds, setGuilds] = useState<MyGuild[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [moderatorsGuild, setModeratorsGuild] = useState<MyGuild | null>(null);

    useEffect(() => {
        let cancelled = false;
        getMyGuilds()
            .then(list => {
                if (!cancelled) setGuilds(list.filter(g => g.role !== "RESPONDENT"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const {url} = await getGuildConnectUrl();
            window.location.href = url;
        } finally {
            setConnecting(false);
        }
    };

    return (
        <div>
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-[#1E1E24]">{t("servers.title")}</h1>
                    <p className="mt-0.5 text-sm text-[#6B6B76]">{t("servers.subtitle")}</p>
                </div>
                <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="flex items-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-4 py-2 text-sm font-medium text-[#55555F] transition-colors hover:border-[#D4D4D9] hover:text-[#1E1E24] disabled:opacity-50"
                >
                    <FiExternalLink size={14}/>
                    {t("forms.connectServer")}
                </button>
            </div>

            {loading ? (
                <TabSkeleton rows={3}/>
            ) : guilds.length === 0 ? (
                <EmptyState message={t("servers.empty")} icon={<FiServer/>}/>
            ) : (
                <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-[#E4E4E7] text-left text-xs uppercase tracking-wider text-[#8B8B96]">
                            <th className="px-5 py-3 font-medium">{t("servers.columns.server")}</th>
                            <th className="px-5 py-3 font-medium">{t("servers.columns.bot")}</th>
                            <th className="px-5 py-3 font-medium">{t("servers.columns.role")}</th>
                            <th className="px-5 py-3"/>
                        </tr>
                        </thead>
                        <tbody>
                        {guilds.map(g => (
                            <tr key={g.guildId} className="border-b border-[#F0F0F2] last:border-0">
                                <td className="px-5 py-3">
                                    <p className="font-medium text-[#1E1E24]">{g.guildName}</p>
                                    <p className="text-xs text-[#8B8B96]">{g.guildId}</p>
                                </td>
                                <td className="px-5 py-3">
                                    <Badge color={g.botStatus === "CONNECTED" ? "green" : "red"} dot>
                                        {g.botStatus === "CONNECTED" ? t("forms.guilds.connected") : t("forms.guilds.kicked")}
                                    </Badge>
                                </td>
                                <td className="px-5 py-3 text-[#55555F]">
                                    {t(`forms.guilds.role.${g.role.toLowerCase()}`)}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    {g.role === "OWNER" && (
                                        <ActionBtn variant="primary" onClick={() => setModeratorsGuild(g)}>
                                            <FiUsers size={11} className="mr-1 inline"/>
                                            {t("moderators.manage")}
                                        </ActionBtn>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AnimatePresence>
                {moderatorsGuild && (
                    <ModeratorsModal guild={moderatorsGuild} onClose={() => setModeratorsGuild(null)}/>
                )}
            </AnimatePresence>
        </div>
    );
}
