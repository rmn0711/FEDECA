"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, FileText, Hash, Lock, LogOut, Paperclip, Pencil, Send, SmilePlus, Trash2, UserPlus, Users, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  deleteMessageAction,
  editMessageAction,
  leaveChannelAction,
  loadOlderAction,
  pollChatAction,
  sendMessageAction,
  toggleReactionAction,
  updateChannelAction,
} from "@/lib/actions/chat";
import type { ChatMessage } from "@/lib/chat/service";
import { MAX_FILE_BYTES, MAX_FILES, ROLE_LABELS, type Role } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { StickerPicker } from "@/components/chat/sticker-picker";
import { isUploadedSticker, messageSticker, stickerMessage, stickerSource } from "@/lib/chat/stickers";

const POLL_MS = 3000;
const QUICK = ["👍", "❤️", "😂", "🎉", "👀", "✅", "🙌", "🔥"];
const EMOJIS = ["😀", "😂", "😊", "😍", "🤔", "😅", "😎", "🙏", "👍", "👏", "🙌", "💪", "🔥", "🎉", "✅", "❌", "⚠️", "📣", "🎯", "📈", "💡", "🗓️", "⏰", "🚀"];
const GROUP_MS = 5 * 60_000;

type Info = {
  id: number;
  kind: "channel" | "dm";
  name: string | null;
  description: string | null;
  isPrivate: boolean;
  createdBy: number | null;
};
type Member = { id: number; name: string; role: Role; department: string | null };

function dayLabel(d: Date) {
  const fmt = (x: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(x);
  const today = fmt(new Date());
  const yesterday = fmt(new Date(Date.now() - 86_400_000));
  const key = fmt(d);
  if (key === today) return "Hoy";
  if (key === yesterday) return "Ayer";
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).format(d);
}

const timeOf = (d: Date) => new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(d);
const dayKey = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(d);

