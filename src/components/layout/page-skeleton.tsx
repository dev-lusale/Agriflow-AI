import { Skeleton } from "@/components/ui/primitives";

/** Shimmering placeholder shown inside the app shell while a page's data loads. */
export function PageSkeleton() {
  return (
    <div className="animate-fade-in space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Skeleton className="h-56 rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[6.5rem] rounded-[1.75rem]" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-[1.75rem] lg:col-span-2" />
        <Skeleton className="h-80 rounded-[1.75rem]" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
