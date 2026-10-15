import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {AnimatePresence} from "framer-motion";
import {useTranslation} from "react-i18next";
import {FiChevronRight, FiCreditCard, FiExternalLink, FiInbox, FiList, FiServer, FiSlash, FiUsers} from "react-icons/fi";
import {getGuildConnectUrl, getMyGuilds, type MyGuild} from "../../api/dashboard";
import {ActionBtn, Badge, EmptyState, TabSkeleton} from "./shared";
import ModeratorsModal from "./ModeratorsModal";
import BansModal from "./BansModal";
import BillingModal from "./BillingModal";

/**
 * The servers the current user owns or moderates — the entry point of the
 * owner panel. Owners manage their moderators from here (task #61).
 */
export default function ServersTab() {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const open = (g: MyGuild, section: "forms" | "submissions" | "audit") =>
        navigate(`/dashboard/servers/${g.guildId}/${section}`);
    const [guilds, setGuilds] = useState<MyGuild[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [moderatorsGuild, setModeratorsGuild] = useState<MyGuild | null>(null);
    const [bansGuild, setBansGuild] = useState<MyGuild | null>(null);
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

    return (
        <div>
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-tx">{t("servers.title")}</h1>
                    <p className="mt-0.5 text-sm text-mu">{t("servers.subtitle")}</p>
                </div>
                <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="flex items-center gap-2 rounded-lg border border-bd bg-sf px-4 py-2 text-sm font-medium text-mu transition-colors hover:border-bd hover:text-tx disabled:opacity-50"
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
                <div className="overflow-hidden rounded-xl border border-bd bg-sf">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-bd text-left text-xs uppercase tracking-wider text-mu">
                            <th className="px-5 py-3 font-medium">{t("servers.columns.server")}</th>
                            <th className="px-5 py-3 font-medium">{t("servers.columns.bot")}</th>
                            <th className="px-5 py-3 font-medium">{t("servers.columns.role")}</th>
                            <th className="px-5 py-3"/>
                        </tr>
                        </thead>
                        <tbody>
                        {guilds.map(g => (
                            <tr key={g.guildId} onClick={() => open(g, "forms")}
                                className="cursor-pointer border-b border-bd transition-colors last:border-0 hover:bg-bg">
                                <td className="px-5 py-3">
                                    <p className="font-medium text-tx">{g.guildName}</p>
                                    <p className="text-xs text-mu">{g.guildId}</p>
                                </td>
                                <td className="px-5 py-3">
                                    <Badge color={g.botStatus === "CONNECTED" ? "green" : "red"} dot>
                                        {g.botStatus === "CONNECTED" ? t("forms.guilds.connected") : t("forms.guilds.kicked")}
                                    </Badge>
                                </td>
                                <td className="px-5 py-3 text-mu">
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
                                        <ActionBtn variant="primary" onClick={() => open(g, "submissions")}>
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
                                            <ActionBtn onClick={() => open(g, "audit")} title={t("guildAudit.open")}>
                                                <FiList size={11} className="inline"/>
                                            </ActionBtn>
                                        )}
                                        <ActionBtn variant="danger" onClick={() => setBansGuild(g)} title={t("bans.title")}>
                                            <FiSlash size={11} className="inline"/>
                                        </ActionBtn>
                                        <ActionBtn onClick={() => open(g, "forms")}>
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
