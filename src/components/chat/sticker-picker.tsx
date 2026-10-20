"use client";

import Image from "next/image";
import { useState } from "react";
import { Sticker, Upload } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CHAT_STICKERS, stickerSource } from "@/lib/chat/stickers";
import { MAX_FILE_BYTES } from "@/lib/constants";

export function StickerPicker({ disabled, onSelect, onUpload }: {
  disabled: boolean;
  onSelect: (id: string) => void;
  onUpload: (file: File) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
        <button type="button" disabled={disabled} aria-label="Stickers" title="Enviar un sticker"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
          <Sticker className="size-4" />
        </button>
      } />
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] p-3" align="start">
        <p className="mb-2 text-sm font-semibold">Stickers</p>
        <div className="grid grid-cols-4 gap-1" aria-label="Catálogo de stickers">
          {CHAT_STICKERS.map((sticker) => (
            <button key={sticker.id} type="button" disabled={disabled} aria-label={`Enviar sticker: ${sticker.label}`}
              title={sticker.label} className="rounded-xl p-1 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
              onClick={() => { setOpen(false); onSelect(sticker.id); }}>
              <Image src={stickerSource(sticker)} alt={sticker.label} width={96} height={96} className="h-auto w-full" />
            </button>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent">
          <Upload className="size-3.5" /> Subir mi sticker
          <input type="file" aria-label="Subir mi sticker" accept="image/png,image/webp,image/gif,image/jpeg" disabled={disabled} className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!["image/png", "image/webp", "image/gif", "image/jpeg"].includes(file.type)) return void toast.error("Elige una imagen PNG, WebP, GIF o JPG.");
              if (!file.size || file.size > MAX_FILE_BYTES) return void toast.error("El sticker debe pesar entre 1 byte y 10 MB.");
              setOpen(false);
              onUpload(new File([file], `sticker-${file.name}`, { type: file.type }));
            }} />
        </label>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Elige uno para enviarlo al instante.</p>
      </PopoverContent>
    </Popover>
  );
}
