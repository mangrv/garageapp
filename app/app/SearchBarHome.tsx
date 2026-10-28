"use client";

import { useRouter } from "next/navigation";
import Glyph from "@/app/components/Glyph";

export default function SearchBarHome() {
  const router = useRouter();

  return (
    <div
      className="relative cursor-pointer"
      onClick={() => router.push("/search")}
    >
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Glyph e="🔍" /></span>
      <div className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-600">
        Search cars, projects, tasks…
      </div>
    </div>
  );
}
