"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

export function CreatedToast() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    toast.success("Solicitud registrada", {
      description: "Enviamos la notificación por correo a la mesa de ayuda, al responsable y a ti.",
    });
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);
  return null;
}
