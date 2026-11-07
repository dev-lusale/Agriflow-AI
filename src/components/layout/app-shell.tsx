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
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [pathname]);
  const notifHref = role === "FARMER" ? "/farmer/notifications" : "/notifications";

  const badge = (item: NavItem) => {
    const n = item.badge === "notifications" ? unreadNotifications : item.badge === "messages" ? unreadMessages : 0;
    return n > 0 ? <span className="ml-auto rounded-full bg-forest-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{n > 99 ? "99+" : n}</span> : null;
  };

  const nav = (
    <nav className="flex flex-col gap-5 px-3 pb-6" aria-label="Main">
      {NAV[role].map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.title && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-forest-200/60">{group.title}</p>}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-white/12 text-white shadow-inner" : "text-forest-100/80 hover:bg-white/6 hover:text-white",
                )}
              >
                <Icon className={cn("size-[18px] shrink-0", active ? "text-forest-300" : "text-forest-200/70")} />
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
    <div className="min-h-dvh bg-background">
      {demoMode && (
        <div className="no-print sticky top-0 z-40 flex items-center justify-center gap-2 bg-harvest-500 px-3 py-1 text-center text-xs font-semibold text-navy-900">
          DEMO MODE · fictional sample data for demonstration
        </div>
      )}
      {/* Desktop sidebar */}
      <aside className={cn("no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-forest-900 lg:flex", demoMode && "top-6")}>
        <div className="flex h-16 shrink-0 items-center px-6">
          <Link href="/" aria-label="AgriFlow AI home">
            <Logo inverted />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto pt-2">{nav}</div>
        <div className="border-t border-white/10 p-4 text-xs text-forest-200/70">
          Signed in as <span className="font-semibold text-white">{ROLE_LABEL[role]}</span>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-forest-900 shadow-xl">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo inverted />
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-forest-100 hover:bg-white/10" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pt-2">{nav}</div>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className={cn("no-print sticky z-20 flex h-16 items-center gap-3 border-b border-border bg-white/85 px-4 backdrop-blur sm:px-6", demoMode ? "top-6" : "top-0")}>
          <button className="rounded-lg p-2 text-navy-600 hover:bg-navy-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Link href="/" className="lg:hidden" aria-label="Home">
            <Logo compact />
          </Link>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            <ConnectionStatus />
            <Link href={notifHref} className="relative rounded-lg p-2 text-navy-600 hover:bg-navy-100" aria-label={`Notifications (${unreadNotifications} unread)`}>
              <Bell className="size-5" />
              {unreadNotifications > 0 && <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-forest-500 text-[9px] font-bold text-white">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-navy-100" aria-label="Account menu">
                <span className="flex size-8 items-center justify-center rounded-full bg-forest-800 text-xs font-bold text-white">{initials(name || email)}</span>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium text-navy-800 sm:block">{name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <span className="block font-semibold text-navy-900">{name}</span>
                  <span className="block truncate">{email}</span>
                  <span className="mt-1 block text-forest-700">{ROLE_LABEL[role]}</span>
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
                <DropdownMenuItem onSelect={() => void logoutAction()} className="text-red-700">
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Quick navigation">
        {MOBILE_TABS[role].map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-forest-700" : "text-navy-500")}>
              <Icon className={cn("size-5", active && "text-forest-600")} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
