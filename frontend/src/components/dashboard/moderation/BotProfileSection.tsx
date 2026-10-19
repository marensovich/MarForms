import {useEffect, useId, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiImage, FiRotateCcw} from "react-icons/fi";
import {type BotProfile, getBotProfile, updateBotProfile} from "../../../api/dashboard";
import {describeApiError} from "../../../api/errors";
import {Avatar, Button, ErrorState, Skeleton, useToast} from "../../../ui";

// Not in the mockups (2026-10-19): Discord keeps a nickname, avatar, banner and
// «Обо мне» of the bot per server; its status is one for every server, so it
// lives in the platform's settings.

const MAX_IMAGE = 8 * 1024 * 1024;

/** A picked image: a data URL to send, "" to reset, undefined to keep. */
type ImageChange = string | undefined;

function readImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function ImagePicker({label, current, change, onChange, wide}: {
    label: string;
    current: string | null;
    change: ImageChange;
    onChange: (change: ImageChange) => void;
    wide?: boolean;
}) {
    const {t} = useTranslation();
    const input = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const shown = change === undefined ? current : change || null;

    const pick = async (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) return setError(t("guildSettings.bot.notImage"));
        if (file.size > MAX_IMAGE) return setError(t("guildSettings.bot.tooBig"));
        setError(null);
        onChange(await readImage(file));
    };

    return (
        <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{label}</span>
            <div className="flex flex-wrap items-center gap-3">
                <div className={wide ? "h-16 w-48 overflow-hidden rounded-xl bg-s2" : "h-16 w-16 overflow-hidden rounded-full bg-s2"}>
                    {shown && <img src={shown} alt="" className="h-full w-full object-cover"/>}
                </div>
                <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden"
                       onChange={e => void pick(e.target.files?.[0])}/>
                <Button variant="secondary" size="sm" icon={<FiImage size={14} aria-hidden="true"/>} onClick={() => input.current?.click()}>
                    {t("guildSettings.bot.upload")}
                </Button>
                {(shown || change !== undefined) && (
                    <Button variant="ghost" size="sm" icon={<FiRotateCcw size={14} aria-hidden="true"/>}
                            onClick={() => onChange(change !== undefined && current ? undefined : "")}>
                        {t(change !== undefined && current ? "common.cancel" : "guildSettings.bot.reset")}
                    </Button>
                )}
            </div>
            {error && <span role="alert" className="text-xs text-rdt">{error}</span>}
        </div>
    );
}

/** «Бот»: how the bot looks on this server. */
export default function BotProfileSection({guildId}: { guildId: string }) {
    const {t} = useTranslation();
    const toast = useToast();
    const ids = {nick: useId(), bio: useId()};
    const [profile, setProfile] = useState<BotProfile | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [nickname, setNickname] = useState("");
    const [bio, setBio] = useState("");
    const [avatar, setAvatar] = useState<ImageChange>(undefined);
    const [banner, setBanner] = useState<ImageChange>(undefined);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const accept = (p: BotProfile) => {
        setProfile(p);
        setNickname(p.nickname ?? "");
        setBio(p.bio ?? "");
        setAvatar(undefined);
        setBanner(undefined);
    };

    useEffect(() => {
        let cancelled = false;
        getBotProfile(guildId)
            .then(p => {
                if (cancelled) return;
                accept(p);
                setLoadError(null);
            })
            .catch(e => !cancelled && setLoadError(describeApiError(e, t("guildSettings.bot.loadError"))));
        return () => {
            cancelled = true;
        };
    }, [guildId, reloadKey, t]);

    if (loadError) {
        return <ErrorState title={t("guildSettings.bot.loadError")} text={loadError}
                           onRetry={() => setReloadKey(k => k + 1)} retryLabel={t("ui.retry")}/>;
    }
    if (!profile) return <Skeleton className="h-64 rounded-2xl"/>;

    const nickChanged = nickname.trim() !== (profile.nickname ?? "");
    const bioChanged = bio.trim() !== (profile.bio ?? "");
    const dirty = nickChanged || bioChanged || avatar !== undefined || banner !== undefined;

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            accept(await updateBotProfile(guildId, {
                ...(nickChanged ? {nickname: nickname.trim()} : {}),
                ...(bioChanged ? {bio: bio.trim()} : {}),
                ...(avatar !== undefined ? {avatar} : {}),
                ...(banner !== undefined ? {banner} : {}),
            }));
            toast({tone: "success", text: t("guildSettings.bot.saved")});
        } catch (e) {
            setError(describeApiError(e, t("guildSettings.bot.error")));
        } finally {
            setBusy(false);
        }
    };

    const reset = () => accept(profile);
    const shownName = nickname.trim() || profile.username;

    return (
        <section className="flex flex-col gap-4 rounded-2xl border border-bd bg-sf p-5">
            <div className="flex flex-col gap-1">
                <h2 className="m-0 text-base font-semibold">{t("guildSettings.bot.title")}</h2>
                <p className="m-0 text-[13px] leading-[1.45] text-mu">{t("guildSettings.bot.text")}</p>
            </div>

            <div className="flex items-center gap-3 rounded-[14px] bg-s2 p-3">
                <Avatar name={shownName} src={avatar === undefined ? profile.avatarUrl ?? profile.accountAvatarUrl : avatar || profile.accountAvatarUrl} size={40}/>
                <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{shownName}</span>
                    <span className="truncate text-xs text-mu">{bio.trim() || t("guildSettings.bot.noBio")}</span>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.nick} className="text-sm font-semibold">{t("guildSettings.bot.nickname")}</label>
                <input id={ids.nick} value={nickname} maxLength={32} placeholder={profile.username}
                       onChange={e => setNickname(e.target.value)} disabled={!profile.canChangeNickname}
                       className="h-11 max-w-[360px] rounded-xl border border-bd bg-sf px-3.5 text-sm text-tx outline-none focus:border-pr disabled:opacity-60"/>
                {!profile.canChangeNickname && (
                    <span className="flex items-center gap-1.5 text-xs text-amt">
                        <FiAlertTriangle size={12} aria-hidden="true"/>{t("guildSettings.bot.noNicknamePermission")}
                    </span>
                )}
            </div>

            <ImagePicker label={t("guildSettings.bot.avatar")} current={profile.avatarUrl} change={avatar} onChange={setAvatar}/>
            <ImagePicker label={t("guildSettings.bot.banner")} current={profile.bannerUrl} change={banner} onChange={setBanner} wide/>

            <div className="flex flex-col gap-1.5">
                <label htmlFor={ids.bio} className="text-sm font-semibold">{t("guildSettings.bot.bio")}</label>
                <textarea id={ids.bio} value={bio} maxLength={190} rows={3} onChange={e => setBio(e.target.value)}
                          className="w-full resize-y rounded-xl border border-bd bg-sf px-3.5 py-2.5 text-sm text-tx outline-none focus:border-pr"/>
                <span className="text-right text-xs tabular-nums text-mu">{bio.length}/190</span>
            </div>

            <p className="m-0 text-xs text-mu">{t("guildSettings.bot.statusHint")}</p>

            {error && <p role="alert" className="m-0 rounded-[10px] bg-rdb px-3 py-2 text-[13px] text-rdt">{error}</p>}
            {dirty && (
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={reset}>{t("common.cancel")}</Button>
                    <Button size="sm" loading={busy} onClick={save}>{t("common.save")}</Button>
                </div>
            )}
        </section>
    );
}
