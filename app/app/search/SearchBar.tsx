"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Glyph from "@/app/components/Glyph";

export default function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleChange = (v: string) => {
    setValue(v);
    startTransition(() => {
      if (v.length === 0 || v.length >= 2) {
        router.push(v ? `/search?q=${encodeURIComponent(v)}` : "/search");
      }
    });
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Glyph e="🔍" /></span>
      <input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search cars, projects, tasks…"
        autoFocus
        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
      />
      {value && (
        <button onClick={() => handleChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"><Glyph e="✕" /></button>
      )}
    </div>
  );
}
