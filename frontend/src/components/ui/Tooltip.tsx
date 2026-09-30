// shadcn/ui Tooltip (Radix), restyled.
import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export const TooltipProvider = T.Provider;

export function Tip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root delayDuration={200}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-sm rounded-lg border border-subtle bg-panel px-3 py-2 text-xs text-primary shadow-lg"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
