"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateCategoryAction } from "@/lib/actions/admin";
import type { FormState } from "@/lib/actions/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryIcon } from "@/components/tickets/badges";

const initialState: FormState = { error: null };

export function CategoryCard(props: {
  slug: string;
  name: string;
  description: string;
  fieldCount: number;
  responsibleId: number | null;
  ccEmails: string;
  active: boolean;
  staff: Array<{ id: number; name: string; email: string }>;
}) {
  const [state, action, pending] = useActionState(updateCategoryAction, initialState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success(`${props.name}: ${state.ok}`);
  }, [state, props.name]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <CategoryIcon slug={props.slug} className="size-10" />
        <div className="min-w-0 flex-1">
          <CardTitle>{props.name}</CardTitle>
          <CardDescription>
            {props.description} · {props.fieldCount} campos específicos
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="slug" value={props.slug} />
          <div className="space-y-2">
            <Label>Responsable</Label>
            <Select name="responsibleId" defaultValue={props.responsibleId ? String(props.responsibleId) : "none"}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin responsable (llega a la mesa de ayuda)</SelectItem>
                {props.staff.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name} · {s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`cc-${props.slug}`}>Copia permanente (opcional)</Label>
            <Input id={`cc-${props.slug}`} name="ccEmails" defaultValue={props.ccEmails} placeholder="jefe.area@acfcia.com" />
            <p className="text-xs text-muted-foreground">Estos correos reciben copia de todas las notificaciones de esta categoría.</p>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={props.active} className="size-4 accent-[#d9342c]" />
              Disponible para nuevas solicitudes
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
