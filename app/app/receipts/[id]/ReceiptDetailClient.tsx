"use client";

import { useState, useRef } from "react";
import { useT } from "@/app/hooks/useT";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trackMatomoEvent } from "@/app/lib/matomo";
import Glyph from "@/app/components/Glyph";

interface LineItem {
  id: string;
  name: string;
  amount?: number | null;
  quantity: number;
  notes?: string | null;
  warrantyProvider?: string | null;
  warrantyStart?: string | Date | null;
  warrantyEnd?: string | Date | null;
  warrantyNotes?: string | null;
  task?: { id: string; title: string } | null;
  taskId?: string | null;
}

interface Receipt {
  id: string;
  vendor?: string | null;
  totalAmount?: number | null;
  receiptDate?: string | null;
  notes?: string | null;
  status: string;
  filename?: string | null;
  jobId?: string | null;
  serviceRecordId?: string | null;
  job?: { id: string; title: string } | null;
  serviceRecord?: { id: string; title: string } | null;
  lineItems: LineItem[];
}

interface Props {
  receipt: Receipt;
  cars: { id: string; year: number; make: string; model: string }[];
  jobs: { id: string; title: string; carId: string | null; createdAt: string }[];
  tasks: { id: string; title: string }[];
  serviceRecords: { id: string; title: string; serviceDate: string; carId: string | null }[];
}

