"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { Bell, LogOut, Menu, User, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dialog";
import { ConnectionStatus } from "@/components/offline/connection-status";
import { clearOfflineData } from "@/lib/offline/queue";
import { logoutAction } from "@/server/auth/actions";
import { MOBILE_TABS, NAV, type NavItem } from "./nav-config";

type ShellProps = {
  role: Role;
  name: string;
  email: string;
  unreadNotifications: number;
  unreadMessages: number;
  demoMode: boolean;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ role, name, email, unreadNotifications, unreadMessages, demoMode, children }: ShellProps) {
  const pathname = usePathname();
  // Drawer closes automatically on navigation: it is only open for the path it was opened on
  const [openOn, setOpenOn] = React.useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);
  const notifHref = role === "FARMER" ? "/farmer/notifications" : "/notifications";

  const badge = (item: NavItem) => {
    const n = item.badge === "notifications" ? unreadNotifications : item.badge === "messages" ? unreadMessages : 0;
    return n > 0 ? <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-forest-500 px-1.5 text-[10px] font-bold text-white">{n > 99 ? "99+" : n}</span> : null;
  };

  const nav = (
    <nav className="flex flex-col gap-5 px-3 pb-6" aria-label="Main">
      {NAV[role].map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.title && <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-400">{group.title}</p>}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-full px-3.5 py-2 text-[0.9rem] font-medium transition-all duration-200",
                  active ? "bg-ink text-white shadow-[0_8px_18px_-10px_rgb(13_17_22/0.6)]" : "text-navy-600 hover:bg-white/80 hover:text-navy-900",
                )}
              >
                <Icon className={cn("size-[18px] shrink-0 transition-transform duration-200", active ? "text-white" : "text-navy-500 group-hover:scale-110 group-hover:text-navy-800")} />
                {item.label}
                {badge(item)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh">
      {demoMode && (
        <div className="no-print sticky top-0 z-40 flex items-center justify-center gap-2 bg-harvest-100/90 px-3 py-1 text-center text-[11px] font-semibold tracking-wide text-harvest-800 backdrop-blur">
          <span className="size-1.5 rounded-full bg-harvest-500" /> DEMO MODE · fictional sample data
        </div>
      )}

      {/* Desktop sidebar: floating frosted panel */}
      <aside className={cn("no-print fixed bottom-3 left-3 z-30 hidden w-64 flex-col rounded-[1.75rem] glass shadow-[var(--shadow-card)] lg:flex", demoMode ? "top-9" : "top-3")}>
        <div className="flex h-16 shrink-0 items-center px-6">
          <Link href="/" aria-label="AgriFlow AI home" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto pt-1 [scrollbar-width:thin]">{nav}</div>
        <div className="m-3 rounded-2xl bg-white/70 px-4 py-3 text-xs text-navy-500">
          Signed in as <span className="font-semibold text-navy-900">{ROLE_LABEL[role]}</span>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-navy-900/25 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="glass-strong absolute inset-y-2 left-2 flex w-[18rem] animate-sheet-in flex-col rounded-[1.75rem] shadow-[var(--shadow-float)]">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo />
              <button onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded-full bg-white text-navy-700 shadow-sm active:scale-95" aria-label="Close menu">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pt-1">{nav}</div>
          </aside>
        </div>
      )}

      <div className="lg:pl-[17.5rem]">
        <header className={cn("no-print sticky z-20 flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8", demoMode ? "top-6" : "top-0")}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#e6eff3]/95 via-[#e6eff3]/70 to-transparent backdrop-blur-[2px] lg:from-transparent lg:via-transparent" aria-hidden />
          <button className="relative flex size-10 items-center justify-center rounded-full bg-white/85 text-navy-800 shadow-sm active:scale-95 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-[18px]" />
          </button>
          <Link href="/" className="relative lg:hidden" aria-label="Home">
            <Logo compact />
          </Link>
          <div className="relative ml-auto flex items-center gap-2 sm:gap-3">
            <ConnectionStatus />
            <Link href={notifHref} className="relative flex size-10 items-center justify-center rounded-full bg-white/85 text-navy-800 shadow-sm ring-1 ring-black/[0.03] transition hover:bg-white active:scale-95" aria-label={`Notifications (${unreadNotifications} unread)`}>
              <Bell className="size-[18px]" />
              {unreadNotifications > 0 && <span className="absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-forest-500 text-[9px] font-bold text-white ring-2 ring-white">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full bg-white/85 p-1 pr-1 shadow-sm ring-1 ring-black/[0.03] transition hover:bg-white sm:pr-3" aria-label="Account menu">
                <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-forest-500 to-forest-800 text-xs font-bold text-white">{initials(name || email)}</span>
                <span className="hidden max-w-[10rem] truncate text-sm font-semibold text-navy-800 sm:block">{name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <span className="block font-semibold text-navy-900">{name}</span>
                  <span className="block truncate">{email}</span>
                  <span className="mt-1 block font-medium text-forest-700">{ROLE_LABEL[role]}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "SUPPLIER" && (
                  <DropdownMenuItem asChild>
                    <Link href={`/${role.toLowerCase()}/profile`}>
                      <User /> Profile
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={notifHref}>
                    <Bell /> Notifications
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void clearOfflineData().finally(() => logoutAction())} className="text-red-600">
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* key on pathname replays the entrance animation on every navigation */}
        <main key={pathname} className="page-enter mx-auto w-full max-w-7xl px-4 pb-32 pt-4 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar (frosted) */}
      <nav
        className="no-print glass-strong fixed inset-x-2 bottom-2 z-30 grid grid-cols-5 rounded-[1.6rem] px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 shadow-[var(--shadow-float)] lg:hidden"
        aria-label="Quick navigation"
      >
        {MOBILE_TABS[role].map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold transition-colors", active ? "text-ink" : "text-navy-400")}>
              <span className={cn("flex h-8 w-11 items-center justify-center rounded-full transition-all duration-300", active ? "bg-ink text-white shadow-[0_6px_14px_-6px_rgb(13_17_22/0.6)]" : "")}>
                <Icon className="size-[18px]" />
              </span>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
