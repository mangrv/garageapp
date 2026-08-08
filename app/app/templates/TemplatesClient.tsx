"use client";

import { useState, useTransition } from "react";
import { renameTemplate, deleteTemplate } from "./actions";
import Link from "next/link";

type Template = {
  id: string; name: string; createdAt: string; phaseCount: number; taskCount: number;
};

function TemplateRow({ t }: { t: Template }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(t.name);
  const [showDelete, setShowDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await renameTemplate(t.id, name);
      setEditing(false);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteTemplate(t.id);
    });
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
      {editing ? (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={pending || !name.trim()}
              className="flex-1 bg-amber-500 text-gray-950 font-bold py-2 rounded-xl text-sm disabled:opacity-40">
              Save
            </button>
            <button onClick={() => { setEditing(false); setName(t.name); }}
              className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold text-sm text-white">💾 {t.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {t.phaseCount} phase{t.phaseCount !== 1 ? "s" : ""} · {t.taskCount} task{t.taskCount !== 1 ? "s" : ""} · saved {new Date(t.createdAt).toLocaleDateString()}
              </div>
            </div>
            <button onClick={() => setEditing(true)} className="text-gray-600 text-sm active:text-amber-400 px-1 flex-shrink-0">✏️</button>
          </div>

          {showDelete ? (
            <div className="space-y-2 pt-1 border-t border-gray-800">
              <p className="text-xs text-gray-400 text-center">Delete this template?</p>
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={pending}
                  className="flex-1 bg-red-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-40">
                  Yes, delete
                </button>
                <button onClick={() => setShowDelete(false)}
                  className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-xl text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowDelete(true)}
              className="w-full text-xs text-red-500 py-1.5 active:bg-red-900/20 rounded-lg border border-red-900/30">
              🗑 Delete template
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function TemplatesClient({ templates }: { templates: Template[] }) {
  return (
    <div className="min-h-screen bg-gray-950 pb-24 w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 text-sm">←</Link>
          <div>
            <h1 className="font-bold text-base">💾 My Templates</h1>
            <p className="text-xs text-gray-500">{templates.length} saved</p>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {templates.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <div className="text-4xl">💾</div>
            <p className="text-sm text-gray-500">No saved templates yet.</p>
            <p className="text-xs text-gray-600">Open a project board and tap 💾 to save it as a template.</p>
          </div>
        ) : (
          templates.map((t) => <TemplateRow key={t.id} t={t} />)
        )}

        <div className="pt-2">
          <Link href="/jobs/new"
            className="block w-full text-center bg-amber-500 text-gray-950 font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform">
            + New Job from Template →
          </Link>
        </div>
      </div>
    </div>
  );
}
