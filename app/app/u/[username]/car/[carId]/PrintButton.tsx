"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="ml-auto px-4 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition text-xs"
    >
      🖨️ Print / Save PDF
    </button>
  );
}
