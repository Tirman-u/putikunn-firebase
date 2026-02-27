import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#0FAAA6]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-[#B54148]",
        outline: "border border-border bg-transparent text-foreground hover:bg-[#EBF5F3] dark:hover:bg-[#0A0F12]",
        secondary: "bg-[#1A2B2E] text-[#F7F7F5] hover:bg-[#152326] dark:border dark:border-border dark:bg-black dark:hover:bg-[#0A0F12]",
        ghost: "text-foreground hover:bg-[#EBF5F3] dark:hover:bg-[#0A0F12]",
        link: "text-[#007377] underline-offset-4 hover:underline dark:text-[#5EEAD4]",
        warm: "bg-[#F59E0B] text-[#1A2B2E] hover:bg-[#E18E08]",
        pill: "rounded-full bg-primary text-primary-foreground hover:bg-[#0FAAA6]"
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-11 rounded-xl px-6",
        xl: "h-12 rounded-xl px-7 text-base",
        tiny: "h-8 rounded-lg px-3 text-xs",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
