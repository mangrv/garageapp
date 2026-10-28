/** GarageMeet brand mark: a gauge whose needle draws the "G". */
export function LogoMark({ size = 32, color = "currentColor", className = "" }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <path d="M34.72 33A14 14 0 1 1 36.12 17" stroke={color} strokeWidth="4.6" strokeLinecap="round" />
      <path d="M24 24h12" stroke={color} strokeWidth="4.6" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3.2" fill={color} />
    </svg>
  );
}

/** App-icon tile version of the mark. */
export function LogoTile({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 bg-brand ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
    >
      <LogoMark size={Math.round(size * 0.66)} color="#ffffff" />
    </span>
  );
}

/** Tile + wordmark lockup. `tone="inverse"` is for use on the cobalt brand color. */
export default function Logo({ size = 32, tone = "default", className = "" }: { size?: number; tone?: "default" | "inverse"; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="GarageMeet">
      {tone === "inverse" ? <LogoMark size={size} color="#ffffff" /> : <LogoTile size={size} />}
      <span
        className={`font-display font-bold leading-none ${tone === "inverse" ? "text-[#ffffff]" : "text-white"}`}
        style={{ fontSize: Math.round(size * 0.62), letterSpacing: "-0.03em" }}
      >
        garagemeet
      </span>
    </span>
  );
}
