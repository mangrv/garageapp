"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ReceiptCard from "@/app/components/ReceiptCard";
import ReceiptUploadButton from "@/app/components/ReceiptUploadButton";
import ReceiptScanFlow from "@/app/components/ReceiptScanFlow";

interface Receipt {
  id: string;
  vendor?: string | null;
  totalAmount?: number | null;
  receiptDate?: string | null;
  status: string;
  filename?: string | null;
  lineItems?: { id: string }[];
  job?: { id: string; title: string } | null;
  serviceRecord?: { id: string; title: string } | null;
}

interface ReceiptInboxClientProps {
  initialReceipts: Receipt[];
  jobs: { id: string; title: string }[];
  serviceRecords: { id: string; title: string; serviceDate: string }[];
  cars: { id: string; year: number; make: string; model: string; trim: string | null }[];
  autoScan?: boolean;
}

export default function ReceiptInboxClient({
  initialReceipts,
  jobs,
  serviceRecords,
  cars,
  autoScan,
}: ReceiptInboxClientProps) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [tab, setTab] = useState<"inbox" | "all">("inbox");
  const [classifyId, setClassifyId] = useState<string | null>(null);
  const [linkJobId, setLinkJobId] = useState("");
  const [linkSrId, setLinkSrId] = useState("");
  const [linking, setLinking] = useState(false);
  const [showScan, setShowScan] = useState(false);

  useEffect(() => {
    if (autoScan) setShowScan(true);
  }, [autoScan]);

  const inboxReceipts = receipts.filter((r) => r.status === "inbox");
  const allReceipts = receipts;
  const displayed = tab === "inbox" ? inboxReceipts : allReceipts;

  const handleCreated = (r: Receipt) => setReceipts((prev) => [r, ...prev]);
  const handleDelete = (id: string) => setReceipts((prev) => prev.filter((r) => r.id !== id));
  const handleScanDone = () => {
    setShowScan(false);
    window.location.reload();
  };

  const handleLink = async () => {
    if (!classifyId || (!linkJobId && !linkSrId)) {
      alert("Select a job or service record to link");
      return;
    }
    setLinking(true);
    try {
      const body: Record<string, string> = {};
      if (linkJobId) body.jobId = linkJobId;
      if (linkSrId) body.serviceRecordId = linkSrId;
      const res = await fetch(`/api/receipts/${classifyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === classifyId ? { ...r, status: "linked", jobId: linkJobId || r.job?.id, serviceRecordId: linkSrId || r.serviceRecord?.id } : r
          )
        );
        setClassifyId(null);
        setLinkJobId("");
        setLinkSrId("");
      }
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-gray-500 text-sm">← Garage</Link>
            </div>
            <h1 className="text-xl font-bold text-white mt-1">Receipts</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScan(true)}
              className="text-sm px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold active:bg-amber-400 transition"
            >
              🤖 Scan
            </button>
            <ReceiptUploadButton onCreated={handleCreated} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          <button
            onClick={() => setTab("inbox")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              tab === "inbox" ? "bg-gray-800 text-white" : "text-gray-500"
            }`}
          >
            Inbox
            {inboxReceipts.length > 0 && (
              <span className="ml-2 bg-amber-500 text-black text-xs font-bold rounded-full px-1.5 py-0.5">
                {inboxReceipts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("all")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              tab === "all" ? "bg-gray-800 text-white" : "text-gray-500"
            }`}
          >
            All Receipts
            <span className="ml-2 text-xs text-gray-600">{allReceipts.length}</span>
          </button>
        </div>

        {/* Receipt list */}
        {displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">🧾</p>
            <p>{tab === "inbox" ? "Inbox is empty — all receipts are linked!" : "No receipts yet."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((r) => (
              <div key={r.id} className="relative">
                <ReceiptCard receipt={r} onDelete={handleDelete} />
                {/* Linked-to label */}
                {r.status === "linked" && (r.job || r.serviceRecord) && (
                  <div className="px-4 pb-3 -mt-1 bg-gray-900 mx-0 rounded-b-2xl border-x border-b border-gray-800">
                    <p className="text-xs text-gray-500">
                      Linked to:{" "}
                      {r.job && (
                        <Link href={`/job/${r.job.id}`} className="text-amber-400">
                          🔧 {r.job.title}
                        </Link>
                      )}
                      {r.serviceRecord && (
                        <span className="text-blue-400">🛠 {r.serviceRecord.title}</span>
                      )}
                    </p>
                  </div>
                )}
                {/* Link button for inbox items */}
                {r.status === "inbox" && (
                  <button
                    onClick={() => { setClassifyId(r.id); setLinkJobId(""); setLinkSrId(""); }}
                    className="absolute top-3 right-10 text-xs px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 active:bg-amber-500/20 transition"
                  >
                    Link it
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scan flow */}
      {showScan && (
        <ReceiptScanFlow cars={cars} onDone={handleScanDone} onClose={() => setShowScan(false)} />
      )}

      {/* Classify panel */}
      {classifyId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Link Receipt</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Link to Job</label>
                <select value={linkJobId} onChange={(e) => { setLinkJobId(e.target.value); setLinkSrId(""); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none">
                  <option value="">— choose a job —</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
              <div className="text-center text-gray-600 text-sm">or</div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Link to Service Record</label>
                <select value={linkSrId} onChange={(e) => { setLinkSrId(e.target.value); setLinkJobId(""); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none">
                  <option value="">— choose a service record —</option>
                  {serviceRecords.map((sr) => (
                    <option key={sr.id} value={sr.id}>{sr.title} ({new Date(sr.serviceDate).toLocaleDateString()})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setClassifyId(null)}
                className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-400 active:bg-gray-800 transition">
                Cancel
              </button>
              <button onClick={handleLink} disabled={linking}
                className="flex-1 py-2 rounded-xl bg-amber-500 text-black font-semibold active:bg-amber-400 transition disabled:opacity-50">
                {linking ? "Linking…" : "Link Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
