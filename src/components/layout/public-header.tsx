"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/farmers", label: "Farmers" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/logistics", label: "Logistics" },
  { href: "/about", label: "About" },
];

export function PublicHeader({ signedInHome }: { signedInHome?: string | null }) {
  const pathname = usePathname();
  // Menu closes automatically on navigation: it is only open for the path it was opened on
  const [openOn, setOpenOn] = React.useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenOn((typeof v === "function" ? v(open) : v) ? pathname : null);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="AgriFlow AI home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={cn("rounded-lg px-3 py-2 text-sm font-medium transition-colors", pathname.startsWith(l.href) ? "text-forest-700" : "text-navy-600 hover:text-navy-900")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {signedInHome ? (
            <Button asChild>
              <Link href={signedInHome}>Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
        <button className="ml-auto rounded-lg p-2 text-navy-700 hover:bg-navy-100 sm:ml-0 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-white px-4 pb-4 lg:hidden">
          <nav className="flex flex-col py-2">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50">
                {l.label}
              </Link>
            ))}
            <Link href="/faq" className="rounded-lg px-3 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50">
              FAQ
            </Link>
            <Link href="/contact" className="rounded-lg px-3 py-2.5 text-sm font-medium text-navy-700 hover:bg-navy-50">
              Contact
            </Link>
          </nav>
          <div className="grid grid-cols-2 gap-2">
            {signedInHome ? (
              <Button asChild className="col-span-2">
                <Link href={signedInHome}>Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link href="/auth/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/auth/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
