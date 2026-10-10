import {useEffect, useState} from "react";
import {AnimatePresence} from "framer-motion";
import {useTranslation} from "react-i18next";
import {FiChevronRight, FiCreditCard, FiExternalLink, FiInbox, FiList, FiServer, FiSlash, FiUsers} from "react-icons/fi";
import {getGuildConnectUrl, getMyGuilds, type MyGuild} from "../../api/dashboard";
import {ActionBtn, Badge, EmptyState, TabSkeleton} from "./shared";
import ModeratorsModal from "./ModeratorsModal";
import BansModal from "./BansModal";
import BillingModal from "./BillingModal";
import GuildFormsPanel from "./GuildFormsPanel";
import GuildModerationPanel from "./moderation/GuildModerationPanel";
import GuildAuditPanel from "./moderation/GuildAuditPanel";

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
    const [openGuild, setOpenGuild] = useState<MyGuild | null>(null);
    const [moderationGuild, setModerationGuild] = useState<MyGuild | null>(null);
    const [bansGuild, setBansGuild] = useState<MyGuild | null>(null);
    const [auditGuild, setAuditGuild] = useState<MyGuild | null>(null);
    const [billingGuild, setBillingGuild] = useState<MyGuild | null>(null);
    const [checkoutResult, setCheckoutResult] = useState<"success" | "cancel" | null>(null);

    useEffect(() => {
        let cancelled = false;
        getMyGuilds()
            .then(list => {
                if (cancelled) return;
                const staffGuilds = list.filter(g => g.role !== "RESPONDENT");
                setGuilds(staffGuilds);
                // Back from Stripe Checkout: reopen that server's billing with the outcome.
                const params = new URLSearchParams(window.location.search);
                const returning = staffGuilds.find(g => g.guildId === params.get("billing") && g.role === "OWNER");
                if (returning) {
                    const result = params.get("checkout");
                    setCheckoutResult(result === "success" || result === "cancel" ? result : null);
                    setBillingGuild(returning);
                    window.history.replaceState(null, "", window.location.pathname);
                }
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

    if (auditGuild) {
        return <GuildAuditPanel guild={auditGuild} onBack={() => setAuditGuild(null)}/>;
    }

    if (moderationGuild) {
        return <GuildModerationPanel guild={moderationGuild} onBack={() => setModerationGuild(null)}/>;
    }

    if (openGuild) {
        return <GuildFormsPanel guild={openGuild} onBack={() => setOpenGuild(null)}/>;
    }

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
                            <tr key={g.guildId} onClick={() => setOpenGuild(g)}
                                className="cursor-pointer border-b border-[#F0F0F2] transition-colors last:border-0 hover:bg-[#FAFAFB]">
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
                                <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                        {g.role === "OWNER" && (
                                            <ActionBtn variant="primary" onClick={() => setModeratorsGuild(g)}>
                                                <FiUsers size={11} className="mr-1 inline"/>
                                                {t("moderators.manage")}
                                            </ActionBtn>
                                        )}
                                        <ActionBtn variant="primary" onClick={() => setModerationGuild(g)}>
                                            <FiInbox size={11} className="mr-1 inline"/>
                                            {t("moderation.open")}
                                        </ActionBtn>
                                        {g.role === "OWNER" && (
                                            <ActionBtn onClick={() => {
                                                setCheckoutResult(null);
                                                setBillingGuild(g);
                                            }} title={t("billing.title")}>
                                                <FiCreditCard size={11} className="inline"/>
                                            </ActionBtn>
                                        )}
                                        {g.role === "OWNER" && (
                                            <ActionBtn onClick={() => setAuditGuild(g)} title={t("guildAudit.open")}>
                                                <FiList size={11} className="inline"/>
                                            </ActionBtn>
                                        )}
                                        <ActionBtn variant="danger" onClick={() => setBansGuild(g)} title={t("bans.title")}>
                                            <FiSlash size={11} className="inline"/>
                                        </ActionBtn>
                                        <ActionBtn onClick={() => setOpenGuild(g)}>
                                            {t("servers.openForms")}
                                            <FiChevronRight size={11} className="ml-1 inline"/>
                                        </ActionBtn>
                                    </div>
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
                {bansGuild && <BansModal guild={bansGuild} onClose={() => setBansGuild(null)}/>}
                {billingGuild && (
                    <BillingModal guild={billingGuild} checkoutResult={checkoutResult}
                                  ownedGuilds={guilds.filter(g => g.role === "OWNER")}
                                  onClose={() => setBillingGuild(null)}/>
                )}
            </AnimatePresence>
        </div>
    );
}
