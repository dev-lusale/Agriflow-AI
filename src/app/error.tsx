"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-harvest-50 text-harvest-700">
        <TriangleAlert className="size-7" />
      </div>
      <h1 className="mt-4 text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-navy-500">
        We couldn&apos;t load this page. If you are offline, your farm records are still available on the offline page.
        {error.digest && <span className="mt-1 block text-xs text-navy-400">Reference: {error.digest}</span>}
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/offline">Offline records</Link>
        </Button>
      </div>
    </div>
  );
}
