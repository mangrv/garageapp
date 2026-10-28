"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Glyph from "@/app/components/Glyph";

interface LineItem {
  name: string;
  quantity: number;
  amount: number;
}

interface ExtractedData {
  vendor: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  serviceType: string;
  serviceTitle: string;
  notes: string | null;
  lineItems: LineItem[];
}

interface MatchedServiceRecord {
  id: string;
  title: string;
  serviceDate: string;
  serviceType: string | null;
}

interface ReceiptScanFlowProps {
  carId?: string;
  cars: { id: string; year: number; make: string; model: string; trim: string | null }[];
  onDone?: (serviceRecordId: string) => void;
  onClose?: () => void;
}

type FlowState = "idle" | "uploading" | "processing" | "review" | "saving" | "done";

export default function ReceiptScanFlow({ carId: initialCarId, cars, onDone, onClose }: ReceiptScanFlowProps) {
  const [state, setState] = useState<FlowState>("idle");
  const [carId, setCarId] = useState(initialCarId ?? (cars.length === 1 ? cars[0].id : ""));
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [matchedSr, setMatchedSr] = useState<MatchedServiceRecord | null>(null);
  const [selectedSrId, setSelectedSrId] = useState<string>("");
  const [allServiceRecords, setAllServiceRecords] = useState<MatchedServiceRecord[]>([]);
  const [serviceDate, setServiceDate] = useState(""); // separate from purchase/receipt date
  const [doneServiceRecordId, setDoneServiceRecordId] = useState<string | null>(null);
  const [doneTitle, setDoneTitle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Editable extracted fields
  const [editVendor, setEditVendor] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editServiceTitle, setEditServiceTitle] = useState("");
  const [editServiceType, setEditServiceType] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = async (file: File) => {
    setError(null);
    setState("uploading");

    try {
      // Upload the file
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "receipt");

      const uploadRes = await fetch("/api/receipts", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error ?? "Upload failed");

      const rid = uploadData.receipt.id;
      setReceiptId(rid);

      // Process with AI
      setState("processing");
      const processRes = await fetch(`/api/receipts/${rid}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: carId || undefined }),
      });
      const processData = await processRes.json();
      if (!processRes.ok) throw new Error(processData.error ?? "AI processing failed");

      const ext: ExtractedData = processData.extracted;
      setExtracted(ext);
      setMatchedSr(processData.matchedServiceRecord ?? null);
      setSelectedSrId(processData.matchedServiceRecord?.id ?? "");

      // Populate editable fields
      setEditVendor(ext.vendor ?? "");
      setEditDate(ext.receiptDate ?? "");
      setServiceDate(ext.receiptDate ?? ""); // default service date = purchase date, user can change
      setEditTotal(ext.totalAmount?.toString() ?? "");
      setEditServiceTitle(ext.serviceTitle ?? "");
      setEditServiceType(ext.serviceType ?? "other");
      setEditNotes(ext.notes ?? "");
      setEditLineItems(ext.lineItems ?? []);

      // Fetch all service records for this car for the picker
      if (carId) {
        try {
          const srRes = await fetch(`/api/cars/${carId}/service-records`);
          if (srRes.ok) {
            const srData = await srRes.json();
            setAllServiceRecords(srData.serviceRecords ?? []);
          }
        } catch {}
      }

      setState("review");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  };

  const handleConfirm = async () => {
    if (!receiptId) return;
    setState("saving");
    setError(null);

    try {
      const mergedExtracted: ExtractedData = {
        vendor: editVendor || null,
        receiptDate: editDate || null,
        totalAmount: editTotal ? parseFloat(editTotal) : null,
        serviceType: editServiceType,
        serviceTitle: editServiceTitle,
        notes: editNotes || null,
        lineItems: editLineItems,
      };

      const body: Record<string, unknown> = {
        carId,
        extracted: mergedExtracted,
        serviceDate: serviceDate || editDate || null, // separate service date
      };

      if (selectedSrId) {
        body.serviceRecordId = selectedSrId;
      } else {
        body.createNew = true;
      }

      const applyRes = await fetch(`/api/receipts/${receiptId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const applyData = await applyRes.json();
      if (!applyRes.ok) throw new Error(applyData.error ?? "Save failed");

      const srId = applyData.serviceRecord?.id;
      setDoneServiceRecordId(srId ?? null);
      setDoneTitle(applyData.serviceRecord?.title ?? "service record");
      setState("done");

      if (srId && onDone) onDone(srId);
    } catch (e) {
      setError((e as Error).message);
      setState("review");
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setEditLineItems((prev) => prev.map((li, i) => i === index ? { ...li, [field]: value } : li));
  };

  const removeLineItem = (index: number) => {
    setEditLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addLineItem = () => {
    setEditLineItems((prev) => [...prev, { name: "", quantity: 1, amount: 0 }]);
  };

  const handleClose = () => {
    if (onClose) onClose();
    router.refresh();
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const serviceTypes = [
    { value: "oil_change", label: "Oil Change" },
    { value: "tire_rotation", label: "Tire Rotation" },
    { value: "brakes", label: "Brakes" },
    { value: "tires", label: "Tires" },
    { value: "alignment", label: "Alignment" },
    { value: "detailing", label: "Detailing" },
    { value: "inspection", label: "Inspection" },
    { value: "parts", label: "Parts" },
    { value: "other", label: "Other" },
  ];

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {state === "idle" && <>{"🤖 Scan Receipt"}</>}
              {state === "uploading" && "Uploading..."}
              {state === "processing" && "Reading Receipt..."}
              {state === "review" && "Review & Confirm"}
              {state === "saving" && "Saving..."}
              {state === "done" && <>{"✅ Done!"}</>}
            </h2>
            {(state === "idle" || state === "done") && (
              <button onClick={handleClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            )}
          </div>

          {error && (
            <div className="bg-red-950/50 border border-red-800 rounded-xl p-3 text-red-300 text-sm">{error}</div>
          )}

          {/* Idle — file picker */}
          {state === "idle" && (
            <div className="space-y-4">
              {cars.length > 1 && !initialCarId && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Car (optional)</label>
                  <select
                    value={carId}
                    onChange={(e) => setCarId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Any car —</option>
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.year} {c.make} {c.model}{c.trim ? ` ${c.trim}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-xl py-6 text-gray-400 active:border-amber-500/60 active:bg-amber-500/5 transition"
                >
                  <span className="text-3xl"><Glyph e="📷" /></span>
                  <span className="text-xs">Take photo</span>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-xl py-6 text-gray-400 active:border-amber-500/60 active:bg-amber-500/5 transition"
                >
                  <span className="text-3xl"><Glyph e="🗂" /></span>
                  <span className="text-xs">Choose file</span>
                </button>
              </div>

              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

              <button onClick={handleClose} className="w-full py-2 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 transition text-sm">
                Cancel
              </button>
            </div>
          )}

          {/* Uploading / Processing */}
          {(state === "uploading" || state === "processing") && (
            <div className="py-8 text-center space-y-3">
              <div className="text-4xl animate-bounce">{state === "uploading" ? <Glyph e="📤" /> : <Glyph e="🤖" />}</div>
              <p className="text-gray-400 text-sm">
                {state === "uploading" ? "Uploading receipt..." : "Reading receipt with AI..."}
              </p>
              <div className="flex justify-center gap-1">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* Review */}
          {state === "review" && extracted && (
            <div className="space-y-4">
              {/* Car selector (if not pre-filled) */}
              {!initialCarId && cars.length > 1 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Car</label>
                  <select value={carId} onChange={(e) => setCarId(e.target.value)} className={inputCls}>
                    <option value="">— Select car —</option>
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.year} {c.make} {c.model}{c.trim ? ` ${c.trim}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Extracted info */}
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Extracted Info</p>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vendor / Shop</label>
                  <input type="text" value={editVendor} onChange={(e) => setEditVendor(e.target.value)} className={inputCls} placeholder="Vendor name" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Date</label>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Total</label>
                    <input type="number" step="0.01" value={editTotal} onChange={(e) => setEditTotal(e.target.value)} className={inputCls} placeholder="0.00" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Service Title</label>
                  <input type="text" value={editServiceTitle} onChange={(e) => setEditServiceTitle(e.target.value)} className={inputCls} placeholder="e.g. Oil Change & Filter" />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Service Type</label>
                  <select value={editServiceType} onChange={(e) => setEditServiceType(e.target.value)} className={inputCls}>
                    {serviceTypes.map((st) => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="Notes" />
                </div>
              </div>

              {/* Line items */}
              {editLineItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400">Line Items</p>
                  {editLineItems.map((li, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={li.name}
                        onChange={(e) => updateLineItem(i, "name", e.target.value)}
                        placeholder="Item"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none"
                      />
                      <input
                        type="number"
                        value={li.quantity}
                        onChange={(e) => updateLineItem(i, "quantity", parseInt(e.target.value) || 1)}
                        className="w-14 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={li.amount}
                        onChange={(e) => updateLineItem(i, "amount", parseFloat(e.target.value) || 0)}
                        className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none"
                      />
                      <button onClick={() => removeLineItem(i)} className="text-gray-600 hover:text-red-400 text-lg leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={addLineItem} className="text-xs text-amber-400 hover:text-amber-300">+ Add line item</button>

              {/* Dates — purchase vs service */}
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Dates</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1"><Glyph e="📅" /> Purchase date</label>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputCls} />
                    <p className="text-xs text-gray-600 mt-0.5">Date on receipt</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1"><Glyph e="🔧" /> Service date</label>
                    <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputCls} />
                    <p className="text-xs text-gray-600 mt-0.5">When work was done</p>
                  </div>
                </div>
              </div>

              {/* Service Record picker */}
              <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">Link to Service Record</p>

                {matchedSr && (
                  <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2">
                    <span className="text-green-400"><Glyph e="✓" /></span>
                    <p className="text-xs text-green-300">Auto-matched: <strong>{matchedSr.title}</strong> · {new Date(matchedSr.serviceDate).toLocaleDateString()}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {allServiceRecords.length > 0 ? "Select existing record or create new" : "Service record"}
                  </label>
                  <select
                    value={selectedSrId}
                    onChange={(e) => setSelectedSrId(e.target.value)}
                    className={inputCls}
                  >
                    <option value=""><Glyph e="➕" /> Create new service record</option>
                    {matchedSr && (
                      <option value={matchedSr.id}>
                        <Glyph e="✓" /> {matchedSr.title} — {new Date(matchedSr.serviceDate).toLocaleDateString()} (matched)
                      </option>
                    )}
                    {allServiceRecords
                      .filter((sr) => sr.id !== matchedSr?.id)
                      .map((sr) => (
                        <option key={sr.id} value={sr.id}>
                          {sr.title} — {new Date(sr.serviceDate).toLocaleDateString()}
                        </option>
                      ))}
                  </select>
                </div>

                {!selectedSrId && (
                  <p className="text-xs text-gray-500">
                    Will create: <span className="text-white">{editServiceTitle || "New service record"}</span>
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setState("idle")}
                  className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 transition text-sm"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-on-accent font-semibold hover:bg-amber-400 transition text-sm"
                >
                  Confirm & Save
                </button>
              </div>
            </div>
          )}

          {/* Saving */}
          {state === "saving" && (
            <div className="py-8 text-center space-y-3">
              <div className="text-4xl"><Glyph e="💾" /></div>
              <p className="text-gray-400 text-sm">Saving...</p>
            </div>
          )}

          {/* Done */}
          {state === "done" && (
            <div className="py-6 text-center space-y-4">
              <div className="text-5xl"><Glyph e="✅" /></div>
              <div>
                <p className="text-white font-semibold">Receipt saved!</p>
                <p className="text-gray-400 text-sm mt-1">{doneTitle}</p>
              </div>
              <div className="flex gap-3">
                {doneServiceRecordId && (
                  <a
                    href={`#`}
                    onClick={() => {
                      router.refresh();
                      handleClose();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 text-on-accent font-semibold text-sm text-center"
                  >
                    View Record
                  </a>
                )}
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 transition text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
