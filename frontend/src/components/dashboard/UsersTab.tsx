import {useCallback, useEffect, useState} from "react";
import {
  assignUserRoles,
  banUser,
  type DashboardRole,
  type DashboardUser,
  getRoles,
  getUsers,
  unbanUser,
} from "../../api/dashboard";
import {Badge, EmptyState, TabSkeleton} from "./shared";

export default function UsersTab() {
    const [users, setUsers] = useState<DashboardUser[]>([]);
    const [roles, setRoles] = useState<DashboardRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterRoleId, setFilterRoleId] = useState<string>("");
    const [totalElements, setTotalElements] = useState(0);

    const [assigningUser, setAssigningUser] = useState<DashboardUser | null>(null);
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getUsers(
                0, 20,
                search || undefined,
                filterRoleId || undefined
            );
            setUsers(data.content);
            setTotalElements(data.page.totalElements);
        } finally {
            setLoading(false);
        }
    }, [search, filterRoleId]);

    useEffect(() => {
        getRoles().then(setRoles);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => loadUsers(), 300);
        return () => clearTimeout(timer);
    }, [loadUsers]);

    const handleBan = async (user: DashboardUser) => {
        if (user.currentlyBanned) {
            await unbanUser(user.discordId);
        } else {
            await banUser(user.discordId, {permanent: true});
        }
        await loadUsers();
    };

    const handleTimeout = async (user: DashboardUser) => {
        const input = prompt("Timeout duration in minutes:");
        if (!input || isNaN(Number(input)) || Number(input) <= 0) return;
        await banUser(user.discordId, {
            permanent: false,
            timeoutMinutes: Number(input),
        });
        await loadUsers();
    };

    const openAssignRoles = (user: DashboardUser) => {
        setAssigningUser(user);
        setSelectedRoleIds(user.roles.map(r => r.id));
    };

    const handleAssignRoles = async () => {
        if (!assigningUser) return;
        await assignUserRoles(assigningUser.discordId, selectedRoleIds);
        setAssigningUser(null);
        await loadUsers();
    };

    const toggleRoleSelection = (roleId: string) => {
        setSelectedRoleIds(prev =>
            prev.includes(roleId)
                ? prev.filter(id => id !== roleId)
                : [...prev, roleId]
        );
    };

    const getBanStatus = (user: DashboardUser) => {
        if (user.bannedPermanently) return {label: "Banned", color: "red" as const};
        if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
            return {label: "Timeout", color: "orange" as const};
        }
        return {label: "Active", color: "green" as const};
    };

    return (
        <div>
            {/* Заголовок */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Users</h1>
                    <p className="mt-0.5 text-sm text-white/40">
                        {totalElements} registered user{totalElements !== 1 ? "s" : ""}
                    </p>
                </div>
            </div>

            {/* Поиск и фильтр */}
            <div className="mb-4 flex gap-3">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by username or Discord ID..."
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-indigo-500"
                />
                <select
                    value={filterRoleId}
                    onChange={e => setFilterRoleId(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0a0a0f] px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                >
                    <option value="">All roles</option>
                    {roles.map(role => (
                        <option key={role.id} value={role.id}>
                            {role.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Таблица */}
            {loading ? (
                <TabSkeleton/>
            ) : users.length === 0 ? (
                <EmptyState message="No users found."/>
            ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02]">
                            <th className="px-4 py-3 text-left font-medium text-white/40">User</th>
                            <th className="px-4 py-3 text-left font-medium text-white/40">Discord ID</th>
                            <th className="px-4 py-3 text-left font-medium text-white/40">Roles</th>
                            <th className="px-4 py-3 text-left font-medium text-white/40">Status</th>
                            <th className="px-4 py-3 text-right font-medium text-white/40">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {users.map((user, idx) => {
                            const banStatus = getBanStatus(user);
                            return (
                                <tr
                                    key={user.id}
                                    className={`border-b border-white/5 transition-colors hover:bg-white/[0.02] ${
                                        idx === users.length - 1 ? "border-0" : ""
                                    }`}
                                >
                                    <td className="px-4 py-3 font-medium text-white">
                                        {user.discordUsername}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-white/40">
                                        {user.discordId}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles.length === 0 ? (
                                                <span className="text-white/30 text-xs">—</span>
                                            ) : (
                                                user.roles.map(role => (
                                                    <Badge key={role.id} color="indigo">
                                                        {role.name}
                                                    </Badge>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge color={banStatus.color}>{banStatus.label}</Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openAssignRoles(user)}
                                                className="rounded-lg px-2.5 py-1 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                                            >
                                                Roles
                                            </button>
                                            <button
                                                onClick={() => handleTimeout(user)}
                                                className="rounded-lg px-2.5 py-1 text-xs text-orange-400 transition-colors hover:bg-orange-500/10"
                                            >
                                                Timeout
                                            </button>
                                            <button
                                                onClick={() => handleBan(user)}
                                                className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                                                    user.currentlyBanned
                                                        ? "text-emerald-400 hover:bg-emerald-500/10"
                                                        : "text-red-400 hover:bg-red-500/10"
                                                }`}
                                            >
                                                {user.currentlyBanned ? "Unban" : "Ban"}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Модал назначения ролей */}
            {assigningUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0f17] p-6 shadow-2xl">
                        <h2 className="mb-1 text-base font-semibold text-white">
                            Assign roles
                        </h2>
                        <p className="mb-4 text-sm text-white/40">
                            {assigningUser.discordUsername}
                        </p>

                        <div className="mb-5 flex flex-col gap-2">
                            {roles.map(role => (
                                <label
                                    key={role.id}
                                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-4 py-2.5 transition-colors hover:border-white/20"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedRoleIds.includes(role.id)}
                                        onChange={() => toggleRoleSelection(role.id)}
                                        className="h-4 w-4 accent-indigo-500"
                                    />
                                    <span className="text-sm text-white">{role.name}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleAssignRoles}
                                className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setAssigningUser(null)}
                                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 transition-colors hover:text-white"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}