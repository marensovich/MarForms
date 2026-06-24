import {useEffect, useState} from "react";
import {createRole, type DashboardRole, deleteRole, getRoles, updateRole} from "../../api/dashboard";
import {ActionBtn, Badge, ConfirmModal, EmptyState, Modal, StatsCard, TabSkeleton} from "./shared";
import {FiCheck, FiEdit3, FiLock, FiPlus, FiShield, FiTrash2,} from "react-icons/fi";

type PermColor = "indigo" | "blue" | "purple" | "orange" | "green" | "red";

const PERM_ACTIVE_CLS: Record<PermColor, string> = {
    indigo: "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
    blue: "border-blue-500/30 bg-blue-500/15 text-blue-300",
    purple: "border-purple-500/30 bg-purple-500/15 text-purple-300",
    orange: "border-orange-500/30 bg-orange-500/15 text-orange-300",
    green: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    red: "border-red-500/30 bg-red-500/15 text-red-300",
};

const PERMISSION_GROUPS: { label: string; color: PermColor; perms: string[] }[] = [
    {label: "Dashboard", color: "indigo", perms: ["DASHBOARD_ACCESS"]},
    {label: "Forms", color: "blue", perms: ["FORMS_MANAGE"]},
    {label: "Responses", color: "purple", perms: ["RESPONSES_MANAGE"]},
    {label: "Users", color: "orange", perms: ["USERS_MODERATE"]},
    {label: "Roles", color: "green", perms: ["ROLES_MANAGE"]},
    {label: "System", color: "red", perms: ["SYSTEM_ADMIN"]},
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.perms);

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
    return (
        <div className="flex flex-col gap-3">
            {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                        {group.label}
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
                                            : "border-white/[0.07] bg-white/[0.02] text-white/55 hover:border-white/[0.15] hover:text-white/70"
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
    const [name, setName] = useState("");
    const [perms, setPerms] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggle = (perm: string) =>
        setPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);

    const handleCreate = async () => {
        if (!name.trim()) {
            setError("Role name is required.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await createRole({name: name.trim(), permissions: perms});
            onCreated();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create role.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title="Create Role" subtitle="Define name and permissions" onClose={onClose} width="max-w-lg">
            <div className="flex flex-col gap-4">
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">Role name</label>
                    <input
                        value={name}
                        onChange={e => {
                            setName(e.target.value);
                            setError(null);
                        }}
                        placeholder="e.g. Moderator"
                        autoFocus
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-indigo-500/60"
                    />
                    {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
                </div>

                <div>
                    <label className="mb-2 block text-xs font-medium text-white/60">
                        Permissions
                        <span className="ml-2 text-white/50">({perms.length} selected)</span>
                    </label>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                        <PermissionGrid selected={perms} onToggle={toggle}/>
                    </div>
                </div>

                <div className="flex gap-2 pt-1">
                    <button
                        onClick={handleCreate}
                        disabled={saving || !name.trim()}
                        className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
                    >
                        {saving ? "Creating…" : "Create role"}
                    </button>
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm text-white/50 transition-colors hover:text-white"
                    >
                        Cancel
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
    const getGroupColor = (perm: string) => {
        const group = PERMISSION_GROUPS.find(g => g.perms.includes(perm));
        return group?.color ?? "default";
    };

    return (
        <div
            className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.10] hover:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10">
                        <FiShield size={15} className="text-indigo-400"/>
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-white">{role.name}</p>
                        <p className="text-xs text-white/55">
                            {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
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

    const totalPermissions = roles.reduce((sum, r) => sum + r.permissions.length, 0);

    if (loading) return <TabSkeleton/>;

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Roles</h1>
                    <p className="mt-0.5 text-sm text-white/65">Define permission sets and assign them to users</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
                >
                    <FiPlus size={15}/>
                    Create role
                </button>
            </div>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-4">
                <StatsCard
                    label="Total Roles"
                    value={roles.length}
                    sub="defined permission groups"
                    icon={<FiShield size={16}/>}
                    accentColor="#6366f1"
                />
                <StatsCard
                    label="Permissions Assigned"
                    value={totalPermissions}
                    sub={`avg ${roles.length > 0 ? (totalPermissions / roles.length).toFixed(1) : 0} per role`}
                    icon={<FiLock size={16}/>}
                    accentColor="#a78bfa"
                />
            </div>

            {deleteError && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {deleteError}
                </div>
            )}

            {/* Roles list */}
            {roles.length === 0 ? (
                <EmptyState message="No roles yet. Create your first role." icon={<FiShield/>}/>
            ) : (
                <div className="flex flex-col gap-3">
                    {roles.map(role => (
                        editing?.id === role.id ? (
                            <div key={role.id}
                                 className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-5">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-400/60">Editing
                                    role</p>
                                <input
                                    value={editing.name}
                                    onChange={e => setEditing({...editing, name: e.target.value})}
                                    className="mb-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors"
                                />
                                <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
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
                                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
                                    >
                                        Save changes
                                    </button>
                                    <button
                                        onClick={() => setEditing(null)}
                                        className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                                    >
                                        Cancel
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
                    title="Delete role"
                    message={`Are you sure you want to delete "${deleteTarget.name}"? Users with this role will lose its permissions immediately.`}
                    confirmLabel="Delete role"
                    confirmColor="red"
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
}
