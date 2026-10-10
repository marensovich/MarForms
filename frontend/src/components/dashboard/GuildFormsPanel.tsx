import {useCallback, useEffect, useState} from "react";
import {AnimatePresence} from "framer-motion";
import {useTranslation} from "react-i18next";
import {FiAlertTriangle, FiArchive, FiArrowLeft, FiCheck, FiDownload, FiEdit3, FiFileText, FiLink, FiSend, FiSlash, FiTrash2} from "react-icons/fi";
import {
    type DashboardForm,
    deleteGuildForm,
    exportFormCsv,
    getGuildForms,
    type MyGuild,
    publishGuildForm,
    setGuildFormStatus,
} from "../../api/dashboard";
import {describeApiError} from "../../api/errors";
import type {FormStatus} from "../../types/forms";
import {ActionBtn, Badge, ConfirmModal, EmptyState, TabSkeleton} from "./shared";
import FormWizard from "./forms/FormWizard";
import FormEditModal from "./forms/FormEditModal";

const STATUS_COLOR: Record<FormStatus, "default" | "green" | "orange" | "red"> = {
    DRAFT: "default",
    PUBLISHED: "green",
    CLOSED: "orange",
    ARCHIVED: "red",
};

function CopyLink({slug}: { slug: string }) {
    const {t} = useTranslation();
    const [copied, setCopied] = useState(false);
    return (
        <ActionBtn
            onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                });
            }}
            title={t("guildForms.copyLink")}
        >
            {copied ? <FiCheck size={11} className="inline"/> : <FiLink size={11} className="inline"/>}
        </ActionBtn>
    );
}

/**
 * A guild's forms in the owner panel (task #43): list with statuses,
 * create, edit, publish/close/archive and delete. Moderators get a
 * read-only view.
 */
