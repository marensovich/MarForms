import {useId, useState} from "react";
import {useTranslation} from "react-i18next";
import type {MyGuild} from "../../api/dashboard";
import {cx, ServerIcon} from "../../ui";
import type {EditorState} from "./useFormEditor";
import {useSlugCheck} from "./useSlugCheck";

// Docs: docs/design/mockups/Wizard1.dc.html; ТЗ 5.2.

const DESCRIPTION_MAX = 1000;

/**
 * «Основное»: the title, the link's address (with its availability), the
 * description, the review time; beside them, the form as participants will
 * see its head.
 */
export default function BasicTab({state, update, guild, formId, savedSlug, published, titleError}: {
    state: Pick<EditorState, "title" | "description" | "reviewTime" | "slug">;
    update: (patch: Partial<EditorState>) => void;
    guild: MyGuild | null;
    formId: string | null;
    savedSlug: string;
    published: boolean;
    titleError?: boolean;
}) {
    const {t} = useTranslation();
    const ids = {title: useId(), slug: useId(), description: useId(), review: useId()};
    const [editingSlug, setEditingSlug] = useState(false);
    const slugProblem = useSlugCheck(state.slug, formId, savedSlug);
    const host = window.location.host;

    return (
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-start gap-8 px-4 py-8 md:px-7 md:py-10">
            <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-[22px]">
                <div className="flex flex-col gap-1.5">
                    <h1 className="m-0 text-[26px] font-bold">{t("builder.basic.title")}</h1>
                    <p className="m-0 text-[15px] text-mu">{t("builder.basic.text")}</p>
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor={ids.title} className="text-sm font-semibold">
                        {t("builder.basic.name")} <span className="text-rdt">*</span>
                    </label>
                    <input id={ids.title} value={state.title} maxLength={200} onChange={e => update({title: e.target.value})}
                           aria-invalid={titleError || undefined}
                           className={cx("h-12 rounded-xl border-[1.5px] bg-sf px-3.5 text-base text-tx outline-none focus:border-pr focus:outline focus:outline-[3px] focus:outline-prs",
                               titleError ? "border-rdt" : "border-bd")}/>
                    {titleError && <span role="alert" className="text-xs text-rdt">{t("builder.basic.nameRequired")}</span>}
                    {editingSlug ? (
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={ids.slug} className="text-xs text-mu">{t("builder.basic.address")}</label>
                            <span className="flex items-center gap-1 font-mono text-sm">
                                <span className="text-mu">{host}/f/</span>
                                <input id={ids.slug} value={state.slug} autoFocus
                                       onChange={e => update({slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")})}
                                       aria-invalid={slugProblem ? true : undefined}
                                       className={cx("h-9 min-w-0 flex-1 rounded-lg border bg-sf px-2 font-mono text-sm text-tx outline-none focus:border-pr",
                                           slugProblem ? "border-rdt" : "border-bd")}/>
                            </span>
                            {slugProblem && <span role="alert" className="text-xs text-rdt">{t(`builder.basic.slug.${slugProblem}`)}</span>}
                            {published && state.slug !== savedSlug && !slugProblem && (
                                <span className="text-xs text-amt">{t("builder.basic.slugWarning")}</span>
                            )}
                        </div>
                    ) : (
                        <span className="text-xs text-mu">
                            {t("builder.basic.link")}{" "}
                            <span className="font-mono text-tx">{state.slug ? `${host}/f/${state.slug}` : t("builder.basic.linkLater")}</span>
                            {" · "}
                            <button type="button" onClick={() => setEditingSlug(true)} className="font-semibold text-prt hover:underline">
                                {t("builder.basic.changeLink")}
                            </button>
                        </span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor={ids.description} className="text-sm font-semibold">{t("builder.basic.description")}</label>
                    <textarea id={ids.description} rows={6} maxLength={DESCRIPTION_MAX} value={state.description}
                              onChange={e => update({description: e.target.value})}
                              className="resize-y rounded-xl border border-bd bg-sf px-3.5 py-3 text-[15px] leading-[1.55] text-tx outline-none focus:border-pr"/>
                    <div className="flex justify-between text-xs text-mu">
                        <span>{t("builder.basic.markdown")}</span>
                        <span className="font-mono">{state.description.length} / {DESCRIPTION_MAX}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor={ids.review} className="text-sm font-semibold">{t("builder.basic.reviewTime")}</label>
                    <input id={ids.review} value={state.reviewTime} maxLength={60} placeholder={t("builder.basic.reviewTimePlaceholder")}
                           onChange={e => update({reviewTime: e.target.value})}
                           className="h-11 max-w-[360px] rounded-xl border border-bd bg-sf px-3.5 text-sm text-tx outline-none focus:border-pr"/>
                    <span className="text-xs text-mu">{t("builder.basic.reviewTimeHint")}</span>
                </div>

                {guild && (
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-semibold">{t("builder.basic.server")}</span>
                        <span className="flex items-center gap-2.5 text-sm">
                            <ServerIcon name={guild.guildName} src={guild.guildIconUrl} size={28}/>{guild.guildName}
                        </span>
                    </div>
                )}
            </section>

            <aside className="flex flex-[1_1_320px] flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-mu">{t("builder.basic.asSeen")}</span>
                <div className="flex flex-col gap-2.5 rounded-2xl border border-bd bg-sf p-[18px]">
                    {guild && (
                        <div className="flex items-center gap-2">
                            <ServerIcon name={guild.guildName} src={guild.guildIconUrl} size={28}/>
                            <span className="text-[13px] font-semibold">{guild.guildName}</span>
                        </div>
                    )}
                    <span className="break-words text-xl font-bold">{state.title || t("builder.basic.untitled")}</span>
                    {state.description && (
                        <span className="line-clamp-4 whitespace-pre-wrap break-words text-sm leading-normal text-mu">{state.description}</span>
                    )}
                </div>
            </aside>
        </div>
    );
}
