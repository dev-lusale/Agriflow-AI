import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Official AgriFlow AI brand assets (generated from assets/brand/agriflow-logo-source.png
 * by scripts/generate-icons.mjs):
 *  - /brand/agriflow-mark.png  — the "A" emblem (leaf + fields)
 *  - /brand/agriflow-logo.png  — full lockup (emblem + AgriFlow AI wordmark)
 */
const MARK = { src: "/brand/agriflow-mark.png", w: 819, h: 512 };
const LOCKUP = { src: "/brand/agriflow-logo.png", w: 1500, h: 783 };

/** The emblem, contained inside whatever box the className defines (default 36 px). */
export function LogoMark({ className, title, priority }: { className?: string; title?: string; priority?: boolean }) {
  return (
    <span className={cn("relative inline-flex size-9 shrink-0 items-center justify-center", className)}>
      <Image src={MARK.src} alt={title ?? ""} aria-hidden={title ? undefined : true} width={MARK.w} height={MARK.h} priority={priority} className="h-auto max-h-full w-full object-contain" sizes="96px" />
    </span>
  );
}

/** Full official lockup image, for large placements (auth panel, footer, documents). */
export function LogoLockup({ className, priority }: { className?: string; priority?: boolean }) {
  return <Image src={LOCKUP.src} alt="AgriFlow AI" width={LOCKUP.w} height={LOCKUP.h} priority={priority} className={cn("h-auto w-48", className)} sizes="(max-width: 640px) 60vw, 400px" />;
}

/** Compact header logo: emblem + wordmark styled after the official lockup. */
export function Logo({ className, inverted, compact }: { className?: string; inverted?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-9 w-11" title={compact ? "AgriFlow AI" : undefined} priority />
      {!compact && (
        <span className="flex items-center gap-1 leading-none">
          <span
            className={cn(
              "text-[1.2rem] font-extrabold italic tracking-[-0.03em]",
              inverted ? "text-white" : "bg-gradient-to-r from-[#0d5a1c] via-[#167a24] to-[#3fae1a] bg-clip-text text-transparent",
            )}
          >
            AgriFlow
          </span>
          <span className={cn("rounded-[0.45rem] px-1.5 py-[3px] text-[0.72rem] font-extrabold italic leading-none", inverted ? "bg-white text-[#0d4a17]" : "bg-[#0d4a17] text-white")}>AI</span>
        </span>
      )}
    </span>
  );
}
