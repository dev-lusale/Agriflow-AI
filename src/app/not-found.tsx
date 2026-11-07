import Link from "next/link";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-700">
        <Sprout className="size-7" />
      </div>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-sm text-navy-500">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
