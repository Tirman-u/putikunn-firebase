import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-semibold tracking-[0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-fp-card hover:bg-emerald-700 active:bg-emerald-800",
        destructive:
          "bg-destructive text-destructive-foreground shadow-fp-card hover:bg-red-700",
        outline:
          "border border-input bg-background text-foreground shadow-fp-card hover:bg-secondary hover:text-secondary-foreground dark:border-[#1f4b56] dark:bg-black dark:hover:bg-[#07161b]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-fp-card hover:bg-[#d5e6ec] dark:bg-[#0d2128] dark:text-[#d6ebee] dark:hover:bg-[#11303a]",
        ghost: "text-foreground hover:bg-secondary hover:text-foreground dark:hover:bg-[#0d2128]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-[12px] px-4 text-xs",
        lg: "h-11 rounded-[16px] px-8",
        icon: "h-10 w-10 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
