export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#236B4A" />
      <path d="M4 24 12 12l4 6 3-4 9 10z" fill="#F8F5ED" />
      <circle cx="22" cy="9" r="2.4" fill="#D9A441" />
    </svg>
  );
}

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span
        className={`font-display text-lg font-bold tracking-tight ${tone === "light" ? "text-white" : "text-brand-deep"}`}
      >
        NeirApp
      </span>
    </span>
  );
}
