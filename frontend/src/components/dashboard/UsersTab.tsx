import {useEffect, useState} from "react";
import {banUser, type DashboardUser, getUsers, unbanUser,} from "../../api/dashboard";

export default function UsersTab() {
    const [users, setUsers] = useState<DashboardUser[]>([]);
    const [loading, setLoading] = useState(true);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data.content);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleBan = async (user: DashboardUser) => {
        if (user.bannedPermanently) {
            await unbanUser(user.discordId);
        } else {
            await banUser(user.discordId, {permanent: true});
        }
        await loadUsers();
    };

    const handleTimeout = async (user: DashboardUser) => {
        const input = prompt("Timeout duration in minutes:");
        if (!input || isNaN(Number(input))) return;
        await banUser(user.discordId, {
            permanent: false,
            timeoutMinutes: Number(input),
        });
        await loadUsers();
    };

    if (loading) return <TabSkeleton/>;

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-white">Users</h1>
                <p className="mt-0.5 text-sm text-white/40">
                    {users.length} registered user{users.length !== 1 ? "s" : ""}
                </p>
            </div>

            {users.length === 0 ? (
                <EmptyState message="No users registered yet."/>
            ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02]">
                            <th className="px-4 py-3 text-left font-medium text-white/40">User</th>
                            <th className="px-4 py-3 text-left font-medium text-white/40">Roles</th>
                            <th className="px-4 py-3 text-left font-medium text-white/40">Status</th>
                            <th className="px-4 py-3 text-right font-medium text-white/40">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {users.map((user, idx) => (
                            <tr
                                key={user.id}
                                className={`border-b border-white/5 transition-colors hover:bg-white/[0.02] ${
                                    idx === users.length - 1 ? "border-0" : ""
                                }`}
                            >
                                <td className="px-4 py-3">
                                    <p className="font-medium text-white">{user.discordUsername}</p>
                                    <p className="text-xs text-white/30">{user.discordId}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                        {user.roles.length === 0 ? (
                                            <span className="text-white/30">—</span>
                                        ) : (
                                            user.roles.map((role) => (
                                                <span
                                                    key={role}
                                                    className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300"
                                                >
                            {role}
                          </span>
                                            ))
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {user.bannedPermanently ? (
                                        <span
                                            className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                        Banned
                      </span>
                                    ) : user.bannedUntil &&
                                    new Date(user.bannedUntil) > new Date() ? (
                                        <span
                                            className="inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-400">
                        Timeout
                      </span>
                                    ) : (
                                        <span
                                            className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        Active
                      </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleTimeout(user)}
                                            className="rounded-lg px-2.5 py-1 text-xs text-orange-400 transition-colors hover:bg-orange-500/10"
                                        >
                                            Timeout
                                        </button>
                                        <button
                                            onClick={() => handleBan(user)}
                                            className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                                                user.bannedPermanently
                                                    ? "text-emerald-400 hover:bg-emerald-500/10"
                                                    : "text-red-400 hover:bg-red-500/10"
                                            }`}
                                        >
                                            {user.bannedPermanently ? "Unban" : "Ban"}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}


function TabSkeleton() {
    return (
        <div className="flex flex-col gap-3 animate-pulse">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-white/5"/>
            ))}
        </div>
    );
}

function EmptyState({message}: { message: string }) {
    return (
        <div
            className="flex h-48 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-white/30">
            {message}
        </div>
    );
}