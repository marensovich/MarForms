import {useState} from "react";
import {useTranslation} from "react-i18next";
import {FiInfo, FiPlus, FiX} from "react-icons/fi";
import type {FormDraft} from "./FormWizard";

interface Props {
    draft: FormDraft;
    onChange: (patch: Partial<FormDraft>) => void;
}

const inputCls =
    "w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] px-4 py-3 text-sm text-[#1E1E24] placeholder-[#C7C7CE] outline-none transition-colors focus:border-[#3730A3] focus:bg-white";

function isValidSnowflake(id: string): boolean {
    return /^\d{17,19}$/.test(id.trim());
}

export default function StepServerSettings({draft, onChange}: Props) {
    const {t} = useTranslation();
    const [channelInput, setChannelInput] = useState("");
    const [channelError, setChannelError] = useState<string | null>(null);

    const addChannel = () => {
        const id = channelInput.trim();
        if (!id) return;
        if (!isValidSnowflake(id)) {
            setChannelError(t("wizard.server.channelIdsError"));
            return;
        }
        if (draft.channelsIds.includes(id)) {
            setChannelError(t("wizard.server.channelIdsDuplicate"));
            return;
        }
        onChange({channelsIds: [...draft.channelsIds, id]});
        setChannelInput("");
        setChannelError(null);
    };

    const removeChannel = (id: string) =>
        onChange({channelsIds: draft.channelsIds.filter(c => c !== id)});

    const handleChannelKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addChannel();
        }
    };

    const serverIdValid = draft.serverId.trim() === "" || isValidSnowflake(draft.serverId);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <p className="text-xs text-[#8B8B96]">
                    {t("wizard.server.hint")}
                </p>
            </div>

            {/* Server ID */}
            <div>
                <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[#1E1E24]">
                    {t("wizard.server.serverIdLabel")} <span className="text-[#B56A65]">*</span>
                </label>
                <input
                    type="text"
                    value={draft.serverId}
                    onChange={e => onChange({serverId: e.target.value.trim()})}
                    placeholder={t("wizard.server.serverIdPlaceholder")}
                    className={`${inputCls} font-mono ${
                        draft.serverId && !serverIdValid ? "border-[#EAD4D3] focus:border-[#B56A65]" : ""
                    }`}
                />
                {draft.serverId && !serverIdValid && (
                    <p className="mt-1.5 text-[11px] text-[#B56A65]">
                        {t("wizard.server.serverIdError")}
                    </p>
                )}
                <Tip>{t("wizard.server.serverIdTip")}</Tip>
            </div>

            {/* Channel IDs */}
            <div>
                <label className="mb-2 block text-sm font-medium text-[#1E1E24]">
                    {t("wizard.server.channelIdsLabel")}
                    <span className="ml-2 text-xs font-normal text-[#8B8B96]">{t("wizard.server.channelIdsOptional")}</span>
                </label>

                {/* Tag list */}
                {draft.channelsIds.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                        {draft.channelsIds.map(id => (
                            <span
                                key={id}
                                className="flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFB] px-2.5 py-1 text-xs font-mono text-[#55555F]"
                            >
                                {id}
                                <button
                                    onClick={() => removeChannel(id)}
                                    className="text-[#8B8B96] transition-colors hover:text-[#B56A65]"
                                >
                                    <FiX size={10}/>
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Input + Add button */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={channelInput}
                        onChange={e => {
                            setChannelInput(e.target.value);
                            setChannelError(null);
                        }}
                        onKeyDown={handleChannelKeyDown}
                        placeholder={t("wizard.server.channelIdsPlaceholder")}
                        className={`${inputCls} flex-1 font-mono`}
                    />
                    <button
                        onClick={addChannel}
                        disabled={!channelInput.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-[#F0F0F2] px-3 py-2 text-sm text-[#6B6B76] transition-colors hover:bg-[#E4E4E7] hover:text-[#1E1E24] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <FiPlus size={13}/>
                        {t("wizard.server.channelIdsAdd")}
                    </button>
                </div>

                {channelError && (
                    <p className="mt-1.5 text-[11px] text-[#B56A65]">{channelError}</p>
                )}

                <Tip>
                    {draft.channelsIds.length === 0
                        ? t("wizard.server.channelIdsTipEmpty")
                        : t("wizard.server.channelIdsTipFilled", {count: draft.channelsIds.length})}
                    {t("wizard.server.channelIdsTipSuffix")}
                </Tip>
            </div>

            {/* Summary card */}
            {draft.serverId.trim() && serverIdValid && (
                <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFB] p-4">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B8B96]">{t("wizard.server.summaryTitle")}</p>
                    <div className="space-y-1.5 text-xs text-[#6B6B76]">
                        <p>
                            <span className="text-[#8B8B96]">{t("wizard.server.summaryServer")} </span>
                            <span className="font-mono text-[#55555F]">{draft.serverId}</span>
                        </p>
                        <p>
                            <span className="text-[#8B8B96]">{t("wizard.server.summaryChannels")} </span>
                            {draft.channelsIds.length > 0
                                ? <span className="text-[#55555F]">{t("wizard.server.summaryRestricted", {count: draft.channelsIds.length})}</span>
                                : <span className="text-[#8B8B96]">{t("wizard.server.summaryAllChannels")}</span>
                            }
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function Tip({children}: { children: React.ReactNode }) {
    return (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-[#8B8B96] leading-relaxed">
            <FiInfo size={11} className="mt-0.5 flex-shrink-0"/>
            <p>{children}</p>
        </div>
    );
}
