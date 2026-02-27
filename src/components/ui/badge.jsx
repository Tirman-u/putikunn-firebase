import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#97D6CD] bg-[#E7F7F2] text-[#007377]",
        secondary: "border-[#9ED9A8] bg-[#EAF8ED] text-[#2F7F45]",
        destructive: "border-[#E9ACAF] bg-[#FEECEC] text-[#B54148]",
        outline: "border-border bg-transparent text-muted-foreground",
        warm: "border-[#F1D48F] bg-[#FFF4DB] text-[#A86B02]",
        info: "border-[#A5C7FF] bg-[#EDF4FF] text-[#3B6CC7]"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
