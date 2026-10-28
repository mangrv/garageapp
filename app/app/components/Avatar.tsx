/** Initials avatar: users have no profile photos, so identity is a colored tile with initials. */
const TONES = [
  { bg: "#2446f0", fg: "#ffffff" },
  { bg: "#e6f4ef", fg: "#047857" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#e0f2fe", fg: "#075985" },
  { bg: "#ede9fe", fg: "#5b21b6" },
];

export function initials(name?: string | null, fallback = "?") {
  const parts = (name ?? "").replace(/[@._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

interface AvatarProps {
  name?: string | null;
  /** Stable value (user id or username) so a person keeps the same color everywhere. */
  seed?: string | null;
  size?: number;
  className?: string;
}

export default function Avatar({ name, seed, size = 36, className = "" }: AvatarProps) {
  const tone = toneFor(seed || name || "?");
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center shrink-0 font-display font-semibold select-none ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), background: tone.bg, color: tone.fg, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}
