"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { sendTestWhatsappAction } from "@/lib/actions/whatsapp";
import { Button } from "@/components/ui/button";

/** Refresca el estado (y el QR) cada pocos segundos mientras se vincula. */
export function BridgeAutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function TestWhatsappButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await sendTestWhatsappAction();
          if (!r.ok) return void toast.error(r.error);
          toast.success("Mensaje de prueba en la bandeja.");
          router.refresh();
        })
      }
    >
      <Send className="size-4" />
      Enviarme una prueba
    </Button>
  );
}
