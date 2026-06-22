import { useEffect, useState } from "react";
import {
  getRoles,
  deleteRole,
  createRole,
  type DashboardRole,
} from "../../api/dashboard";

const ALL_PERMISSIONS = [
  "FORM_CREATE", "FORM_READ", "FORM_SUBMIT", "FORM_UPDATE", "FORM_DELETE",
  "RESPONSE_READ", "RESPONSE_DELETE",
  "USER_READ", "USER_UPDATE",
  "ROLE_MANAGE",
  "DASHBOARD_READ",
];

export default function RolesTab() {
  const [roles, setRoles] = useState<DashboardRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const data = await getRoles();
      setRoles(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoles(); }, []);

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleCreate = async () => {
    if (!newRoleName.trim()) return;
    await createRole({ name: newRoleName.trim(), permissions: selectedPerms });
    setCreating(false);
    setNewRoleName("");
    setSelectedPerms([]);
    await loadRoles();
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm("Delete this role? Users with this role will lose its permissions.")) return;
    await deleteRole(roleId);
    await loadRoles();
  };

  if (loading) return <TabSkeleton />;

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

      {/* Форма создания роли */}
      {creating && (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">New role</h2>
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Role name"
            className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500"
          />
          <p className="mb-2 text-xs text-white/40">Permissions</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {ALL_PERMISSIONS.map((perm) => {
              const active = selectedPerms.includes(perm);
              return (
                <button
                  key={perm}
                  type="button"
                  onClick={() => togglePerm(perm)}
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
        <EmptyState message="No roles yet. Create one to manage permissions." />
      ) : (
        <div className="flex flex-col gap-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4"
            >
              <div>
                <p className="font-medium text-white">{role.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {role.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDelete(role.id)}
                className="rounded-lg px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-white/30">
      {message}
    </div>
  );
}