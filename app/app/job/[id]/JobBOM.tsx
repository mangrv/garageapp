"use client";

import { useState } from "react";
import { Package, Plus, X, ChevronDown, ChevronUp, Edit2, ShoppingCart, Receipt } from "lucide-react";
import Glyph from "@/app/components/Glyph";

type BomItem = {
  id: string;
  name: string;
  partNumber: string | null;
  vendor: string | null;
  quantity: number;
  unitCost: number | null;
  status: string;
  notes: string | null;
  source?: "manual";
};

type ReceiptLineItem = {
  id: string;
  name: string;
  amount: number | null;
  quantity: number;
  notes: string | null;
  warrantyProvider: string | null;
  warrantyEnd: string | null;
  vendor: string | null;
};

type TaskPartNote = {
  taskId: string;
  taskTitle: string;
  phaseTitle: string;
  partsNote: string;
  partsCost: number | null;
};

const STATUS_CONFIG = {
  needed:    { label: "Needed",    color: "bg-gray-700 text-gray-300",       next: "ordered"   },
  ordered:   { label: "Ordered",   color: "bg-blue-900 text-blue-400",       next: "received"  },
  received:  { label: "Received",  color: "bg-amber-900 text-amber-400",     next: "installed" },
  installed: { label: "Installed", color: "bg-emerald-900 text-emerald-400", next: null        },
} as const;

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function StatusBadge({ status, onClick }: { status: string; onClick?: () => void }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.needed;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color} ${onClick ? "cursor-pointer hover:opacity-80 active:scale-95" : "cursor-default"} transition-all`}
      title={onClick ? `Click to mark as ${STATUS_CONFIG[cfg.next as keyof typeof STATUS_CONFIG]?.label ?? "next"}` : undefined}
    >
      {cfg.label}
    </button>
  );
}

function AddItemForm({ jobId, onAdd }: { jobId: string; onAdd: (item: BomItem) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [vendor, setVendor] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const cls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500";

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/bom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, partNumber, vendor, quantity: qty, unitCost: cost, notes }),
      });
      const data = await res.json();
      if (data.item) {
        onAdd(data.item);
        setName(""); setPartNumber(""); setVendor(""); setQty("1"); setCost(""); setNotes("");
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 py-1"
      >
        <Plus size={13} /> Add part
      </button>
    );
  }

  return (
    <div className="bg-gray-900 border border-amber-600/50 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-amber-400">Add Part</p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Part name *" className={cls} />
      <div className="grid grid-cols-2 gap-2">
        <input value={partNumber} onChange={e => setPartNumber(e.target.value)} placeholder="Part # (optional)" className={cls} />
        <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Vendor" className={cls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="1" placeholder="Qty" className={cls} />
        <input type="number" value={cost} onChange={e => setCost(e.target.value)} step="0.01" placeholder="Unit cost $" className={cls} />
      </div>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" className={cls} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !name.trim()}
          className="flex-1 bg-amber-500 text-on-accent font-bold text-xs py-2 rounded-lg disabled:opacity-40">
          {saving ? "Saving…" : "Add to BOM"}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-2 bg-gray-800 text-gray-400 text-xs rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}

function BomRow({ item, jobId, onUpdate, onDelete }: {
  item: BomItem;
  jobId: string;
  onUpdate: (updated: BomItem) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [partNumber, setPartNumber] = useState(item.partNumber ?? "");
  const [vendor, setVendor] = useState(item.vendor ?? "");
  const [qty, setQty] = useState(String(item.quantity));
  const [cost, setCost] = useState(item.unitCost != null ? String(item.unitCost) : "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.needed;
  const nextStatus = cfg.next;

  const advanceStatus = async () => {
    if (!nextStatus) return;
    const res = await fetch(`/api/jobs/${jobId}/bom/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) onUpdate({ ...item, status: nextStatus });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/bom/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, partNumber, vendor, quantity: qty, unitCost: cost, notes }),
      });
      const data = await res.json();
      if (data.item) { onUpdate(data.item); setEditing(false); }
    } finally { setSaving(false); }
  };

  const del = async () => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await fetch(`/api/jobs/${jobId}/bom/${item.id}`, { method: "DELETE" });
    onDelete(item.id);
  };

  const total = item.unitCost != null ? item.unitCost * item.quantity : null;
  const cls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500";

  if (editing) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 space-y-2">
        <input value={name} onChange={e => setName(e.target.value)} className={cls} placeholder="Part name" />
        <div className="grid grid-cols-2 gap-2">
          <input value={partNumber} onChange={e => setPartNumber(e.target.value)} className={cls} placeholder="Part #" />
          <input value={vendor} onChange={e => setVendor(e.target.value)} className={cls} placeholder="Vendor" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} className={cls} placeholder="Qty" />
          <input type="number" value={cost} onChange={e => setCost(e.target.value)} step="0.01" className={cls} placeholder="Unit cost" />
        </div>
        <input value={notes} onChange={e => setNotes(e.target.value)} className={cls} placeholder="Notes" />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 bg-amber-500 text-on-accent font-bold text-xs py-1.5 rounded-lg disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-gray-800 text-gray-400 text-xs rounded-lg">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-800 last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-white">{item.name}</span>
          {item.partNumber && <span className="text-[10px] text-gray-600 font-mono">#{item.partNumber}</span>}
        </div>
        {item.vendor && <p className="text-[11px] text-gray-500 mt-0.5">{item.vendor}</p>}
        {item.notes && <p className="text-[11px] text-gray-600 mt-0.5 italic">{item.notes}</p>}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <StatusBadge status={item.status} onClick={nextStatus ? advanceStatus : undefined} />
          <span className="text-[11px] text-gray-500">Qty: {item.quantity}</span>
          {item.unitCost != null && <span className="text-[11px] text-gray-500">{fmt(item.unitCost)} ea.</span>}
          {total != null && <span className="text-[11px] text-amber-400 font-semibold">{fmt(total)}</span>}
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-1 text-gray-500 hover:text-amber-400"><Edit2 size={12} /></button>
        <button onClick={del} className="p-1 text-gray-500 hover:text-red-400"><X size={12} /></button>
      </div>
    </div>
  );
}

