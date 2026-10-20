"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Dos paneles en escritorio; en el celular se muestra la lista o la conversación. */
export function ChatFrame({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const inConversation = /^\/chat\/\d+/.test(usePathname());
  return (
    <div className="-my-2 flex h-[calc(100dvh-8.5rem)] min-h-[480px] overflow-hidden rounded-2xl bg-card shadow-xs ring-1 ring-foreground/10">
      <aside className={cn("w-full shrink-0 border-r bg-muted/30 md:block md:w-72", inConversation && "hidden")}>{sidebar}</aside>
      <section className={cn("min-w-0 flex-1", !inConversation && "hidden md:block")}>{children}</section>
    </div>
  );
}
