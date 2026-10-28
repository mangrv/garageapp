"use client";
import { useT } from "@/app/hooks/useT";

import Link from "next/link";
import Glyph from "@/app/components/Glyph";

interface ReceiptCardProps {
  receipt: {
    id: string;
    vendor?: string | null;
    totalAmount?: number | null;
    receiptDate?: string | null;
    status: string;
    filename?: string | null;
    lineItems?: { id: string }[];
  };
  onDelete?: (id: string) => void;
}

export default function ReceiptCard({ receipt, onDelete }: ReceiptCardProps) {
  const t = useT();
  const isImage =
    receipt.filename &&
    /\.(jpg|jpeg|png|gif|webp)$/i.test(receipt.filename);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Delete this receipt?")) return;
    await fetch(`/api/receipts/${receipt.id}`, { method: "DELETE" });
    onDelete?.(receipt.id);
  };

  return (
    <Link
      href={`/receipts/${receipt.id}`}
      className="block bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition group"
    >
      <div className="flex gap-4 items-start">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/uploads/${receipt.filename}`}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl"><Glyph e="🧾" /></span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">
            {receipt.vendor ?? "Unknown vendor"}
          </p>
          <p className="text-gray-400 text-sm">
            {receipt.receiptDate
              ? new Date(receipt.receiptDate).toLocaleDateString()
              : "No date"}
            {receipt.totalAmount != null && (
              <span className="ml-2 text-amber-400 font-semibold">
                ${receipt.totalAmount.toFixed(2)}
              </span>
            )}
          </p>
          <div className="flex gap-2 mt-1 items-center">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                receipt.status === "inbox"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-green-500/20 text-green-400"
              }`}
            >
              {receipt.status}
            </span>
            {(receipt.lineItems?.length ?? 0) > 0 && (
              <span className="text-xs text-gray-500">
                {receipt.lineItems!.length} item
                {receipt.lineItems!.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {onDelete && (
          <button
            onClick={handleDelete}
            className="text-gray-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100 text-lg"
          >
            <Glyph e="✕" />
          </button>
        )}
      </div>
    </Link>
  );
}
