import { LogoMark } from "@/components/brand/logo";

/** Branded loading screen shown during route transitions. */
export default function Loading() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4" role="status" aria-label="Loading">
      <div className="relative">
        <LogoMark className="size-14 animate-pulse" />
        <span className="absolute -inset-2 animate-ping rounded-2xl border-2 border-forest-300 opacity-40" />
      </div>
      <p className="text-sm font-medium text-navy-500">Loading AgriFlow AI…</p>
    </div>
  );
}
