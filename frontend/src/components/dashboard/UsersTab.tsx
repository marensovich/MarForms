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
import {ActionBtn, Badge, ConfirmModal, EmptyState, Modal, StatsCard, TabSkeleton} from "./shared";
import {
    FiCheckCircle,
    FiClock,
    FiFilter,
    FiSearch,
    FiShield,
    FiSlash,
    FiUserCheck,
    FiUsers,
    FiUserX,
} from "react-icons/fi";
import {useTranslation} from "react-i18next";

function UserAvatar({name}: { name: string }) {
    const clean = name.replace(/#\d+$/, "");
    const parts = clean.split(/[\s_]+/);
    const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : clean.slice(0, 2);
    const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return (
        <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{background: `hsl(${hue}, 55%, 35%)`}}
        >
            {letters.toUpperCase()}
        </div>
    );
}

function RolesModal({
                        user,
                        roles,
                        onClose,
                        onSave,
                    }: {
    user: DashboardUser;
    roles: DashboardRole[];
    onClose: () => void;
    onSave: (roleIds: string[]) => Promise<void>;
}) {
    const [selected, setSelected] = useState<string[]>(user.roles.map(r => r.id));
    const [saving, setSaving] = useState(false);

    const toggle = (id: string) =>
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(selected);
        } finally {
            setSaving(false);
        }
    };

    const {t} = useTranslation();

    return (
        <Modal
            title={t("users.rolesModal.title")}
            subtitle={user.discordUsername}
            onClose={onClose}
            width="max-w-sm"
        >
            {roles.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/65">{t("users.rolesModal.noRoles")}</p>
            ) : (
                <div className="mb-5 flex flex-col gap-1.5">
                    {roles.map(role => {
                        const active = selected.includes(role.id);
                        return (
                            <label
                                key={role.id}
                                onClick={() => toggle(role.id)}
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                                    active
                                        ? "border-indigo-500/30 bg-indigo-500/10"
                                        : "border-white/[0.07] hover:border-white/[0.12] hover:bg-white/[0.02]"
                                }`}
                            >
                                <div
                                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                                        active ? "border-indigo-500 bg-indigo-500" : "border-white/20"
                                    }`}>
                                    {active && <FiCheckCircle size={10} className="text-white"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white">{role.name}</p>
                                    <p className="text-xs text-white/30">{t("users.rolesModal.permissionCount", {count: role.permissions.length})}</p>
                                </div>
                            </label>
                        );
                    })}
                </div>
            )}
            <div className="flex gap-2">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
                >
                    {saving ? t("users.rolesModal.saving") : t("users.rolesModal.save")}
                </button>
                <button
                    onClick={onClose}
                    className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-white/50 transition-colors hover:text-white"
                >
                    {t("common.cancel")}
                </button>
            </div>
        </Modal>
    );
}

