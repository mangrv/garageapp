'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/app/providers/AppProviders';

const DOC_TYPES: Record<string, { label: string; icon: string }> = {
  registration: { label: 'Registration', icon: '📋' },
  insurance: { label: 'Insurance', icon: '🛡️' },
  title: { label: 'Title', icon: '📜' },
  loan: { label: 'Loan / Financing', icon: '🏦' },
  warranty: { label: 'Warranty', icon: '🔧' },
  inspection: { label: 'Inspection', icon: '🔍' },
  other: { label: 'Other', icon: '📎' },
};

interface CarDoc {
  id: string;
  filename: string;
  type: string;
  label: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface CarDocumentsProps {
  carId: string;
  initialDocuments: CarDoc[];
}

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const [badge, setBadge] = useState<React.ReactNode>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const [y, m, d] = expiresAt.slice(0, 10).split('-').map(Number);
    const exp = new Date(y, m - 1, d);
    const diffDays = Math.floor((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0)
      setBadge(<span className="text-xs px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 font-medium">Expired</span>);
    else if (diffDays <= 30)
      setBadge(<span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 font-medium">Expires soon</span>);
    else
      setBadge(<span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Exp {exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>);
  }, [expiresAt]);
  return <>{badge}</>;
}

function isImage(filename: string) {
  return /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(filename);
}

export default function CarDocuments({ carId, initialDocuments }: CarDocumentsProps) {
  const { lang } = useApp();
  const [docs, setDocs] = useState<CarDoc[]>(initialDocuments);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{ docs: CarDoc[]; idx: number } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state — supports multiple files
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState('other');
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setFiles([]);
    setType('other');
    setLabel('');
    setExpiresAt('');
    setNotes('');
    setShowForm(false);
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const next = Array.from(incoming).filter((f) => !names.has(f.name));
      return [...prev, ...next];
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    const uploaded: CarDoc[] = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', type);
        if (label) fd.append('label', label);
        if (expiresAt) fd.append('expiresAt', expiresAt);
        if (notes) fd.append('notes', notes);
        const res = await fetch(`/api/cars/${carId}/documents`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
        uploaded.push(await res.json());
      }
      setDocs((prev) => [...uploaded.reverse(), ...prev]);
      resetForm();
    } catch (e: any) {
      alert(e.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: CarDoc) {
    if (!confirm(`Delete "${doc.label || DOC_TYPES[doc.type]?.label || doc.type}"?`)) return;
    setDeleting(doc.id);
    try {
      await fetch(`/api/cars/${carId}/documents/${doc.id}`, { method: 'DELETE' });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } finally {
      setDeleting(null);
    }
  }

  function getDocUrl(doc: CarDoc) {
    return `/uploads/cars/${carId}/docs/${doc.filename}`;
  }

  // Group docs by label (or fall back to type+id for ungrouped)
  const groups: { key: string; label: string; type: string; docs: CarDoc[] }[] = [];
  const seen = new Map<string, number>();
  for (const doc of docs) {
    const key = doc.label ? `label:${doc.label}:${doc.type}` : `solo:${doc.id}`;
    if (seen.has(key)) {
      groups[seen.get(key)!].docs.push(doc);
    } else {
      seen.set(key, groups.length);
      groups.push({ key, label: doc.label || DOC_TYPES[doc.type]?.label || doc.type, type: doc.type, docs: [doc] });
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">📁 {lang === 'es' ? 'Documentos' : 'Documents'}</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm px-3 py-1.5 rounded-xl bg-amber-500 text-black font-semibold active:bg-amber-400 transition"
          >
            {lang === 'es' ? '+ Agregar' : '+ Add'}
          </button>
        )}
      </div>

      {/* Upload Form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6 space-y-4">

          {/* File picker buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gray-800 border border-gray-700 text-white active:bg-gray-700 transition"
            >
              <span className="text-2xl">📷</span>
              <span className="text-xs text-gray-400">{lang === 'es' ? 'Tomar foto' : 'Take Photo'}</span>
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gray-800 border border-gray-700 text-white active:bg-gray-700 transition"
            >
              <span className="text-2xl">🗂️</span>
              <span className="text-xs text-gray-400">{lang === 'es' ? 'Elegir archivos' : 'Choose Files'}</span>
            </button>
            {/* Camera: single shot */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => addFiles(e.target.files)} />
            {/* File picker: multiple */}
            <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple className="hidden"
              onChange={(e) => addFiles(e.target.files)} />
          </div>

          {/* File preview list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-800 border border-gray-700">
                  <span className="text-xl">{isImage(f.name) ? '🖼️' : '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{f.name}</p>
                    <p className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-gray-500 active:text-red-400 text-lg px-1">✕</button>
                </div>
              ))}
              {/* Tap again to add more */}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full text-xs text-amber-500 border border-dashed border-amber-700/40 rounded-xl py-2 active:bg-amber-900/20 transition"
              >
                + Add more pages
              </button>
            </div>
          )}

          {/* Type */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm">
              {Object.entries(DOC_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Label (optional)</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 2025 Registration"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600" />
            {files.length > 1 && (
              <p className="text-xs text-gray-600 mt-1">Same label groups all pages together in the view</p>
            )}
          </div>

          {/* Expiry */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Expiry date (optional)</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-600 resize-none"
              placeholder="Any notes..." />
          </div>

          <div className="flex gap-3">
            <button onClick={handleUpload} disabled={files.length === 0 || uploading}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-semibold active:bg-amber-400 disabled:opacity-40 transition text-sm">
              {uploading ? `Uploading ${files.length > 1 ? `(1 of ${files.length})` : ''}…` : `Upload${files.length > 1 ? ` ${files.length} pages` : ''}`}
            </button>
            <button onClick={resetForm}
              className="px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 active:bg-gray-700 transition text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Document groups */}
      {groups.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">{lang === 'es' ? 'Sin documentos aún. Toca + Agregar para subir.' : 'No documents yet. Tap + Add to upload.'}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {groups.map((group) => {
            const typeInfo = DOC_TYPES[group.type] || DOC_TYPES.other;
            const primary = group.docs[0];
            const img = isImage(primary.filename);
            const isMulti = group.docs.length > 1;

            return (
              <div key={group.key} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
                {/* Thumbnail */}
                <button
                  className="relative w-full aspect-video bg-gray-800 flex items-center justify-center overflow-hidden"
                  onClick={() => img
                    ? setLightbox({ docs: group.docs, idx: 0 })
                    : window.open(getDocUrl(primary), '_blank')}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getDocUrl(primary)} alt={group.label} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{typeInfo.icon}</span>
                  )}
                  {/* Page count badge */}
                  {isMulti && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full">
                      1/{group.docs.length}
                    </span>
                  )}
                </button>

                <div className="p-3 flex-1 flex flex-col gap-1">
                  <p className="text-sm text-white font-medium truncate">{group.label}</p>
                  <p className="text-xs text-gray-500">{typeInfo.icon} {typeInfo.label}{isMulti ? ` · ${group.docs.length} pages` : ''}</p>
                  <ExpiryBadge expiresAt={primary.expiresAt} />
                </div>

                <button onClick={() => handleDelete(primary)} disabled={deleting === primary.id}
                  className="text-xs text-gray-600 active:text-red-400 px-3 pb-3 text-left transition disabled:opacity-40">
                  {deleting === primary.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox with page swipe */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={() => setLightbox(null)}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-white text-sm font-medium">
              {lightbox.docs[lightbox.idx].label || 'Document'}
              {lightbox.docs.length > 1 && (
                <span className="text-gray-400 ml-2">Page {lightbox.idx + 1} of {lightbox.docs.length}</span>
              )}
            </span>
            <button className="text-white text-2xl leading-none px-2" onClick={() => setLightbox(null)}>✕</button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getDocUrl(lightbox.docs[lightbox.idx])}
              alt=""
              className="max-w-full max-h-full rounded-xl object-contain"
            />
          </div>

          {/* Page nav */}
          {lightbox.docs.length > 1 && (
            <div className="flex gap-3 justify-center pb-safe pb-6 px-4" onClick={(e) => e.stopPropagation()}>
              <button
                disabled={lightbox.idx === 0}
                onClick={() => setLightbox((l) => l && { ...l, idx: l.idx - 1 })}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-white font-semibold disabled:opacity-30 text-sm"
              >
                ← Prev
              </button>
              <button
                disabled={lightbox.idx === lightbox.docs.length - 1}
                onClick={() => setLightbox((l) => l && { ...l, idx: l.idx + 1 })}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-white font-semibold disabled:opacity-30 text-sm"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
