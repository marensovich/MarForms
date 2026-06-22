import {useEffect, useState} from "react";
import {createRole, type DashboardRole, deleteRole, getRoles, updateRole,} from "../../api/dashboard";
import {Badge, EmptyState, TabSkeleton} from "./shared";

const ALL_PERMISSIONS = [
    "DASHBOARD_ACCESS",
    "FORMS_VIEW", "FORMS_MANAGE",
    "RESPONSES_VIEW",
    "USERS_VIEW", "USERS_MANAGE",
    "ROLES_MANAGE",
    "SYSTEM_ADMIN",
];

type EditingRole = { id: string; name: string; permissions: string[] };

export default function RolesTab() {
    const [roles, setRoles] = useState<DashboardRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<EditingRole | null>(null);
    const [newRoleName, setNewRoleName] = useState("");
    const [newRolePerms, setNewRolePerms] = useState<string[]>([]);
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

    const togglePerm = (perm: string, current: string[], setter: (p: string[]) => void) => {
        setter(current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm]);
    };

    const handleCreate = async () => {
        if (!newRoleName.trim()) return;
        await createRole({name: newRoleName.trim(), permissions: newRolePerms});
        setCreating(false);
        setNewRoleName("");
        setNewRolePerms([]);
        await loadRoles();
    };

    const handleUpdate = async () => {
        if (!editing) return;
        await updateRole(editing.id, {name: editing.name, permissions: editing.permissions});
        setEditing(null);
        await loadRoles();
    };

    const handleDelete = async (roleId: string) => {
        setDeleteError(null);
        try {
            await deleteRole(roleId);
            await loadRoles();
        } catch (err) {
            if (err instanceof Error) {
                setDeleteError(err.message);
            }
        }
    };

    const PermissionToggle = ({
                                  perms,
                                  selected,
                                  onToggle,
                              }: {
        perms: string[];
        selected: string[];
        onToggle: (perm: string) => void;
    }) => (
        <div className="flex flex-wrap gap-1.5">
            {perms.map(perm => {
                const active = selected.includes(perm);
                return (
                    <button
                        key={perm}
                        type="button"
                        onClick={() => onToggle(perm)}
                        className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                            active
                                ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                                : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white"
                        }`}
                    >
                        {perm}
                    </button>
                );
            })}
        </div>
    );

    if (loading) return <TabSkeleton/>;

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Roles</h1>
                    <p className="mt-0.5 text-sm text-white/40">
                        {roles.length} role{roles.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                >
                    Create role
                </button>
            </div>

            {deleteError && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {deleteError}
                </div>
            )}

            {/* Форма создания */}
            {creating && (
                <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-5">
                    <h2 className="mb-4 text-sm font-semibold text-white">New role</h2>
                    <input
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        placeholder="Role name"
                        className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
                    />
                    <p className="mb-2 text-xs text-white/40">Permissions</p>
                    <div className="mb-4">
                        <PermissionToggle
                            perms={ALL_PERMISSIONS}
                            selected={newRolePerms}
                            onToggle={p => togglePerm(p, newRolePerms, setNewRolePerms)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCreate}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => setCreating(false)}
                            className="rounded-lg px-3 py-1.5 text-sm text-white/40 hover:text-white"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {roles.length === 0 ? (
                <EmptyState message="No roles yet."/>
            ) : (
                <div className="flex flex-col gap-3">
                    {roles.map(role => (
                        <div
                            key={role.id}
                            className="rounded-xl border border-white/10 bg-white/5 px-5 py-4"
                        >
                            {editing?.id === role.id ? (
                                // Режим редактирования
                                <div>
                                    <input
                                        value={editing.name}
                                        onChange={e => setEditing({...editing, name: e.target.value})}
                                        className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                    />
                                    <p className="mb-2 text-xs text-white/40">Permissions</p>
                                    <div className="mb-4">
                                        <PermissionToggle
                                            perms={ALL_PERMISSIONS}
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
                                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setEditing(null)}
                                            className="rounded-lg px-3 py-1.5 text-sm text-white/40 hover:text-white"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Режим просмотра
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-medium text-white">{role.name}</p>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {role.permissions.map(perm => (
                                                <Badge key={perm}>{perm}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() =>
                                                setEditing({
                                                    id: role.id,
                                                    name: role.name,
                                                    permissions: role.permissions,
                                                })
                                            }
                                            className="rounded-lg px-2.5 py-1 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(role.id)}
                                            className="rounded-lg px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {}
        </div>
    );
}