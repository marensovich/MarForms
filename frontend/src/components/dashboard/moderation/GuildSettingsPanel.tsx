import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiHash, FiPlus} from "react-icons/fi";
import {
    createGuildLogChannels,
    type DiscordRole,
    getGuildConnectUrl,
    getGuildRoles,
    getGuildSettings,
    type GuildSettings,
    type MyGuild,
    setGuildAdminRoles,
} from "../../../api/dashboard";
import {describeApiError} from "../../../api/errors";
import {Button, Combobox, discordColor, ErrorState, Modal, RoleChip, Skeleton, useToast} from "../../../ui";

// Not in the mockups: the owner's answer of 2026-10-19 — admin roles own the
// server in MarForms (not the platform), and the bot keeps the server's logs
// in a MarForms category of its own. Built from the RoleGate picker (AccessTab).

/** Admin roles and log channels of one server; the body of the tab and of the setup dialog. */
function GuildSettingsForm({guildId}: { guildId: string }) {
    const {t} = useTranslation();
    const toast = useToast();
    const [settings, setSettings] = useState<GuildSettings | null>(null);
    const [roles, setRoles] = useState<DiscordRole[] | null>(null);
    const [picked, setPicked] = useState<string[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState<"roles" | "channels" | "grant" | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getGuildSettings(guildId), getGuildRoles(guildId).catch(() => [] as DiscordRole[])])
            .then(([s, r]) => {
                if (cancelled) return;
                setSettings(s);
                setRoles(r);
                setPicked(s.adminRoles.map(a => a.id));
                setLoadError(null);
            })
            .catch(e => !cancelled && setLoadError(describeApiError(e, t("guildSettings.loadError"))));
        return () => {
            cancelled = true;
        };
    }, [guildId, reloadKey, t]);

    if (loadError) {
        return <ErrorState title={t("guildSettings.loadError")} text={loadError}
                           onRetry={() => setReloadKey(k => k + 1)} retryLabel={t("ui.retry")}/>;
    }
    if (!settings || !roles || !picked) {
        return (
            <div className="flex flex-col gap-3" aria-busy="true">
                {[0, 1].map(i => <Skeleton key={i} className="h-36 rounded-2xl"/>)}
            </div>
        );
    }

    const saved = settings.adminRoles.map(a => a.id);
    const dirty = saved.length !== picked.length || picked.some(id => !saved.includes(id));
    const roleOf = (id: string) => {
        const live = roles.find(r => r.id === id);
        const kept = settings.adminRoles.find(a => a.id === id);
        return {
            name: live?.name ?? kept?.name ?? id,
            color: discordColor(live?.color ?? kept?.color),
            missing: !live && (kept?.missing ?? roles.length > 0),
        };
    };

    const saveRoles = async () => {
        setBusy("roles");
        setError(null);
        try {
            const next = await setGuildAdminRoles(guildId, picked);
            setSettings(next);
            setPicked(next.adminRoles.map(a => a.id));
            toast(next.channelAccessUpdated === false
                ? {tone: "error", text: t("guildSettings.accessNotUpdated")}
                : {tone: "success", text: t("guildSettings.rolesSaved")});
        } catch (e) {
            setError(describeApiError(e, t("guildSettings.rolesError")));
        } finally {
            setBusy(null);
        }
    };

    const createChannels = async () => {
        setBusy("channels");
        setError(null);
        try {
            setSettings(await createGuildLogChannels(guildId));
            toast({tone: "success", text: t("guildSettings.channelsCreated")});
        } catch (e) {
            setError(describeApiError(e, t("guildSettings.channelsError")));
        } finally {
            setBusy(null);
        }
    };

    const grant = async () => {
        setBusy("grant");
        try {
            window.location.href = (await getGuildConnectUrl(guildId)).url;
        } catch (e) {
            setError(describeApiError(e, t("forms.connectError")));
            setBusy(null);
        }
    };

    const channels = [
        {key: "responses", channel: settings.responsesChannel},
        {key: "audit", channel: settings.auditChannel},
    ] as const;
    const complete = channels.every(c => c.channel?.name);
    const anyCreated = channels.some(c => c.channel);

    return (
        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-3 rounded-2xl border border-bd bg-sf p-5">
                <div className="flex flex-col gap-1">
                    <h2 className="m-0 text-base font-semibold">{t("guildSettings.rolesTitle")}</h2>
                    <p className="m-0 text-[13px] leading-[1.45] text-mu">{t("guildSettings.rolesText")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {picked.length === 0 && <span className="text-[13px] text-mu">{t("guildSettings.rolesEmpty")}</span>}
                    {picked.map(id => {
                        const role = roleOf(id);
                        return (
                            <RoleChip key={id} name={role.missing ? `${role.name} · ${t("guildSettings.roleMissing")}` : role.name}
                                      color={role.color} removeLabel={t("builder.access.removeRole", {name: role.name})}
                                      onRemove={() => setPicked(p => (p ?? []).filter(r => r !== id))}/>
                        );
                    })}
                    {!adding && (
                        <button type="button" onClick={() => setAdding(true)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-bd px-2.5 py-1 text-[13px] text-prt hover:border-pr">
                            <FiPlus size={13} aria-hidden="true"/>{t("guildSettings.rolesPick")}
                        </button>
                    )}
                </div>
                {adding && (
                    <Combobox autoFocus ariaLabel={t("guildSettings.rolesPick")} placeholder={t("guildSettings.rolesSearch")}
                              emptyText={roles.length ? t("builder.access.noRoles") : t("guildSettings.rolesNone")}
                              options={roles.filter(r => !picked.includes(r.id))
                                  .map(r => ({value: r.id, label: r.name, dot: discordColor(r.color)}))}
                              onSelect={id => {
                                  setPicked(p => [...(p ?? []), id]);
                                  setAdding(false);
                              }}/>
                )}
                {dirty && (
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setPicked(saved)}>{t("common.cancel")}</Button>
                        <Button size="sm" loading={busy === "roles"} onClick={saveRoles}>{t("common.save")}</Button>
                    </div>
                )}
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-bd bg-sf p-5">
                <div className="flex flex-col gap-1">
                    <h2 className="m-0 text-base font-semibold">{t("guildSettings.channelsTitle")}</h2>
                    <p className="m-0 text-[13px] leading-[1.45] text-mu">{t("guildSettings.channelsText")}</p>
                </div>
                {anyCreated && (
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                        {channels.map(({key, channel}) => (
                            <li key={key} className="flex items-center gap-2 rounded-[10px] bg-s2 px-3 py-2 text-sm">
                                <FiHash size={14} aria-hidden="true" className="text-mu"/>
                                <span className="font-medium">{channel?.name ?? t(`guildSettings.${key}`)}</span>
                                {!channel?.name && <span className="text-xs text-rdt">{t("guildSettings.channelsGone")}</span>}
                            </li>
                        ))}
                    </ul>
                )}
                {!settings.canCreateChannels ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-amb px-3 py-2 text-[13px] text-amt">
                        <FiAlertTriangle size={14} aria-hidden="true"/>
                        <span className="flex-1">{t("guildSettings.channelsNoPermission")}</span>
                        <button type="button" onClick={grant} disabled={busy === "grant"} className="font-semibold underline">
                            {t("guildSettings.grant")}
                        </button>
                    </div>
                ) : !complete && (
                    <div className="flex justify-end">
                        <Button size="sm" loading={busy === "channels"} onClick={createChannels}>
                            {t(anyCreated ? "guildSettings.channelsRecreate" : "guildSettings.channelsCreate")}
                        </Button>
                    </div>
                )}
            </section>

            {error && <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>}
        </div>
    );
}

/** «Настройки» of a server's workspace: the owner's only. */
export default function GuildSettingsPanel({guild}: { guild: MyGuild }) {
    const {t} = useTranslation();
    return (
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 py-6">
            <div className="flex flex-col gap-1">
                <h2 className="m-0 text-xl font-bold">{t("guildSettings.title")}</h2>
                <p className="m-0 text-[14px] text-mu">{t("guildSettings.text")}</p>
            </div>
            <GuildSettingsForm guildId={guild.guildId}/>
        </div>
    );
}

/** Right after the bot was added: the same settings, or «Позже». */
export function GuildSetupDialog({guildId, onClose}: { guildId: string; onClose: () => void }) {
    const {t} = useTranslation();
    return (
        <Modal open onClose={onClose} width={600} title={t("guildSetup.title")} description={t("guildSetup.text")}
               footer={<Button onClick={onClose}>{t("guildSetup.done")}</Button>}>
            <GuildSettingsForm guildId={guildId}/>
        </Modal>
    );
}
