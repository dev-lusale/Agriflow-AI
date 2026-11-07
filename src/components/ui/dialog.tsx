"use client";

import * as React from "react";
import { Dialog as D, DropdownMenu as DM } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description, wide }: { className?: string; children: React.ReactNode; title: string; description?: string; wide?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-navy-900/25 backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
      <D.Content
        className={cn(
          "glass-strong fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[2rem] p-5 pt-3 shadow-[var(--shadow-float)] data-[state=open]:animate-sheet-in sm:pt-6",
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] sm:p-7",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-navy-200 sm:hidden" aria-hidden />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-xl font-semibold text-navy-900">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-navy-500">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-100 text-navy-600 transition hover:bg-navy-200 hover:text-navy-900 active:scale-95" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        className={cn("glass-strong z-50 min-w-[13rem] rounded-2xl p-1.5 shadow-[var(--shadow-lift)] data-[state=open]:animate-sheet-in", className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DM.Item>) {
  return <DM.Item className={cn("flex cursor-pointer select-none items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-700 outline-none transition-colors data-[highlighted]:bg-navy-100 data-[highlighted]:text-navy-900 [&_svg]:size-4", className)} {...props} />;
}

export const DropdownMenuSeparator = () => <DM.Separator className="my-1 h-px bg-border" />;
export const DropdownMenuLabel = ({ children }: { children: React.ReactNode }) => <DM.Label className="px-2.5 py-1.5 text-xs font-medium text-navy-500">{children}</DM.Label>;