export default function ReceiptDetailClient({ receipt: initial, cars, jobs, tasks, serviceRecords }: Props) {
  const t = useT();
  const [receipt, setReceipt] = useState<Receipt>(initial);
  const [editing, setEditing] = useState(false);
  const [vendor, setVendor] = useState(initial.vendor ?? "");
  const [totalAmount, setTotalAmount] = useState(initial.totalAmount?.toString() ?? "");
  const [receiptDate, setReceiptDate] = useState(
    initial.receiptDate ? initial.receiptDate.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Link panel
  const [linkJobId, setLinkJobId] = useState(initial.jobId ?? "");
  const [linkSrId, setLinkSrId] = useState(initial.serviceRecordId ?? "");
  const [creatingNewJob, setCreatingNewJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState("");

  // Derive initial car from the already-linked job or service record
  const initialCarId =
    jobs.find(j => j.id === initial.jobId)?.carId ??
    serviceRecords.find(sr => sr.id === initial.serviceRecordId)?.carId ??
    (cars.length === 1 ? cars[0].id : "");
  const [selectedCarId, setSelectedCarId] = useState<string>(initialCarId);

  // Line item form
  const [liName, setLiName] = useState("");
  const [liAmount, setLiAmount] = useState("");
  const [liQty, setLiQty] = useState("1");
  const [liTaskId, setLiTaskId] = useState("");
  const [liNotes, setLiNotes] = useState("");
  const [liWarrantyProvider, setLiWarrantyProvider] = useState("");
  const [liWarrantyStart, setLiWarrantyStart] = useState("");
  const [liWarrantyEnd, setLiWarrantyEnd] = useState("");
  const [liWarrantyNotes, setLiWarrantyNotes] = useState("");
  const [addingLi, setAddingLi] = useState(false);

  const router = useRouter();

  const patchReceipt = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/receipts/${receipt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) setReceipt(data.receipt);
    return res.ok;
  };

  const saveEdits = async () => {
    setSaving(true);
    await patchReceipt({
      vendor: vendor || null,
      totalAmount: totalAmount ? parseFloat(totalAmount) : null,
      receiptDate: receiptDate || null,
      notes: notes || null,
    });
    setSaving(false);
    setEditing(false);
  };

  const saveLink = async () => {
    setSaving(true);
    try {
      let resolvedJobId = linkJobId || null;

      if (creatingNewJob && newJobTitle.trim() && selectedCarId) {
        const res = await fetch(`/api/cars/${selectedCarId}/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newJobTitle.trim() }),
        });
        const data = await res.json();
        if (!res.ok || !data.job) throw new Error(data.error || "Failed to create job");
        resolvedJobId = data.job.id;
        setCreatingNewJob(false);
        setNewJobTitle("");
        setLinkJobId(resolvedJobId ?? "");
      }

      await patchReceipt({
        jobId: resolvedJobId,
        serviceRecordId: linkSrId || null,
      });
    } catch (e) {
      alert("Error: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteReceipt = async () => {
    if (!confirm("Delete this receipt permanently?")) return;
    await fetch(`/api/receipts/${receipt.id}`, { method: "DELETE" });
    router.push("/dashboard");
  };

  const addLineItem = async () => {
    if (!liName.trim()) return;
    setAddingLi(true);
    const res = await fetch(`/api/receipts/${receipt.id}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: liName.trim(),
        amount: liAmount ? parseFloat(liAmount) : null,
        quantity: parseInt(liQty) || 1,
        taskId: liTaskId || null,
        notes: liNotes || null,
        warrantyProvider: liWarrantyProvider || null,
        warrantyStart: liWarrantyStart || null,
        warrantyEnd: liWarrantyEnd || null,
        warrantyNotes: liWarrantyNotes || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setReceipt((prev) => ({ ...prev, lineItems: [...prev.lineItems, data.lineItem] }));
      setLiName(""); setLiAmount(""); setLiQty("1"); setLiTaskId(""); setLiNotes("");
      setLiWarrantyProvider(""); setLiWarrantyStart(""); setLiWarrantyEnd(""); setLiWarrantyNotes("");
    }
    setAddingLi(false);
  };

  const [editingLi, setEditingLi] = useState<string | null>(null);
  const [editLiName, setEditLiName] = useState("");
  const [editLiAmount, setEditLiAmount] = useState("");
  const [editLiQty, setEditLiQty] = useState("1");
  const [editLiWarrantyProvider, setEditLiWarrantyProvider] = useState("");
  const [editLiWarrantyStart, setEditLiWarrantyStart] = useState("");
  const [editLiWarrantyEnd, setEditLiWarrantyEnd] = useState("");
  const [editLiWarrantyNotes, setEditLiWarrantyNotes] = useState("");
  const [savingLi, setSavingLi] = useState(false);

  const startEditLi = (li: typeof receipt.lineItems[number]) => {
    setEditingLi(li.id);
    setEditLiName(li.name);
    setEditLiAmount(li.amount?.toString() ?? "");
    setEditLiQty(li.quantity.toString());
    setEditLiWarrantyProvider(li.warrantyProvider ?? "");
    setEditLiWarrantyStart(li.warrantyStart ? new Date(li.warrantyStart).toISOString().slice(0, 10) : "");
    setEditLiWarrantyEnd(li.warrantyEnd ? new Date(li.warrantyEnd).toISOString().slice(0, 10) : "");
    setEditLiWarrantyNotes(li.warrantyNotes ?? "");
  };

  const saveEditLi = async (liId: string) => {
    setSavingLi(true);
    const res = await fetch(`/api/receipts/${receipt.id}/line-items/${liId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editLiName,
        amount: editLiAmount ? parseFloat(editLiAmount) : null,
        quantity: parseInt(editLiQty) || 1,
        warrantyProvider: editLiWarrantyProvider || null,
        warrantyStart: editLiWarrantyStart || null,
        warrantyEnd: editLiWarrantyEnd || null,
        warrantyNotes: editLiWarrantyNotes || null,
      }),
    });
    const data = await res.json();
    const updated = data.lineItem ?? data;
    setReceipt((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li) => li.id === liId ? { ...li, ...updated } : li),
    }));
    setEditingLi(null);
    setSavingLi(false);
  };

  const deleteLineItem = async (liId: string) => {
    await fetch(`/api/receipts/${receipt.id}/line-items/${liId}`, { method: "DELETE" });
    setReceipt((prev) => ({ ...prev, lineItems: prev.lineItems.filter((l) => l.id !== liId) }));
  };

  const [attachingPhoto, setAttachingPhoto] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleAttachPhoto = async (file: File) => {
    setAttachingPhoto(true);
    trackMatomoEvent("Receipt", "Attach File", file.type || "unknown");
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Upload as a new receipt to get a filename, then steal just the filename
      // Actually: PATCH the existing receipt with a new file
      const res = await fetch(`/api/receipts/${receipt.id}/attach-photo`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReceipt((prev) => ({ ...prev, filename: data.filename }));
      trackMatomoEvent("Receipt", "Attach Success", file.type || "unknown");
    } catch (e) {
      trackMatomoEvent("Receipt", "Attach Error", (e as Error).message);
      alert("Error: " + (e as Error).message);
    } finally {
      setAttachingPhoto(false);
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    setProcessError(null);
    setProcessStatus("Processing receipt...");
    trackMatomoEvent("Receipt", "Process Start", receipt.id);
    try {
      const res = await fetch(`/api/receipts/${receipt.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");
      if (data.extracted) {
        const x = data.extracted;
        setReceipt((prev) => ({
          ...prev,
          vendor: x.vendor ?? prev.vendor,
          totalAmount: x.totalAmount ?? prev.totalAmount,
          receiptDate: x.receiptDate ?? prev.receiptDate,
          notes: x.notes ?? prev.notes,
        }));
        if (x.vendor) setVendor(x.vendor);
        if (x.totalAmount) setTotalAmount(String(x.totalAmount));
        if (x.receiptDate) setReceiptDate(x.receiptDate);
        if (x.notes) setNotes(x.notes);
      }
      const method = data.method ? String(data.method).toUpperCase() : "AI";
      setProcessStatus(`Done. Parsed with ${method}.`);
      trackMatomoEvent("Receipt", "Process Success", method);
    } catch (e) {
      const msg = (e as Error).message;
      setProcessError(msg);
      setProcessStatus(null);
      trackMatomoEvent("Receipt", "Process Error", msg);
    } finally {
      setReprocessing(false);
    }
  };

  const isImage = receipt.filename && /\.(jpg|jpeg|png|gif|webp)$/i.test(receipt.filename);
  const lineTotal = receipt.lineItems.reduce((s, li) => s + (li.amount ?? 0) * li.quantity, 0);
  const diff = receipt.totalAmount != null ? receipt.totalAmount - lineTotal : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/receipts" className="text-gray-500 hover:text-white transition">← Inbox</Link>
          <h1 className="text-xl font-bold flex-1">Receipt Detail</h1>
          <button onClick={deleteReceipt} className="text-red-400 hover:text-red-300 text-sm transition">Delete</button>
        </div>

        {/* Image — shown if filename exists */}
        {isImage && (
          <div className="rounded-2xl overflow-hidden border border-gray-800 relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/uploads/${receipt.filename}`} alt="receipt" className="w-full max-h-96 object-contain bg-gray-900" />
            {/* Replace photo overlay */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 active:opacity-100 transition"
            >
              <Glyph e="📷" /> Replace photo
            </button>
          </div>
        )}
        {receipt.filename && !isImage && (
          <a
            href={`/uploads/${receipt.filename}`}
            target="_blank"
            rel="noreferrer"
            className="block p-4 bg-gray-900 border border-gray-800 rounded-2xl text-amber-400 hover:border-amber-500/30 transition"
          >
            <Glyph e="📄" /> View PDF
          </a>
        )}

        {/* No photo yet — big attach prompt */}
        {!receipt.filename && (
          <div className="bg-gray-900 border-2 border-dashed border-gray-700 rounded-2xl p-5">
            <p className="text-sm text-gray-500 text-center mb-3">No receipt image attached</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={attachingPhoto}
                className="flex flex-col items-center gap-1.5 py-4 rounded-xl border border-gray-700 text-gray-400 active:bg-gray-800 transition disabled:opacity-40"
              >
                <span className="text-2xl"><Glyph e="📷" /></span>
                <span className="text-xs">{attachingPhoto ? "Uploading…" : "Take photo"}</span>
              </button>
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={attachingPhoto}
                className="flex flex-col items-center gap-1.5 py-4 rounded-xl border border-gray-700 text-gray-400 active:bg-gray-800 transition disabled:opacity-40"
              >
                <span className="text-2xl"><Glyph e="🗂" /></span>
                <span className="text-xs">{attachingPhoto ? "Uploading…" : "Choose file"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Re-read with AI button — shown when image exists */}
        {receipt.filename && (
          <div className="space-y-2">
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="w-full py-2 rounded-xl bg-gray-800 border border-gray-700 text-sm text-amber-400 disabled:opacity-40 active:bg-gray-700 transition"
            >
              {reprocessing ? <>{"🤖 Processing…"}</> : <>{"🤖 Process receipt"}</>}
            </button>
            {processStatus && <p className="text-xs text-emerald-400">{processStatus}</p>}
            {processError && <p className="text-xs text-red-400">{processError}</p>}
          </div>
        )}

        {/* Hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAttachPhoto(f); }} />
        <input ref={photoInputRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAttachPhoto(f); }} />

        {/* Details */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-300">Details</h2>
            <button
              onClick={() => setEditing(!editing)}
              className="text-sm text-amber-400 hover:text-amber-300 transition"
            >
              {editing ? t("cancel") : t("edit")}
            </button>
          </div>

          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                placeholder={t("vendor")}
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none"
              />
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="Total ($)"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none"
                />
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none"
                />
              </div>
              <textarea
                placeholder={t("notes")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none resize-none"
              />
              <button
                onClick={saveEdits}
                disabled={saving}
                className="w-full py-2 rounded-xl bg-amber-500 text-on-accent font-semibold hover:bg-amber-400 transition disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Vendor</dt>
                <dd className="text-white">{receipt.vendor ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Date</dt>
                <dd className="text-white">
                  {receipt.receiptDate ? new Date(receipt.receiptDate).toLocaleDateString() : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total</dt>
                <dd className="text-amber-400 font-semibold">
                  {receipt.totalAmount != null ? `$${receipt.totalAmount.toFixed(2)}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    receipt.status === "inbox"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-green-500/20 text-green-400"
                  }`}>{receipt.status}</span>
                </dd>
              </div>
              {receipt.notes && (
                <div>
                  <dt className="text-gray-500 mb-1">Notes</dt>
                  <dd className="text-white">{receipt.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* Link section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-300">Linked To</h2>

          {/* Current links display */}
          {receipt.job && (
            <p className="text-sm text-white">
              <span className="text-gray-500">Job: </span>
              <Link href={`/job/${receipt.job.id}`} className="text-amber-400 hover:underline">{receipt.job.title}</Link>
            </p>
          )}
          {receipt.serviceRecord && (
            <p className="text-sm text-white">
              <span className="text-gray-500">Service Record: </span>
              {receipt.serviceRecord.title}
            </p>
          )}

          <div className="space-y-2 pt-2 border-t border-gray-800">

            {/* Step 1: Car picker */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">1. Select vehicle</label>
              <select
                value={selectedCarId}
                onChange={(e) => {
                  setSelectedCarId(e.target.value);
                  setLinkJobId("");
                  setLinkSrId("");
                  setCreatingNewJob(false);
                  setNewJobTitle("");
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none text-sm"
              >
                <option value="">— pick a vehicle —</option>
                {cars.map(c => (
                  <option key={c.id} value={c.id}>{c.year} {c.make} {c.model}</option>
                ))}
              </select>
            </div>

            {/* Step 2: Job picker — filtered + sorted by year */}
            {selectedCarId && (() => {
              const carJobs = jobs
                .filter(j => j.carId === selectedCarId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

              // Group by year
              const byYear: Record<string, typeof carJobs> = {};
              for (const j of carJobs) {
                const yr = new Date(j.createdAt).getFullYear().toString();
                if (!byYear[yr]) byYear[yr] = [];
                byYear[yr].push(j);
              }
              const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

              return (
                <div className="space-y-2">
                  <label className="text-xs text-gray-500 block mb-1">2. Link to job (optional)</label>
                  {!creatingNewJob && (
                    <select
                      value={linkJobId}
                      onChange={(e) => { setLinkJobId(e.target.value); setLinkSrId(""); }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none text-sm"
                    >
                      <option value="">— no job —</option>
                      {years.map(yr => (
                        <optgroup key={yr} label={yr}>
                          {byYear[yr].map(j => (
                            <option key={j.id} value={j.id}>{j.title}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}

                  {creatingNewJob ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="New job title…"
                        value={newJobTitle}
                        onChange={(e) => setNewJobTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Escape") { setCreatingNewJob(false); setNewJobTitle(""); } }}
                        className="flex-1 bg-gray-800 border border-amber-500/50 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => { setCreatingNewJob(false); setNewJobTitle(""); }}
                        className="px-3 py-2 text-gray-500 hover:text-white text-xs rounded-xl bg-gray-800 border border-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setCreatingNewJob(true); setLinkJobId(""); setLinkSrId(""); }}
                      className="w-full py-2 rounded-xl border border-dashed border-gray-600 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition text-xs"
                    >
                      ＋ Create new job
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Step 2 alt: Service record picker — filtered + sorted by year */}
            {selectedCarId && (() => {
              const carSrs = serviceRecords
                .filter(sr => sr.carId === selectedCarId)
                .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

              const byYear: Record<string, typeof carSrs> = {};
              for (const sr of carSrs) {
                const yr = new Date(sr.serviceDate).getFullYear().toString();
                if (!byYear[yr]) byYear[yr] = [];
                byYear[yr].push(sr);
              }
              const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));

              return (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">— or link to service record —</label>
                  <select
                    value={linkSrId}
                    onChange={(e) => { setLinkSrId(e.target.value); setLinkJobId(""); }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none text-sm"
                  >
                    <option value="">— no service record —</option>
                    {years.map(yr => (
                      <optgroup key={yr} label={yr}>
                        {byYear[yr].map(sr => (
                          <option key={sr.id} value={sr.id}>
                            {sr.title} · {(() => { const [y,m,d] = sr.serviceDate.slice(0,10).split("-").map(Number); return new Date(y, m-1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); })()}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              );
            })()}

            <button
              onClick={saveLink}
              disabled={saving || !selectedCarId}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-on-accent font-semibold hover:bg-amber-400 transition text-sm disabled:opacity-40"
            >
              {saving ? "Saving…" : "Update Link"}
            </button>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-300">Line Items</h2>

          {receipt.lineItems.length > 0 ? (
            <div className="space-y-2">
              {receipt.lineItems.map((li) => (
                <div key={li.id} className="p-3 bg-gray-800 rounded-xl space-y-2">
                  {editingLi === li.id ? (
                    <>
                      <input
                        value={editLiName}
                        onChange={(e) => setEditLiName(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
                        placeholder="Item name"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={editLiQty}
                          onChange={(e) => setEditLiQty(e.target.value)}
                          className="w-16 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white"
                          placeholder="Qty"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editLiAmount}
                          onChange={(e) => setEditLiAmount(e.target.value)}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
                          placeholder={t("amount")}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          value={editLiWarrantyProvider}
                          onChange={(e) => setEditLiWarrantyProvider(e.target.value)}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
                          placeholder={t("warrantyProvider")}
                        />
                        <input
                          type="date"
                          value={editLiWarrantyEnd}
                          onChange={(e) => setEditLiWarrantyEnd(e.target.value)}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
                        />
                      </div>
                      <input
                        type="date"
                        value={editLiWarrantyStart}
                        onChange={(e) => setEditLiWarrantyStart(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
                      />
                      <input
                        value={editLiWarrantyNotes}
                        onChange={(e) => setEditLiWarrantyNotes(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white"
                        placeholder={t("warrantyNotes")}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEditLi(li.id)} disabled={savingLi}
                          className="flex-1 py-1.5 bg-amber-500 text-on-accent font-semibold rounded-lg text-xs disabled:opacity-40">
                          {savingLi ? "…" : t("save")}
                        </button>
                        <button onClick={() => setEditingLi(null)}
                          className="flex-1 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs">
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{li.name}</p>
                        {li.task && <p className="text-xs text-amber-400">{li.task.title}</p>}
                        {li.notes && <p className="text-xs text-gray-500">{li.notes}</p>}
                        {(li.warrantyProvider || li.warrantyEnd) && (
                          <p className="text-xs text-sky-400">
                            <Glyph e="🛡" /> {li.warrantyProvider || t("warranty")}
                            {li.warrantyEnd ? ` · until ${new Date(li.warrantyEnd).toLocaleDateString()}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white text-sm">
                          {li.quantity > 1 && <span className="text-gray-500">{li.quantity}× </span>}
                          {li.amount != null ? `$${(li.amount * li.quantity).toFixed(2)}` : "—"}
                        </p>
                      </div>
                      <button onClick={() => startEditLi(li)} className="text-gray-600 active:text-amber-400 text-sm"><Glyph e="✏" /></button>
                      <button onClick={() => deleteLineItem(li.id)} className="text-gray-600 active:text-red-400 text-sm"><Glyph e="✕" /></button>
                    </div>
                  )}
                </div>
              ))}

              {/* Totals */}
              <div className="pt-2 border-t border-gray-700 space-y-1 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Line items total</span>
                  <span>${lineTotal.toFixed(2)}</span>
                </div>
                {receipt.totalAmount != null && (
                  <div className="flex justify-between text-gray-400">
                    <span>Receipt total</span>
                    <span className="text-amber-400">${receipt.totalAmount.toFixed(2)}</span>
                  </div>
                )}
                {diff != null && Math.abs(diff) > 0.01 && (
                  <div className="flex justify-between">
                    <span className="text-red-400">Difference</span>
                    <span className="text-red-400">${diff.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No line items yet.</p>
          )}

          {/* Add line item form */}
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Add Line Item</p>
            <input
              type="text"
              placeholder="Item name"
              value={liName}
              onChange={(e) => setLiName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none text-sm"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder={t("amount")}
                value={liAmount}
                onChange={(e) => setLiAmount(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none text-sm"
              />
              <input
                type="number"
                placeholder="Qty"
                value={liQty}
                onChange={(e) => setLiQty(e.target.value)}
                min="1"
                className="w-20 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none text-sm"
              />
            </div>
            {tasks.length > 0 && (
              <select
                value={liTaskId}
                onChange={(e) => setLiTaskId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none text-sm"
              >
                <option value="">— link to task (optional) —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              placeholder="Notes (optional)"
              value={liNotes}
              onChange={(e) => setLiNotes(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none text-sm"
            />
            <input
              type="text"
              placeholder={t("warrantyProvider")}
              value={liWarrantyProvider}
              onChange={(e) => setLiWarrantyProvider(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={liWarrantyStart}
                onChange={(e) => setLiWarrantyStart(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none text-sm"
              />
              <input
                type="date"
                value={liWarrantyEnd}
                onChange={(e) => setLiWarrantyEnd(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none text-sm"
              />
            </div>
            <input
              type="text"
              placeholder={t("warrantyNotes")}
              value={liWarrantyNotes}
              onChange={(e) => setLiWarrantyNotes(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none text-sm"
            />
            <button
              onClick={addLineItem}
              disabled={addingLi || !liName.trim()}
              className="w-full py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition text-sm disabled:opacity-50"
            >
              {addingLi ? "Adding…" : "+ Add Line Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
