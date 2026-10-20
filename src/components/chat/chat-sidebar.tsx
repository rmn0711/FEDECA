"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Hash, Lock, MessageSquarePlus, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createChannelAction, openDirectAction, pollChatAction } from "@/lib/actions/chat";
import type { ConversationItem } from "@/lib/chat/service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";

type Lists = { channels: ConversationItem[]; dms: ConversationItem[] };
type Member = { id: number; name: string; department: string | null };

const LIST_POLL_MS = 6000;

export function ChatSidebar({ initial, team }: { initial: Lists; team: Member[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeId = Number(pathname.split("/")[2]) || null;
  const [lists, setLists] = useState(initial);
  const [filter, setFilter] = useState("");
  const [dmOpen, setDmOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // La lista (y los no leídos) se actualiza sola cada pocos segundos.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await pollChatAction(null, new Date().toISOString(), 0, false, true);
      if (alive && r.ok && r.data.conversations) setLists(r.data.conversations);
    };
    const t = setInterval(tick, LIST_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    setLists(initial);
  }, [initial]);

  const f = filter.trim().toLowerCase();
  const channels = lists.channels.filter((c) => !f || (c.name ?? "").includes(f));
  const dms = lists.dms.filter((d) => !f || (d.otherName ?? "").toLowerCase().includes(f));

  function openDm(id: number) {
    startTransition(async () => {
      const r = await openDirectAction(id);
      if (!r.ok) return void toast.error(r.error);
      setDmOpen(false);
      router.push(`/chat/${r.data}`);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar conversación…" className="pl-8" />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <section className="space-y-0.5">
          <div className="flex items-center justify-between px-2 pb-1">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Canales</p>
            <button
              type="button"
              onClick={() => setChannelOpen(true)}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Nuevo canal"
              title="Nuevo canal"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {channels.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                c.id === activeId ? "bg-[#d9342c] text-white shadow-[0_6px_20px_rgba(217,52,44,0.3)]" : "hover:bg-accent",
                c.unread > 0 && c.id !== activeId && "font-semibold"
              )}
            >
              {c.isPrivate ? <Lock className="size-3.5 shrink-0 opacity-70" /> : <Hash className="size-3.5 shrink-0 opacity-70" />}
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {c.unread > 0 && c.id !== activeId && (
                <span className="rounded-full bg-[#d9342c] px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>
              )}
            </Link>
          ))}
        </section>
        <section className="space-y-0.5">
          <div className="flex items-center justify-between px-2 pb-1">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Mensajes directos</p>
            <button
              type="button"
              onClick={() => setDmOpen(true)}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Nuevo mensaje directo"
              title="Nuevo mensaje directo"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {dms.length === 0 && <p className="px-2 text-xs text-muted-foreground">Aún no tienes mensajes directos.</p>}
          {dms.map((d) => (
            <Link
              key={d.id}
              href={`/chat/${d.id}`}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                d.id === activeId ? "bg-[#d9342c] text-white shadow-[0_6px_20px_rgba(217,52,44,0.3)]" : "hover:bg-accent",
                d.unread > 0 && d.id !== activeId && "font-semibold"
              )}
            >
              <UserAvatar fullName={d.otherName ?? "?"} size="sm" />
              <span className="min-w-0 flex-1 truncate">{d.otherName ?? "Conversación"}</span>
              {d.unread > 0 && d.id !== activeId && (
                <span className="rounded-full bg-[#d9342c] px-1.5 text-[11px] font-semibold text-white">{d.unread}</span>
              )}
            </Link>
          ))}
        </section>
      </div>
      <Button variant="outline" onClick={() => setDmOpen(true)}>
        <MessageSquarePlus className="size-4" />
        Nuevo mensaje
      </Button>

      <Dialog open={dmOpen} onOpenChange={setDmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo mensaje directo</DialogTitle>
            <DialogDescription>Conversación privada entre tú y otra persona del equipo.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {team.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={pending}
                onClick={() => openDm(m.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
              >
                <UserAvatar fullName={m.name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{m.name}</span>
                  {m.department && <span className="block truncate text-xs text-muted-foreground">{m.department}</span>}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <NewChannelDialog open={channelOpen} onOpenChange={setChannelOpen} team={team} />
    </div>
  );
}

function NewChannelDialog({ open, onOpenChange, team }: { open: boolean; onOpenChange: (o: boolean) => void; team: Member[] }) {
  const router = useRouter();
  const [isPrivate, setIsPrivate] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await createChannelAction({
                name: String(fd.get("name") ?? ""),
                description: String(fd.get("description") ?? ""),
                isPrivate,
                memberIds: selected,
              });
              if (!r.ok) return void toast.error(r.error);
              toast.success("Canal creado.");
              onOpenChange(false);
              setSelected([]);
              router.push(`/chat/${r.data}`);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Nuevo canal</DialogTitle>
            <DialogDescription>Para un frente de trabajo, campaña o grupo de personas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ch-name">Nombre *</Label>
            <Input id="ch-name" name="name" required placeholder="lanzamiento-torres-del-parque" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-desc">Descripción</Label>
            <Textarea id="ch-desc" name="description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: false, icon: Hash, t: "Público", d: "Todo el equipo" },
              { v: true, icon: Lock, t: "Privado / grupo", d: "Solo quienes elijas" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => setIsPrivate(o.v)}
                className={cn("rounded-xl border p-3 text-left transition-all", isPrivate === o.v ? "border-[#d9342c] ring-2 ring-[#d9342c]/30" : "hover:bg-accent")}
              >
                <o.icon className="mb-1 size-4" />
                <p className="text-sm font-semibold">{o.t}</p>
                <p className="text-xs text-muted-foreground">{o.d}</p>
              </button>
            ))}
          </div>
          {isPrivate && (
            <div className="space-y-2">
              <Label>Miembros</Label>
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                {team.map((m) => {
                  const on = selected.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelected(on ? selected.filter((x) => x !== m.id) : [...selected, m.id])}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        on ? "border-[#d9342c] bg-[#d9342c]/10 text-[#d9342c]" : "hover:bg-accent"
                      )}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || (isPrivate && selected.length === 0)}>
              {pending ? "Creando..." : "Crear canal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
