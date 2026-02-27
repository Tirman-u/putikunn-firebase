"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const tones = {
  teal: "bg-[#14BAB6]",
  warm: "bg-[#F59E0B]",
  ink: "bg-[#1A2B2E]"
};

const Progress = React.forwardRef(({ className, value, tone = "teal", ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-[#D8DFDD] dark:bg-[#3C4652]", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 transition-all", tones[tone] || tones.teal)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