function MessageBody({ body, meName }: { body: string; meName: string }) {
  const sticker = messageSticker(body);
  if (sticker) return <Image src={stickerSource(sticker)} alt={`Sticker: ${sticker.label}`} width={180} height={180} className="my-1 h-40 w-40 object-contain" />;
  // Resalta las menciones @Nombre (especialmente las tuyas).
  const first = meName.split(" ")[0];
  const withMentions = body.replace(/(^|\s)@([\p{L}][\p{L}.-]*(?: [\p{Lu}][\p{L}]+)?)/gu, (_m, pre: string, name: string) => `${pre}**@${name}**`);
  return (
    <div className={cn("md md-chat text-sm", body.includes(`@${first}`) && "rounded-md bg-[#eb6834]/10 px-1")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {withMentions}
      </ReactMarkdown>
    </div>
  );
}

export function ConversationView({
  me,
  info,
  members,
  otherMember,
  initialMessages,
  initialHasMore,
  team,
}: {
  me: { id: number; name: string; role: Role };
  info: Info;
  members: Member[];
  otherMember: Member | null;
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
  team: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ChatMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [, startTransition] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const cursor = useRef({ since: new Date().toISOString(), afterId: initialMessages.at(-1)?.id ?? 0 });
  const stickToBottom = useRef(true);
  const prependAnchor = useRef<number | null>(null);

  const title = info.kind === "dm" ? (otherMember?.name ?? "Mensaje directo") : `${info.name}`;

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setItems((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      return Array.from(map.values())
        .filter((m) => m.id > 0)
        .sort((a, b) => a.id - b.id);
    });
    const maxId = Math.max(cursor.current.afterId, ...incoming.map((m) => m.id));
    cursor.current.afterId = maxId;
  }, []);

  // Consulta periódica de mensajes nuevos, ediciones y reacciones.
  useEffect(() => {
    let alive = true;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const visible = document.visibilityState === "visible";
        const r = await pollChatAction(info.id, cursor.current.since, cursor.current.afterId, visible);
        if (!alive || !r.ok) return;
        cursor.current.since = r.data.serverTime;
        if (r.data.changes.length) {
          const fresh = r.data.changes.some((m) => m.id > cursor.current.afterId && m.authorId !== me.id);
          merge(r.data.changes);
          if (fresh && !stickToBottom.current) setShowNew(true);
        }
      } finally {
        running = false;
      }
    };
    void tick();
    const t = setInterval(tick, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [info.id, me.id, merge]);

  // Mantiene la vista abajo con mensajes nuevos, y la posición al cargar anteriores.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prependAnchor.current !== null) {
      el.scrollTop = el.scrollHeight - prependAnchor.current;
      prependAnchor.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stickToBottom.current) setShowNew(false);
  }

  function scrollDown() {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowNew(false);
  }

  function loadOlder() {
    const first = items[0];
    if (!first) return;
    startTransition(async () => {
      const r = await loadOlderAction(info.id, first.id);
      if (!r.ok) return void toast.error(r.error);
      prependAnchor.current = (scroller.current?.scrollHeight ?? 0) - (scroller.current?.scrollTop ?? 0);
      setHasMore(r.data.hasMore);
      merge(r.data.messages);
    });
  }

  async function send(sticker?: { body: string; files: File[] }) {
    const text = sticker ? sticker.body : body.trim();
    const outgoingFiles = sticker ? sticker.files : files;
    if ((!text && outgoingFiles.length === 0) || sending) return;
    setSending(true);
    const fd = new FormData();
    fd.set("conversationId", String(info.id));
    fd.set("body", text);
    outgoingFiles.forEach((f) => fd.append("files", f));
    // Mensaje optimista mientras el servidor confirma.
    const temp: ChatMessage = {
      id: -Date.now(),
      authorId: me.id,
      authorName: me.name,
      body: text,
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
      updatedAt: new Date(),
      reactions: [],
      files: [],
    };
    setItems((prev) => [...prev, temp]);
    stickToBottom.current = true;
    if (!sticker) {
      setBody("");
      setFiles([]);
    }
    let accepted = false;
    try {
      const r = await sendMessageAction(fd);
      if (!r.ok) throw new Error(r.error);
      accepted = true;
      const p = await pollChatAction(info.id, cursor.current.since, cursor.current.afterId, true);
      if (p.ok) {
        cursor.current.since = p.data.serverTime;
        merge(p.data.changes);
      }
    } catch (error) {
      if (!accepted) {
        toast.error(error instanceof Error ? error.message : "No se pudo enviar el mensaje.");
        if (!sticker) {
          setBody((current) => current || text);
          setFiles(outgoingFiles);
        }
      }
    } finally {
      setSending(false);
      setItems((prev) => prev.filter((m) => m.id !== temp.id));
      textarea.current?.focus();
    }
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) toast.error(`"${f.name}" supera 10 MB.`);
      else if (next.length < MAX_FILES) next.push(f);
    }
    setFiles(next);
  }

  async function react(id: number, emoji: string) {
    // Actualización optimista de la reacción.
    setItems((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const existing = m.reactions.find((r) => r.emoji === emoji);
        let reactions = m.reactions;
        if (existing?.userIds.includes(me.id)) {
          reactions = m.reactions
            .map((r) => (r.emoji === emoji ? { ...r, userIds: r.userIds.filter((u) => u !== me.id), names: r.names.filter((n) => n !== me.name) } : r))
            .filter((r) => r.userIds.length > 0);
        } else if (existing) {
          reactions = m.reactions.map((r) => (r.emoji === emoji ? { ...r, userIds: [...r.userIds, me.id], names: [...r.names, me.name] } : r));
        } else {
          reactions = [...m.reactions, { emoji, userIds: [me.id], names: [me.name] }];
        }
        return { ...m, reactions };
      })
    );
    const r = await toggleReactionAction(id, emoji);
    if (!r.ok) toast.error(r.error);
  }

  async function saveEdit() {
    if (!editing) return;
    const { id, body: text } = editing;
    setEditing(null);
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, body: text, editedAt: new Date() } : m)));
    const r = await editMessageAction(id, text);
    if (!r.ok) toast.error(r.error);
  }

  async function remove(id: number) {
    if (!confirm("¿Eliminar este mensaje?")) return;
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, deletedAt: new Date(), body: "", files: [], reactions: [] } : m)));
    const r = await deleteMessageAction(id);
    if (!r.ok) toast.error(r.error);
  }

  function leave() {
    if (!confirm(`¿Salir de ${title}?`)) return;
    startTransition(async () => {
      const r = await leaveChannelAction(info.id);
      if (!r.ok) return void toast.error(r.error);
      router.push("/chat");
    });
  }

  const canManage = info.kind === "channel" && (me.role === "admin" || info.createdBy === me.id);
  const notMembers = team.filter((t) => !members.some((m) => m.id === t.id));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/chat" className="text-muted-foreground hover:text-foreground md:hidden" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        {info.kind === "dm" ? (
          <UserAvatar fullName={title} />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
            {info.isPrivate ? <Lock className="size-4" /> : <Hash className="size-4" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {info.kind === "dm"
              ? [otherMember ? ROLE_LABELS[otherMember.role] : null, otherMember?.department].filter(Boolean).join(" · ")
              : info.description || (info.isPrivate ? "Canal privado" : "Canal público del equipo")}
          </p>
        </div>
        {info.kind === "channel" && (
          <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)}>
            <Users className="size-3.5" />
            {members.length}
          </Button>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto px-4 py-3">
          {hasMore ? (
            <div className="pb-3 text-center">
              <Button variant="ghost" size="sm" onClick={loadOlder}>
                Cargar mensajes anteriores
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pt-6 pb-6">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                {info.kind === "dm" ? <UserAvatar fullName={title} /> : info.isPrivate ? <Lock className="size-5" /> : <Hash className="size-5" />}
              </span>
              <p className="text-lg font-semibold">{info.kind === "dm" ? title : `Este es el inicio de #${info.name}`}</p>
              <p className="text-sm text-muted-foreground">
                {info.kind === "dm" ? `Conversación privada entre tú y ${title}.` : info.description || "Escribe el primer mensaje."}
              </p>
            </div>
          )}

          {items.map((m, i) => {
            const prev = items[i - 1];
            const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
            const grouped =
              !newDay && prev && prev.authorId === m.authorId && !prev.deletedAt && m.createdAt.getTime() - prev.createdAt.getTime() < GROUP_MS;
            const mine = m.authorId === me.id;
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="rounded-full border px-3 py-0.5 text-xs font-medium text-muted-foreground first-letter:uppercase">{dayLabel(m.createdAt)}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className={cn("group relative flex gap-3 rounded-lg px-2 py-0.5 hover:bg-muted/50", !grouped && "mt-2 pt-1.5", m.id < 0 && "opacity-60")}>
                  <div className="w-9 shrink-0">
                    {!grouped ? (
                      <UserAvatar fullName={m.authorName ?? "?"} />
                    ) : (
                      <span className="hidden pt-1 text-[10px] text-muted-foreground group-hover:block">{timeOf(m.createdAt)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {!grouped && (
                      <p className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold">{m.authorName ?? "Usuario"}</span>
                        <span className="text-xs text-muted-foreground">{timeOf(m.createdAt)}</span>
                      </p>
                    )}
                    {m.deletedAt ? (
                      <p className="text-sm text-muted-foreground italic">Mensaje eliminado</p>
                    ) : editing?.id === m.id ? (
                      <div className="space-y-1.5 py-1">
                        <textarea
                          autoFocus
                          value={editing.body}
                          onChange={(e) => setEditing({ id: m.id, body: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void saveEdit();
                            }
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="field-sizing-content w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-3 focus:ring-ring/30"
                        />
                        <p className="text-xs text-muted-foreground">Enter para guardar · Esc para cancelar</p>
                      </div>
                    ) : (
                      <>
                        {m.body && <MessageBody body={m.body} meName={me.name} />}
                        {m.editedAt && <span className="text-[11px] text-muted-foreground">(editado)</span>}
                      </>
                    )}
                    {m.files.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {m.files.map((f) =>
                          f.mime.startsWith("image/") ? (
                            <a key={f.id} href={`/api/chat-archivos/${f.id}`} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/api/chat-archivos/${f.id}`} alt={isUploadedSticker(f) ? `Sticker: ${f.filename.slice(8)}` : f.filename} className={isUploadedSticker(f) ? "h-40 w-40 object-contain" : "max-h-60 max-w-xs rounded-lg border object-cover"} />
                            </a>
                          ) : (
                            <a
                              key={f.id}
                              href={`/api/chat-archivos/${f.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs hover:bg-accent"
                            >
                              <FileText className="size-4 text-[#d9342c]" />
                              <span className="max-w-[200px] truncate font-medium">{f.filename}</span>
                              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                            </a>
                          )
                        )}
                      </div>
                    )}
                    {m.reactions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() => react(m.id, r.emoji)}
                            title={r.names.join(", ")}
                            className={cn(
                              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                              r.userIds.includes(me.id) ? "border-[#d9342c]/50 bg-[#d9342c]/10" : "hover:bg-accent"
                            )}
                          >
                            <span>{r.emoji}</span>
                            <span className="font-medium">{r.userIds.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {!m.deletedAt && m.id > 0 && editing?.id !== m.id && (
                    <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm group-hover:flex">
                      {QUICK.slice(0, 4).map((e) => (
                        <button key={e} type="button" onClick={() => react(m.id, e)} className="rounded-md px-1.5 py-0.5 text-sm hover:bg-accent" aria-label={`Reaccionar ${e}`}>
                          {e}
                        </button>
                      ))}
                      <Popover>
                        <PopoverTrigger
                          render={
                            <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Más reacciones">
                              <SmilePlus className="size-4" />
                            </button>
                          }
                        />
                        <PopoverContent className="w-56">
                          <div className="grid grid-cols-6 gap-1">
                            {[...QUICK, ...EMOJIS].filter((e, i2, arr) => arr.indexOf(e) === i2).map((e) => (
                              <button key={e} type="button" onClick={() => react(m.id, e)} className="rounded-md p-1 text-lg hover:bg-accent">
                                {e}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {mine && m.body && !messageSticker(m.body) && (
                        <button type="button" onClick={() => setEditing({ id: m.id, body: m.body })} className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Editar mensaje">
                          <Pencil className="size-4" />
                        </button>
                      )}
                      {(mine || me.role === "admin") && (
                        <button type="button" onClick={() => remove(m.id)} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive" aria-label="Eliminar mensaje">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {showNew && (
          <button
            type="button"
            onClick={scrollDown}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#d9342c] px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
          >
            <ArrowDown className="size-3.5" />
            Mensajes nuevos
          </button>
        )}
      </div>

      <div className="border-t p-3">
        <div
          className="rounded-xl border bg-background focus-within:ring-3 focus-within:ring-ring/30"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b p-2">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs">
                  <Paperclip className="size-3" />
                  <span className="max-w-[160px] truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            onPaste={(e) => {
              const pasted = Array.from(e.clipboardData.files);
              if (pasted.length) {
                e.preventDefault();
                addFiles(pasted);
              }
            }}
            rows={1}
            placeholder={info.kind === "dm" ? `Mensaje para ${title}` : `Mensaje en #${info.name}`}
            className="field-sizing-content max-h-48 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <label className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" title="Adjuntar archivo">
                <Paperclip className="size-4" />
                <input type="file" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
              <Popover>
                <PopoverTrigger
                  render={
                    <button type="button" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Emoji">
                      <SmilePlus className="size-4" />
                    </button>
                  }
                />
                <PopoverContent className="w-56">
                  <div className="grid grid-cols-6 gap-1">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setBody((b) => b + e);
                          textarea.current?.focus();
                        }}
                        className="rounded-md p-1 text-lg hover:bg-accent"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <StickerPicker disabled={sending}
                onSelect={(id) => void send({ body: stickerMessage(id), files: [] })}
                onUpload={(file) => void send({ body: "", files: [file] })} />
              <span className="hidden text-[11px] text-muted-foreground sm:inline">Enter envía · Shift+Enter nueva línea · **negrita** · @menciones</span>
            </div>
            <Button size="sm" onClick={() => void send()} disabled={sending || (!body.trim() && files.length === 0)} className="bg-[#d9342c] text-white hover:bg-[#c42d26]">
              <Send className="size-3.5" />
              Enviar
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {info.isPrivate ? "🔒" : "#"} {info.name}
            </DialogTitle>
            <DialogDescription>{members.length} miembro(s)</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                <UserAvatar fullName={m.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {m.name}
                  {m.id === me.id && <span className="text-muted-foreground"> (tú)</span>}
                </span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[m.role]}</span>
                {canManage && info.isPrivate && m.id !== me.id && (
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await updateChannelAction(info.id, { removeIds: [m.id] });
                        if (!r.ok) return void toast.error(r.error);
                        router.refresh();
                      })
                    }
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Quitar a ${m.name}`}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {info.isPrivate && notMembers.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <UserPlus className="size-4" />
                Agregar personas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {notMembers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await updateChannelAction(info.id, { addIds: [t.id] });
                        if (!r.ok) return void toast.error(r.error);
                        toast.success(`${t.name} agregado.`);
                        router.refresh();
                      })
                    }
                    className="rounded-full border px-3 py-1 text-sm hover:bg-accent"
                  >
                    + {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {info.isPrivate && (
            <Button variant="outline" className="text-destructive" onClick={leave}>
              <LogOut className="size-4" />
              Salir del canal
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

