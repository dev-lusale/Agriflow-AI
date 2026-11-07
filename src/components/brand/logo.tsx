import { cn } from "@/lib/utils";

/** AgriFlow AI mark: a leaf whose vein becomes a rising flow line (growth + data). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#14532D" />
      <path d="M11 29.5C11 18 18.5 10.5 30 10c.4 11.6-7.2 19.4-19 19.5Z" fill="#16A34A" />
      <path d="M12.5 28.5c3.4-2 5.2-4.7 7.4-8.1 1.7-2.7 3.7-5.2 7.6-7.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="27.5" cy="13" r="2.1" fill="#fff" />
      <circle cx="19.9" cy="20.4" r="1.6" fill="#DCFCE7" />
    </svg>
  );
}

export function Logo({ className, inverted, compact }: { className?: string; inverted?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn("text-[1.05rem] font-extrabold tracking-tight", inverted ? "text-white" : "text-navy-900")}>
            AgriFlow <span className={inverted ? "text-forest-300" : "text-forest-500"}>AI</span>
          </span>
          <span className={cn("mt-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.18em]", inverted ? "text-forest-200/80" : "text-navy-400")}>Zambia</span>
        </span>
      )}
    </span>
  );
}