function TimeoutModal({
                          user,
                          onClose,
                          onConfirm,
                      }: {
    user: DashboardUser;
    onClose: () => void;
    onConfirm: (minutes: number) => Promise<void>;
}) {
    const [minutes, setMinutes] = useState("60");
    const [saving, setSaving] = useState(false);
    const presets = [15, 60, 360, 1440, 10080];

    const handleConfirm = async () => {
        const n = Number(minutes);
        if (!n || n <= 0) return;
        setSaving(true);
        try {
            await onConfirm(n);
        } finally {
            setSaving(false);
        }
    };

    const {t} = useTranslation();

    return (
        <Modal
            title={t("users.timeoutModal.title")}
            subtitle={t("users.timeoutModal.subtitle", {username: user.discordUsername})}
            onClose={onClose}
            width="max-w-sm"
        >
            <div className="mb-4">
                <p className="mb-2 text-xs text-white/65">{t("users.timeoutModal.durationLabel")}</p>
                <input
                    type="number"
                    min="1"
                    value={minutes}
                    onChange={e => setMinutes(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {presets.map(p => (
                        <button
                            key={p}
                            onClick={() => setMinutes(String(p))}
                            className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                                minutes === String(p)
                                    ? "bg-indigo-500/20 text-indigo-300"
                                    : "bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
                            }`}
                        >
                            {p < 60 ? `${p}m` : p < 1440 ? `${p / 60}h` : p < 10080 ? `${p / 1440}d` : `${p / 10080}w`}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={handleConfirm}
                    disabled={saving || !Number(minutes) || Number(minutes) <= 0}
                    className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
                >
                    {saving ? t("users.timeoutModal.applying") : t("users.timeoutModal.apply")}
                </button>
                <button
                    onClick={onClose}
                    className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-white/50 transition-colors hover:text-white"
                >
                    {t("common.cancel")}
                </button>
            </div>
        </Modal>
    );
}

export default function UsersTab() {
    const {t} = useTranslation();
    const [users, setUsers] = useState<DashboardUser[]>([]);
    const [roles, setRoles] = useState<DashboardRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterRoleId, setFilterRoleId] = useState<string>("");
    const [totalElements, setTotalElements] = useState(0);

    const [assigningUser, setAssigningUser] = useState<DashboardUser | null>(null);
    const [timeoutUser, setTimeoutUser] = useState<DashboardUser | null>(null);
    const [banTarget, setBanTarget] = useState<DashboardUser | null>(null);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getUsers(0, 20, search || undefined, filterRoleId || undefined);
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
        const t = setTimeout(() => loadUsers(), 300);
        return () => clearTimeout(t);
    }, [loadUsers]);

    const handleBanConfirm = async () => {
        if (!banTarget) return;
        if (banTarget.currentlyBanned) {
            await unbanUser(banTarget.discordId);
        } else {
            await banUser(banTarget.discordId, {permanent: true});
        }
        setBanTarget(null);
        await loadUsers();
    };

    const handleTimeout = async (user: DashboardUser, minutes: number) => {
        await banUser(user.discordId, {permanent: false, timeoutMinutes: minutes});
        setTimeoutUser(null);
        await loadUsers();
    };

    const handleAssignRoles = async (roleIds: string[]) => {
        if (!assigningUser) return;
        await assignUserRoles(assigningUser.discordId, roleIds);
        setAssigningUser(null);
        await loadUsers();
    };

    const getBanStatus = (user: DashboardUser) => {
        if (user.bannedPermanently) return {label: t("users.banStatus.banned"), color: "red" as const};
        if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
            return {label: t("users.banStatus.timeout"), color: "orange" as const};
        }
        return {label: t("users.banStatus.active"), color: "green" as const};
    };

    const bannedCount = users.filter(u => u.currentlyBanned).length;
    const activeCount = users.filter(u => !u.currentlyBanned).length;

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">{t("users.title")}</h1>
                    <p className="mt-0.5 text-sm text-white/65">{t("users.subtitle")}</p>
                </div>
            </div>

            {/* Stats */}
            {!loading && (
                <div className="mb-6 grid grid-cols-3 gap-4">
                    <StatsCard
                        label={t("users.stats.totalUsers")}
                        value={totalElements}
                        sub={t("users.stats.registeredAccounts")}
                        icon={<FiUsers size={16}/>}
                        accentColor="#6366f1"
                    />
                    <StatsCard
                        label={t("users.stats.active")}
                        value={activeCount}
                        sub={t("users.stats.onThisPage")}
                        icon={<FiUserCheck size={16}/>}
                        accentColor="#34d399"
                    />
                    <StatsCard
                        label={t("users.stats.restricted")}
                        value={bannedCount}
                        sub={t("users.stats.bannedOrTimeout")}
                        icon={<FiUserX size={16}/>}
                        accentColor="#f87171"
                    />
                </div>
            )}

            {/* Filters */}
            <div className="mb-4 flex gap-3">
                <div className="relative flex-1">
                    <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"/>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t("users.searchPlaceholder")}
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-indigo-500/60 focus:bg-white/[0.04]"
                    />
                </div>
                <div className="relative">
                    <FiFilter size={13}
                              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
                    <select
                        value={filterRoleId}
                        onChange={e => setFilterRoleId(e.target.value)}
                        className="appearance-none rounded-xl border border-white/[0.08] bg-[#0a0a0f] py-2.5 pl-9 pr-8 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors"
                    >
                        <option value="">{t("users.allRoles")}</option>
                        {roles.map(role => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <TabSkeleton/>
            ) : users.length === 0 ? (
                <EmptyState message={t("users.noUsers")} icon={<FiUsers/>}/>
            ) : (
                <div className="overflow-hidden rounded-xl border border-white/[0.07]">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">{t("users.table.user")}</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">{t("users.table.discordId")}</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">{t("users.table.roles")}</th>
                            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/55">{t("users.table.status")}</th>
                            <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/55">{t("users.table.actions")}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                        {users.map(user => {
                            const banStatus = getBanStatus(user);
                            return (
                                <tr key={user.id} className="transition-colors hover:bg-white/[0.015]">
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <UserAvatar name={user.discordUsername}/>
                                            <div>
                                                <p className="font-medium text-white">{user.discordUsername}</p>
                                                {user.bannedUntil && !user.bannedPermanently && new Date(user.bannedUntil) > new Date() && (
                                                    <p className="mt-0.5 text-xs text-orange-400/70">
                                                        {t("users.until", {date: new Date(user.bannedUntil).toLocaleString()})}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className="font-mono text-xs text-white/55">{user.discordId}</span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles.length === 0 ? (
                                                <span className="text-xs text-white/40">{t("users.noRoles")}</span>
                                            ) : (
                                                user.roles.map(role => (
                                                    <Badge key={role.id} color="indigo">{role.name}</Badge>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <Badge color={banStatus.color} dot>{banStatus.label}</Badge>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center justify-end gap-1">
                                            <ActionBtn onClick={() => setAssigningUser(user)} variant="ghost">
                                                <FiShield size={11} className="inline mr-1"/>{t("users.actions.roles")}
                                            </ActionBtn>
                                            {!user.currentlyBanned && (
                                                <ActionBtn onClick={() => setTimeoutUser(user)} variant="warning">
                                                    <FiClock size={11} className="inline mr-1"/>{t("users.actions.timeout")}
                                                </ActionBtn>
                                            )}
                                            <ActionBtn
                                                onClick={() => setBanTarget(user)}
                                                variant={user.currentlyBanned ? "success" : "danger"}
                                            >
                                                {user.currentlyBanned
                                                    ? <><FiCheckCircle size={11} className="inline mr-1"/>{t("users.actions.unban")}</>
                                                    : <><FiSlash size={11} className="inline mr-1"/>{t("users.actions.ban")}</>}
                                            </ActionBtn>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                    {totalElements > users.length && (
                        <div className="border-t border-white/[0.05] bg-white/[0.01] px-5 py-3">
                            <p className="text-xs text-white/45">
                                {t("users.showing", {count: users.length, total: totalElements})}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {assigningUser && (
                <RolesModal
                    user={assigningUser}
                    roles={roles}
                    onClose={() => setAssigningUser(null)}
                    onSave={handleAssignRoles}
                />
            )}
            {timeoutUser && (
                <TimeoutModal
                    user={timeoutUser}
                    onClose={() => setTimeoutUser(null)}
                    onConfirm={mins => handleTimeout(timeoutUser, mins)}
                />
            )}
            {banTarget && (
                <ConfirmModal
                    title={banTarget.currentlyBanned ? t("users.banModal.unbanTitle") : t("users.banModal.banTitle")}
                    message={banTarget.currentlyBanned
                        ? t("users.banModal.unbanMessage", {username: banTarget.discordUsername})
                        : t("users.banModal.banMessage", {username: banTarget.discordUsername})}
                    confirmLabel={banTarget.currentlyBanned ? t("users.banModal.unbanConfirm") : t("users.banModal.banConfirm")}
                    confirmColor={banTarget.currentlyBanned ? "indigo" : "red"}
                    onConfirm={handleBanConfirm}
                    onCancel={() => setBanTarget(null)}
                />
            )}
        </div>
    );
}
