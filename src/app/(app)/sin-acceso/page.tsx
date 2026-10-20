import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NoAccessPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <ShieldAlert className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold">No tienes acceso a esta sección</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Si crees que es un error, contacta al administrador de la mesa de ayuda.</p>
      <Button variant="outline" render={<Link href="/dashboard">Volver al inicio</Link>} />
    </div>
  );
}
