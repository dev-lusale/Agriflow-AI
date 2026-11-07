import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-forest-800 text-white shadow-sm hover:bg-forest-700 active:bg-forest-900",
        accent: "bg-forest-500 text-white shadow-sm hover:bg-forest-600",
        navy: "bg-navy-900 text-white shadow-sm hover:bg-navy-800",
        outline: "border border-border bg-white text-navy-800 shadow-sm hover:bg-navy-50 hover:text-navy-900",
        secondary: "bg-forest-50 text-forest-800 hover:bg-forest-100",
        ghost: "text-navy-700 hover:bg-navy-100 hover:text-navy-900",
        danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
        "danger-outline": "border border-red-200 bg-white text-red-700 hover:bg-red-50",
        link: "text-forest-700 underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
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
