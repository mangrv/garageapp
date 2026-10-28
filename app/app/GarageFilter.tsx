"use client";

import { useRouter, useSearchParams } from "next/navigation";

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
  { value: "archived", label: "Archived" },
];

export default function GarageFilter({ current }: { current: string }) {
  const router = useRouter();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => router.push(f.value === "active" ? "/" : `/?filter=${f.value}`)}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            current === f.value
              ? "bg-amber-500 text-on-accent"
              : "bg-gray-800 text-gray-400 active:bg-gray-700"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
