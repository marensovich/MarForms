import {useEffect, useState} from "react";
import {createRole, type DashboardRole, deleteRole, getRoles, updateRole} from "../../api/dashboard";
import {ActionBtn, Badge, ConfirmModal, EmptyState, Modal, StatsCard, TabSkeleton} from "./shared";
import {FiCheck, FiEdit3, FiPlus, FiShield, FiTrash2,} from "react-icons/fi";
import {useTranslation} from "react-i18next";

type PermColor = "indigo" | "blue" | "purple" | "orange" | "green" | "red";

const PERM_ACTIVE_CLS: Record<PermColor, string> = {
    indigo: "border-prs bg-prs text-prt",
    blue: "border-inb bg-inb text-int",
    purple: "border-prs bg-prs text-prt",
    orange: "border-amb bg-amb text-amt",
    green: "border-gnb bg-gnb text-gnt",
    red: "border-rdb bg-rdb text-rdt",
};

const PERMISSION_GROUPS: { label: string; color: PermColor; perms: string[] }[] = [
    {label: "Dashboard", color: "indigo", perms: ["DASHBOARD_ACCESS"]},
    {label: "Forms", color: "blue", perms: ["FORMS_MANAGE"]},
    {label: "Responses", color: "purple", perms: ["RESPONSES_MANAGE"]},
    {label: "Users", color: "orange", perms: ["USERS_MODERATE"]},
    {label: "Roles", color: "green", perms: ["ROLES_MANAGE"]},
    {label: "System", color: "red", perms: ["SYSTEM_ADMIN"]},
];

