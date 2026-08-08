import Link from "next/link";

const TABS = [
  { href: "/social", label: "Community" },
  { href: "/social/posts", label: "My posts" },
  { href: "/social/saved", label: "Saved" },
  { href: "/friends", label: "Friends" },
];

export default function SocialTabs({ active }: { active: "community" | "posts" | "saved" | "friends" }) {
  const activeHref = active === "community" ? "/social" : active === "posts" ? "/social/posts" : active === "saved" ? "/social/saved" : "/friends";
  return (
    <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-lg mx-auto px-4 py-3 space-y-3">
        <div>
          <h1 className="text-base font-bold text-white">Social</h1>
          <p className="text-xs text-gray-500">Public posts and your saved garage inspiration</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-gray-900 border border-gray-800 p-1 overflow-x-auto">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 min-w-fit text-center text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                tab.href === activeHref ? "bg-amber-500 text-gray-950" : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