export default function GuildFormsPanel({guild, onBack}: { guild: MyGuild; onBack: () => void }) {
    const {t} = useTranslation();
    const isOwner = guild.role === "OWNER";
    const [forms, setForms] = useState<DashboardForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [showWizard, setShowWizard] = useState(false);
    const [editForm, setEditForm] = useState<DashboardForm | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DashboardForm | null>(null);

    const load = useCallback(async () => {
        try {
            const page = await getGuildForms(guild.guildId, includeArchived);
            setForms(page.content);
            setError(null);
        } catch (e) {
            setError(describeApiError(e, t("guildForms.loadError")));
        } finally {
            setLoading(false);
        }
    }, [guild.guildId, includeArchived, t]);

    useEffect(() => {
        let cancelled = false;
        getGuildForms(guild.guildId, includeArchived)
            .then(page => {
                if (!cancelled) {
                    setForms(page.content);
                    setError(null);
                }
            })
            .catch(e => {
                if (!cancelled) setError(describeApiError(e, t("guildForms.loadError")));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [guild.guildId, includeArchived, t]);

    const brokenNotifications = forms.filter(f => f.status !== "ARCHIVED"
        && f.notificationHealth && f.notificationHealth !== "HEALTHY").length;

    const run = async (form: DashboardForm, action: () => Promise<unknown>) => {
        setBusyId(form.id);
        setError(null);
        try {
            await action();
            await load();
        } catch (e) {
            setError(describeApiError(e, t("guildForms.actionError")));
        } finally {
            setBusyId(null);
        }
    };

    const publish = (f: DashboardForm) => run(f, () => publishGuildForm(guild.guildId, f.id));
    const setStatus = (f: DashboardForm, status: FormStatus) =>
        run(f, () => setGuildFormStatus(guild.guildId, f.id, status));

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const target = deleteTarget;
        setDeleteTarget(null);
        await run(target, () => deleteGuildForm(guild.guildId, target.id));
    };

    return (
        <div>
            <button onClick={onBack}
                    className="mb-4 flex items-center gap-1.5 text-sm text-[#6B6B76] transition-colors hover:text-[#1E1E24]">
                <FiArrowLeft size={14}/>
                {t("servers.title")}
            </button>

            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-[#1E1E24]">{guild.guildName}</h1>
                    <p className="mt-0.5 text-sm text-[#6B6B76]">{t("guildForms.subtitle", {count: forms.length})}</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[#6B6B76]">
                        <input type="checkbox" checked={includeArchived}
                               onChange={e => {
                                   setLoading(true);
                                   setIncludeArchived(e.target.checked);
                               }}
                               className="accent-[#3730A3]"/>
                        {t("guildForms.showArchived")}
                    </label>
                    {isOwner && (
                        <button
                            onClick={() => setShowWizard(true)}
                            className="flex items-center gap-2 rounded-lg bg-[#3730A3] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2D2682]"
                        >
                            <FiFileText size={14}/>
                            {t("forms.newForm")}
                        </button>
                    )}
                </div>
            </div>

            {brokenNotifications > 0 && (
                <div className="mb-4 flex gap-2 rounded-lg border border-[#EFDFC0] bg-[#FBF3E4] px-3 py-2.5 text-xs text-[#92702A]">
                    <FiAlertTriangle size={14} className="mt-0.5 flex-shrink-0"/>
                    <div>
                        <p className="font-medium">{t("webhookHealth.panelAlert.title", {count: brokenNotifications})}</p>
                        <p className="mt-0.5">{t("webhookHealth.panelAlert.body")}</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-lg border border-[#EAD4D3] bg-[#F7EEEE] px-3 py-2 text-xs text-[#8B4A46]">
                    {error}
                </div>
            )}

            {loading ? (
                <TabSkeleton rows={4}/>
            ) : forms.length === 0 ? (
                <EmptyState message={isOwner ? t("guildForms.emptyOwner") : t("guildForms.empty")} icon={<FiFileText/>}/>
            ) : (
                <div className="overflow-hidden rounded-xl border border-[#E4E4E7] bg-white">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-[#E4E4E7] text-left text-xs uppercase tracking-wider text-[#8B8B96]">
                            <th className="px-5 py-3 font-medium">{t("guildForms.columns.title")}</th>
                            <th className="px-5 py-3 font-medium">{t("guildForms.columns.status")}</th>
                            <th className="px-5 py-3 font-medium">{t("guildForms.columns.access")}</th>
                            <th className="px-5 py-3 font-medium text-right">{t("guildForms.columns.responses")}</th>
                            <th className="px-5 py-3"/>
                        </tr>
                        </thead>
                        <tbody>
                        {forms.map(f => {
                            const status = f.status ?? (f.active ? "PUBLISHED" : "CLOSED");
                            const busy = busyId === f.id;
                            return (
                                <tr key={f.id} className="border-b border-[#F0F0F2] last:border-0">
                                    <td className="px-5 py-3">
                                        <p className="flex items-center gap-1.5 font-medium text-[#1E1E24]">
                                            {f.title}
                                            {f.notificationHealth && f.notificationHealth !== "HEALTHY" && (
                                                <span title={t(`webhookHealth.${f.notificationHealth}`)}
                                                      className={f.notificationHealth === "INVALID" ? "text-[#B56A65]" : "text-[#C99A3E]"}>
                                                    <FiAlertTriangle size={13}/>
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-[#8B8B96]">
                                            {t("guildForms.fieldCount", {count: f.fieldCount ?? 0})}
                                        </p>
                                    </td>
                                    <td className="px-5 py-3">
                                        <Badge color={STATUS_COLOR[status]} dot>{t(`guildForms.status.${status}`)}</Badge>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-[#55555F]">
                                        {t(`access.modes.${f.accessMode ?? "AUTHENTICATED"}.label`)}
                                    </td>
                                    <td className="px-5 py-3 text-right tabular-nums text-[#55555F]">{f.submissionCount}</td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {status === "PUBLISHED" && f.slug && <CopyLink slug={f.slug}/>}
                                            {isOwner && (
                                                <>
                                                    {f.submissionCount > 0 && (
                                                        <ActionBtn
                                                            onClick={() => run(f, () => exportFormCsv(f.id))}
                                                            disabled={busy}
                                                            title={t("guildForms.exportCsv")}
                                                        >
                                                            <FiDownload size={11} className="inline"/>
                                                        </ActionBtn>
                                                    )}
                                                    {status !== "ARCHIVED" && (
                                                        <ActionBtn onClick={() => setEditForm(f)} disabled={busy}
                                                                   title={t("common.edit")}>
                                                            <FiEdit3 size={11} className="inline"/>
                                                        </ActionBtn>
                                                    )}
                                                    {(status === "DRAFT" || status === "CLOSED") && (
                                                        <ActionBtn variant="success" onClick={() => publish(f)} disabled={busy}>
                                                            <FiSend size={11} className="mr-1 inline"/>
                                                            {t("guildForms.publish")}
                                                        </ActionBtn>
                                                    )}
                                                    {status === "PUBLISHED" && (
                                                        <ActionBtn variant="warning" onClick={() => setStatus(f, "CLOSED")}
                                                                   disabled={busy}>
                                                            <FiSlash size={11} className="mr-1 inline"/>
                                                            {t("guildForms.close")}
                                                        </ActionBtn>
                                                    )}
                                                    {status === "ARCHIVED" ? (
                                                        <ActionBtn onClick={() => setStatus(f, "CLOSED")} disabled={busy}>
                                                            {t("guildForms.unarchive")}
                                                        </ActionBtn>
                                                    ) : (
                                                        <ActionBtn onClick={() => setStatus(f, "ARCHIVED")} disabled={busy}
                                                                   title={t("guildForms.archive")}>
                                                            <FiArchive size={11} className="inline"/>
                                                        </ActionBtn>
                                                    )}
                                                    <ActionBtn variant="danger" onClick={() => setDeleteTarget(f)}
                                                               disabled={busy} title={t("common.delete")}>
                                                        <FiTrash2 size={11} className="inline"/>
                                                    </ActionBtn>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            <AnimatePresence>
                {showWizard && (
                    <FormWizard
                        guildId={guild.guildId}
                        onClose={() => setShowWizard(false)}
                        onCreated={() => {
                            setShowWizard(false);
                            load();
                        }}
                    />
                )}
                {editForm && (
                    <FormEditModal
                        form={editForm}
                        onClose={() => setEditForm(null)}
                        onUpdated={load}
                    />
                )}
                {deleteTarget && (
                    <ConfirmModal
                        title={t("forms.deleteConfirm.title")}
                        message={t("forms.deleteConfirm.message", {
                            title: deleteTarget.title,
                            count: deleteTarget.submissionCount
                        })}
                        confirmLabel={t("forms.deleteConfirm.confirm")}
                        confirmColor="red"
                        onConfirm={handleDelete}
                        onCancel={() => setDeleteTarget(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
