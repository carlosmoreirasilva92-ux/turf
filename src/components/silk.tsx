import type { Silk as SilkData } from "@/lib/racing/data";

export function Silk({ silk, size = 36 }: { silk: SilkData; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
      <rect x="7" y="7" width="5" height="12" rx="2" fill={silk.b} />
      <rect x="24" y="7" width="5" height="12" rx="2" fill={silk.b} />
      <rect x="10" y="5" width="16" height="24" rx="4" fill={silk.a} />
      {silk.pattern === "hoops" && (
        <>
          <rect x="10" y="10" width="16" height="3" fill={silk.b} />
          <rect x="10" y="16" width="16" height="3" fill={silk.b} />
          <rect x="10" y="22" width="16" height="3" fill={silk.b} />
        </>
      )}
      {silk.pattern === "sash" && (
        <path d="M12 6 L24 28" stroke={silk.b} strokeWidth="3.2" strokeLinecap="round" />
      )}
      {silk.pattern === "stars" && (
        <>
          <circle cx="18" cy="13" r="1.6" fill={silk.b} />
          <circle cx="14" cy="19" r="1.6" fill={silk.b} />
          <circle cx="22" cy="19" r="1.6" fill={silk.b} />
        </>
      )}
      {silk.pattern === "check" && (
        <>
          <rect x="10" y="5" width="8" height="8" fill={silk.b} opacity="0.9" />
          <rect x="18" y="13" width="8" height="8" fill={silk.b} opacity="0.9" />
          <rect x="10" y="21" width="8" height="8" fill={silk.b} opacity="0.55" />
        </>
      )}
    </svg>
  );
}
