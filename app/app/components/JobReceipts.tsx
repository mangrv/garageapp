"use client";

import { useState } from "react";
import ReceiptCard from "./ReceiptCard";
import ReceiptUploadButton from "./ReceiptUploadButton";

interface Receipt {
  id: string;
  vendor?: string | null;
  totalAmount?: number | null;
  receiptDate?: string | null;
  status: string;
  filename?: string | null;
  lineItems?: { id: string }[];
}

interface JobReceiptsProps {
  jobId: string;
  initialReceipts: Receipt[];
}

export default function JobReceipts({ jobId, initialReceipts }: JobReceiptsProps) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);

  const handleCreated = (receipt: Receipt) => {
    setReceipts((prev) => [receipt, ...prev]);
  };

  const handleDelete = (id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Receipts
        </h3>
        <ReceiptUploadButton jobId={jobId} onCreated={handleCreated} />
      </div>

      {receipts.length === 0 ? (
        <p className="text-gray-600 text-sm">No receipts linked to this job yet.</p>
      ) : (
        <div className="space-y-2">
          {receipts.map((r) => (
            <ReceiptCard key={r.id} receipt={r} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
