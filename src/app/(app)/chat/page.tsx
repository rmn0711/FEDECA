import { MessagesSquare } from "lucide-react";

export const metadata = { title: "Chat del equipo" };

export default function ChatIndex() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-[#d9342c]/10">
        <MessagesSquare className="size-7 text-[#d9342c]" />
      </span>
      <h1 className="text-xl font-semibold">Chat del equipo</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Elige un canal o una persona a la izquierda. Los canales son para conversaciones grupales y los mensajes directos para hablar uno a uno.
      </p>
    </div>
  );
}
