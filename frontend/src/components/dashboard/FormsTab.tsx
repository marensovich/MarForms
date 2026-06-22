import { useEffect, useState } from "react";
import {
  getDashboardForms,
  deleteForm,
  toggleFormActive,
  type DashboardForm,
} from "../../api/dashboard";

export default function FormsTab() {
  const [forms, setForms] = useState<DashboardForm[]>([]);
  const [loading, setLoading] = useState(true);

  const loadForms = async () => {
    setLoading(true);
    try {
      const data = await getDashboardForms();
      setForms(data.content);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadForms(); }, []);

  const handleToggle = async (form: DashboardForm) => {
    await toggleFormActive(form.id, !form.active);
    await loadForms();
  };

  const handleDelete = async (formId: string) => {
    if (!confirm("Delete this form? This action cannot be undone.")) return;
    await deleteForm(formId);
    await loadForms();
  };

  const copyLink = (formId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/forms/${formId}`);
  };

  if (loading) {
    return <TabSkeleton />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Forms</h1>
          <p className="mt-0.5 text-sm text-white/40">
            {forms.length} form{forms.length !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      {forms.length === 0 ? (
        <EmptyState message="No forms yet. Create one to get started." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 text-left font-medium text-white/40">Title</th>
                <th className="px-4 py-3 text-left font-medium text-white/40">Responses</th>
                <th className="px-4 py-3 text-left font-medium text-white/40">Status</th>
                <th className="px-4 py-3 text-left font-medium text-white/40">Created</th>
                <th className="px-4 py-3 text-right font-medium text-white/40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form, idx) => (
                <tr
                  key={form.id}
                  className={`border-b border-white/5 transition-colors hover:bg-white/[0.02] ${
                    idx === forms.length - 1 ? "border-0" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {form.title}
                  </td>
                  <td className="px-4 py-3 text-white/60">
                    {form.submissionCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        form.active
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-white/10 text-white/40"
                      }`}
                    >
                      {form.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40">
                    {new Date(form.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <ActionButton onClick={() => copyLink(form.id)}>
                        Copy link
                      </ActionButton>
                      <ActionButton onClick={() => handleToggle(form)}>
                        {form.active ? "Deactivate" : "Activate"}
                      </ActionButton>
                      <ActionButton
                        onClick={() => handleDelete(form.id)}
                        danger
                      >
                        Delete
                      </ActionButton>
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

function ActionButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-white/50 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
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