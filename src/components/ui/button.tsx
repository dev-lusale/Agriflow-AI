import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Pill buttons: near-black primary, white secondary, with a gentle press animation. */
export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-white shadow-[0_6px_16px_-6px_rgb(13_17_22/0.45)] hover:bg-navy-800 hover:shadow-[0_10px_22px_-8px_rgb(13_17_22/0.5)]",
        accent: "bg-forest-600 text-white shadow-[0_6px_16px_-6px_rgb(22_131_75/0.5)] hover:bg-forest-700",
        navy: "bg-ink text-white hover:bg-navy-800",
        outline: "border border-navy-200/90 bg-white/85 text-navy-900 shadow-sm backdrop-blur hover:border-navy-300 hover:bg-white",
        secondary: "bg-white/80 text-navy-900 shadow-sm ring-1 ring-black/[0.04] backdrop-blur hover:bg-white",
        ghost: "text-navy-700 hover:bg-white/70 hover:text-navy-900",
        danger: "bg-red-600 text-white hover:bg-red-700",
        "danger-outline": "border border-red-200 bg-white/85 text-red-600 hover:bg-red-50",
        link: "rounded-none px-0 text-navy-900 underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3.5 text-[0.8rem]",
        lg: "h-12 px-7 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";
