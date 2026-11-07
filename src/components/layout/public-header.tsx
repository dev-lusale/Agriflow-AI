"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
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

/** Floating frosted pill navigation; expands into a glass sheet on mobile. */
export function PublicHeader({ signedInHome }: { signedInHome?: string | null }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = React.useState<string | null>(null);
  const open = openOn === pathname;
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div className={cn("glass mx-auto max-w-7xl shadow-[var(--shadow-card)] transition-[border-radius] duration-300", open ? "rounded-[1.75rem]" : "rounded-full")}>
        <div className="flex h-14 items-center gap-6 pl-4 pr-2 sm:pl-5">
          <Link href="/" aria-label="AgriFlow AI home" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn("rounded-full px-3.5 py-2 text-sm font-medium transition-colors", pathname.startsWith(l.href) ? "bg-white text-navy-900 shadow-sm" : "text-navy-600 hover:bg-white/70 hover:text-navy-900")}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-1.5 sm:flex">
            {signedInHome ? (
              <Button asChild size="sm" className="h-10 px-4">
                <Link href={signedInHome}>
                  Open dashboard <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="h-10 px-4">
                  <Link href="/auth/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="h-10 px-4">
                  <Link href="/auth/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
          <button
            className="ml-auto flex size-10 items-center justify-center rounded-full bg-white text-navy-800 shadow-sm active:scale-95 sm:ml-0 lg:hidden"
            onClick={() => setOpenOn(open ? null : pathname)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
          </button>
        </div>
        {open && (
          <div className="animate-fade-in px-3 pb-3 lg:hidden">
            <nav className="grid grid-cols-2 gap-1 py-2">
              {[...LINKS, { href: "/faq", label: "FAQ" }, { href: "/contact", label: "Contact" }].map((l) => (
                <Link key={l.href} href={l.href} className="rounded-2xl px-3 py-2.5 text-sm font-medium text-navy-700 hover:bg-white">
                  {l.label}
                </Link>
              ))}
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
      </div>
    </header>
  );
}