function permLabel(perm: string): string {
    return perm
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function PermissionGrid({
                            selected,
                            onToggle,
                        }: {
    selected: string[];
    onToggle: (perm: string) => void;
}) {
    const {t} = useTranslation();
    return (
        <div className="flex flex-col gap-3">
            {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-mu">
                        {t(`roles.permGroups.${group.label}`)}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {group.perms.map(perm => {
                            const active = selected.includes(perm);
                            return (
                                <button
                                    key={perm}
                                    type="button"
                                    onClick={() => onToggle(perm)}
                                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                                        active
                                            ? PERM_ACTIVE_CLS[group.color]
                                            : "border-bd bg-sf text-mu hover:border-bd hover:text-tx"
                                    }`}
                                >
                                    {active && <FiCheck size={10} className="flex-shrink-0"/>}
                                    {permLabel(perm)}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

function CreateRoleModal({
                             onClose,
                             onCreated,
                         }: {
    onClose: () => void;
    onCreated: () => void;
}) {
    const {t} = useTranslation();
    const [name, setName] = useState("");
    const [perms, setPerms] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggle = (perm: string) =>
        setPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);

    const handleCreate = async () => {
        if (!name.trim()) {
            setError(t("roles.createModal.nameRequired"));
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await createRole({name: name.trim(), permissions: perms});
            onCreated();
        } catch (e) {
            setError(e instanceof Error ? e.message : t("roles.createModal.failedToCreate"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={t("roles.createModal.title")} subtitle={t("roles.createModal.subtitle")} onClose={onClose} width="max-w-lg">
            <div className="flex flex-col gap-4">
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-mu">{t("roles.createModal.nameLabel")}</label>
                    <input
                        value={name}
                        onChange={e => {
                            setName(e.target.value);
                            setError(null);
                        }}
                        placeholder={t("roles.createModal.namePlaceholder")}
                        autoFocus
                        className="w-full rounded-xl border border-bd bg-bg px-4 py-2.5 text-sm text-tx placeholder-mu/70 outline-none transition-colors focus:border-pr"
                    />
                    {error && <p className="mt-1.5 text-xs text-rdt">{error}</p>}
                </div>

                <div>
                    <label className="mb-2 block text-xs font-medium text-mu">
                        {t("roles.createModal.permissionsLabel")}
                        <span className="ml-2 text-mu">({t("roles.createModal.selected", {count: perms.length})})</span>
                    </label>
                    <div className="rounded-xl border border-bd bg-bg p-4">
                        <PermissionGrid selected={perms} onToggle={toggle}/>
                    </div>
                </div>

                <div className="flex gap-2 pt-1">
                    <button
                        onClick={handleCreate}
                        disabled={saving || !name.trim()}
                        className="flex-1 rounded-xl bg-pr py-2.5 text-sm font-medium text-white transition-colors hover:bg-prh disabled:opacity-60"
                    >
                        {saving ? t("roles.createModal.creating") : t("roles.createRole")}
                    </button>
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-bd px-5 py-2.5 text-sm text-mu transition-colors hover:text-tx"
                    >
                        {t("common.cancel")}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function RoleCard({
                      role,
                      onEdit,
                      onDelete,
                  }: {
    role: DashboardRole;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const {t} = useTranslation();
    const getGroupColor = (perm: string) => {
        const group = PERMISSION_GROUPS.find(g => g.perms.includes(perm));
        return group?.color ?? "default";
    };

    return (
        <div
            className="group rounded-xl border border-bd bg-sf p-5 transition-colors hover:border-bd">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-prs bg-prs">
                        <FiShield size={15} className="text-prt"/>
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-tx">{role.name}</p>
                        <p className="text-xs text-mu">
                            {t("roles.permissionCount", {count: role.permissions.length})}
                        </p>
                    </div>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <ActionBtn onClick={onEdit} variant="ghost" title="Edit role">
                        <FiEdit3 size={13}/>
                    </ActionBtn>
                    <ActionBtn onClick={onDelete} variant="danger" title="Delete role">
                        <FiTrash2 size={13}/>
                    </ActionBtn>
                </div>
            </div>

            {role.permissions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                    {role.permissions.map(perm => (
                        <Badge key={perm}
                               color={getGroupColor(perm) as "indigo" | "blue" | "purple" | "orange" | "green" | "red"}>
                            {permLabel(perm)}
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

type EditingRole = { id: string; name: string; permissions: string[] };

export default function RolesTab() {
    const {t} = useTranslation();
    const [roles, setRoles] = useState<DashboardRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<EditingRole | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DashboardRole | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const loadRoles = async () => {
        setLoading(true);
        try {
            setRoles(await getRoles());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRoles();
    }, []);

    const handleUpdate = async () => {
        if (!editing) return;
        await updateRole(editing.id, {name: editing.name, permissions: editing.permissions});
        setEditing(null);
        await loadRoles();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleteError(null);
        try {
            await deleteRole(deleteTarget.id);
            setDeleteTarget(null);
            await loadRoles();
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : "Cannot delete this role.");
            setDeleteTarget(null);
        }
    };

    if (loading) return <TabSkeleton/>;

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-tx">{t("roles.title")}</h1>
                    <p className="mt-0.5 text-sm text-mu">{t("roles.subtitle")}</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 rounded-lg bg-pr px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-prh"
                >
                    <FiPlus size={15}/>
                    {t("roles.createRole")}
                </button>
            </div>

            {/* Stats */}
            <div className="mb-6">
                <StatsCard
                    label={t("roles.stats.totalRoles")}
                    value={roles.length}
                    sub={t("roles.stats.definedGroups")}
                    icon={<FiShield size={16}/>}
                    accentColor="rgb(var(--prt))"
                />
            </div>

            {deleteError && (
                <div className="mb-4 rounded-xl border border-rdb bg-rdb px-4 py-3 text-sm text-rdt">
                    {deleteError}
                </div>
            )}

            {/* Roles list */}
            {roles.length === 0 ? (
                <EmptyState message={t("roles.noRoles")} icon={<FiShield/>}/>
            ) : (
                <div className="flex flex-col gap-3">
                    {roles.map(role => (
                        editing?.id === role.id ? (
                            <div key={role.id}
                                 className="rounded-xl border border-prs bg-prs p-5">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-prt">{t("roles.editingRole")}</p>
                                <input
                                    value={editing.name}
                                    onChange={e => setEditing({...editing, name: e.target.value})}
                                    className="mb-4 w-full rounded-xl border border-bd bg-sf px-4 py-2.5 text-sm text-tx outline-none focus:border-pr transition-colors"
                                />
                                <div className="mb-4 rounded-xl border border-bd bg-sf p-4">
                                    <PermissionGrid
                                        selected={editing.permissions}
                                        onToggle={p =>
                                            setEditing({
                                                ...editing,
                                                permissions: editing.permissions.includes(p)
                                                    ? editing.permissions.filter(x => x !== p)
                                                    : [...editing.permissions, p],
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleUpdate}
                                        className="rounded-xl bg-pr px-4 py-2 text-sm font-medium text-white hover:bg-prh transition-colors"
                                    >
                                        {t("roles.saveChanges")}
                                    </button>
                                    <button
                                        onClick={() => setEditing(null)}
                                        className="rounded-xl border border-bd px-4 py-2 text-sm text-mu hover:text-tx transition-colors"
                                    >
                                        {t("common.cancel")}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <RoleCard
                                key={role.id}
                                role={role}
                                onEdit={() => setEditing({id: role.id, name: role.name, permissions: role.permissions})}
                                onDelete={() => setDeleteTarget(role)}
                            />
                        )
                    ))}
                </div>
            )}

            {showCreate && (
                <CreateRoleModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        loadRoles();
                    }}
                />
            )}
            {deleteTarget && (
                <ConfirmModal
                    title={t("roles.deleteConfirm.title")}
                    message={t("roles.deleteConfirm.message", {name: deleteTarget.name})}
                    confirmLabel={t("roles.deleteConfirm.confirm")}
                    confirmColor="red"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
}