export default function JobBOM({
  jobId,
  initialItems,
  receiptItems,
  taskParts,
  laborTotal,
}: {
  jobId: string;
  initialItems: BomItem[];
  receiptItems: ReceiptLineItem[];
  taskParts: TaskPartNote[];
  laborTotal: number;
}) {
  const [items, setItems] = useState<BomItem[]>(initialItems);
  const [showReceipts, setShowReceipts] = useState(true);
  const [showTaskParts, setShowTaskParts] = useState(true);

  const manualTotal = items.reduce((s, i) => s + (i.unitCost != null ? i.unitCost * i.quantity : 0), 0);
  const receiptTotal = receiptItems.reduce((s, i) => s + (i.amount != null ? i.amount * i.quantity : 0), 0);
  const taskPartsTotal = taskParts.reduce((s, t) => s + (t.partsCost ?? 0), 0);
  const partsTotal = manualTotal + receiptTotal + taskPartsTotal;
  const grandTotal = partsTotal + laborTotal;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Package size={15} className="text-amber-400 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-white">Parts List / BOM</h3>
        <span className="text-xs text-gray-500">
          {items.length + receiptItems.length} parts · {fmt(partsTotal)} total
        </span>
      </div>

      {/* Manual BOM Items */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="px-3 pt-3 pb-2 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <ShoppingCart size={11} /> Shopping List
          </span>
          <span className="text-xs text-gray-600">{items.length} items</span>
        </div>
        <div className="px-3 pb-2">
          {items.length === 0 && (
            <p className="text-xs text-gray-600 py-3 text-center">Add parts you need to buy or track</p>
          )}
          {items.map(item => (
            <BomRow
              key={item.id}
              item={item}
              jobId={jobId}
              onUpdate={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
              onDelete={id => setItems(prev => prev.filter(i => i.id !== id))}
            />
          ))}
          <div className="pt-2">
            <AddItemForm jobId={jobId} onAdd={item => setItems(prev => [...prev, item])} />
          </div>
        </div>
      </div>

      {/* Receipt Line Items */}
      {receiptItems.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <button
            onClick={() => setShowReceipts(r => !r)}
            className="w-full px-3 pt-3 pb-2 border-b border-gray-800 flex items-center justify-between"
          >
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <Receipt size={11} /> Purchased (from receipts)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 font-semibold">{fmt(receiptTotal)}</span>
              {showReceipts ? <ChevronUp size={12} className="text-gray-600" /> : <ChevronDown size={12} className="text-gray-600" />}
            </div>
          </button>
          {showReceipts && (
            <div className="px-3 pb-2 divide-y divide-gray-800">
              {receiptItems.map(li => (
                <div key={li.id} className="py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white leading-snug">{li.name}</p>
                      {li.vendor && <p className="text-[11px] text-gray-500 mt-0.5">{li.vendor}</p>}
                      {li.notes && <p className="text-[11px] text-gray-600 italic mt-0.5">{li.notes}</p>}
                      {li.warrantyProvider && li.warrantyEnd && (
                        <p className="text-[10px] text-blue-400 mt-0.5">
                          <Glyph e="🛡" /> Warranty: {li.warrantyProvider} · until {new Date(li.warrantyEnd).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-[11px] text-gray-400">
                        {li.quantity > 1 ? `${li.quantity} × ` : ""}{fmt(li.amount)}
                      </span>
                      {li.quantity > 1 && li.amount != null && (
                        <p className="text-[11px] text-amber-400 font-semibold">{fmt(li.amount * li.quantity)}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 font-medium"><Glyph e="✅" /> Purchased</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Parts Notes */}
      {taskParts.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <button
            onClick={() => setShowTaskParts(r => !r)}
            className="w-full px-3 pt-3 pb-2 border-b border-gray-800 flex items-center justify-between"
          >
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide"><Glyph e="📋" /> Task Parts Notes</span>
            <div className="flex items-center gap-2">
              {taskPartsTotal > 0 && <span className="text-xs text-amber-400 font-semibold">{fmt(taskPartsTotal)}</span>}
              {showTaskParts ? <ChevronUp size={12} className="text-gray-600" /> : <ChevronDown size={12} className="text-gray-600" />}
            </div>
          </button>
          {showTaskParts && (
            <div className="px-3 pb-2 divide-y divide-gray-800">
              {taskParts.map(tp => (
                <div key={tp.taskId} className="py-2">
                  <p className="text-[11px] text-gray-500">{tp.phaseTitle} › {tp.taskTitle}</p>
                  <p className="text-sm text-white mt-0.5">{tp.partsNote}</p>
                  {tp.partsCost != null && (
                    <p className="text-[11px] text-amber-400 mt-0.5 font-semibold">{fmt(tp.partsCost)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-1.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Summary</p>
        {receiptTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Purchased parts</span>
            <span className="text-white">{fmt(receiptTotal)}</span>
          </div>
        )}
        {manualTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Planned parts</span>
            <span className="text-white">{fmt(manualTotal)}</span>
          </div>
        )}
        {taskPartsTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Task parts est.</span>
            <span className="text-white">{fmt(taskPartsTotal)}</span>
          </div>
        )}
        {laborTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Labor</span>
            <span className="text-white">{fmt(laborTotal)}</span>
          </div>
        )}
        <div className="border-t border-gray-700 pt-1.5 flex justify-between font-bold">
          <span className="text-white">Grand Total</span>
          <span className="text-amber-400 text-base">{fmt(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
