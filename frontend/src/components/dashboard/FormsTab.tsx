import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  getDashboardForms,
  deleteForm,
  toggleFormActive,
  type DashboardForm,
} from "../../api/dashboard";
import { TabSkeleton, EmptyState, Badge } from "./shared";
import FormWizard from "./forms/FormWizard";

export default function FormsTab() {
  const [forms, setForms] = useState<DashboardForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

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
    if (!confirm("Delete this form? This cannot be undone.")) return;
    await deleteForm(formId);
    await loadForms();
  };

  const copyLink = (formId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/forms/${formId}`);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Forms</h1>
          <p className="mt-0.5 text-sm text-white/40">
            {forms.length} form{forms.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          + Create form
        </button>
      </div>

      {loading ? (
        <TabSkeleton />
      ) : forms.length === 0 ? (
        <EmptyState message="No forms yet. Create your first form." />
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
                    <Badge color={form.active ? "green" : "default"}>
                      {form.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-white/40">
                    {new Date(form.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => copyLink(form.id)}
                        className="rounded-lg px-2.5 py-1 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        Copy link
                      </button>
                      <button
                        onClick={() => handleToggle(form)}
                        className="rounded-lg px-2.5 py-1 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        {form.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(form.id)}
                        className="rounded-lg px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {showWizard && (
          <FormWizard
            onClose={() => setShowWizard(false)}
            onCreated={() => {
              setShowWizard(false);
              loadForms();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}