"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Lets forms inside a FormDialog close it after a successful submit (ActionForm does this automatically). */
export const DialogCloseContext = React.createContext<(() => void) | null>(null);

/** Button that opens a dialog containing (usually) an ActionForm. Children are plain JSX, so server pages can use it. */
export function FormDialog({
  trigger,
  title,
  description,
  wide,
  defaultOpen,
  variant,
  size,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  wide?: boolean;
  defaultOpen?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(Boolean(defaultOpen));
  const close = React.useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={description} wide={wide}>
        <DialogCloseContext.Provider value={close}>{children}</DialogCloseContext.Provider>
      </DialogContent>
    </Dialog>
  );
}
