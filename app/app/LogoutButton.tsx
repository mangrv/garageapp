"use client";

export default function LogoutButton({ name }: { name: string | null }) {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <button
      onClick={handleLogout}
      className="h-10 px-3 inline-flex items-center gap-1.5 bg-gray-800 text-gray-300 text-sm rounded-xl active:bg-gray-700 whitespace-nowrap"
      aria-label="Logout"
      title="Logout"
    >
      <span>👤</span>
      <span className="hidden md:inline max-w-24 truncate">{name ?? "Me"}</span>
      <span className="text-gray-500">↩</span>
    </button>
  );
}
