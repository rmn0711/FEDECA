"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteArticleAction, saveArticleAction } from "@/lib/actions/kb";
import type { FormState } from "@/lib/actions/auth";
import { CATEGORIES } from "@/lib/categories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MarkdownEditor } from "@/components/workspace/markdown-editor";
import { Markdown } from "@/components/workspace/markdown";

const initialState: FormState = { error: null };

export function ArticleForm({
  article,
}: {
  article?: { id: number; title: string; summary: string | null; keywords: string | null; body: string; categorySlug: string | null; published: boolean };
}) {
  const [state, action] = useActionState(saveArticleAction, initialState);
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState(article?.body ?? "");
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("body", body);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="id" value={article?.id ?? ""} />
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Título *</Label>
            <Input id="title" name="title" required defaultValue={article?.title} placeholder="Ej: Cómo restablecer la contraseña de SINCO" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <select id="category" name="category" defaultValue={article?.categorySlug ?? ""} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm">
              <option value="">General</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="keywords">Palabras clave</Label>
            <Input id="keywords" name="keywords" defaultValue={article?.keywords ?? ""} placeholder="clave, bloqueado, acceso…" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="summary">Resumen</Label>
            <Input id="summary" name="summary" defaultValue={article?.summary ?? ""} placeholder="Una línea que aparece en la búsqueda" />
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <Label>Contenido *</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
          {preview ? "Editar" : "Vista previa"}
        </Button>
      </div>
      {preview ? (
        <div className="rounded-2xl border p-6">
          <Markdown source={body} />
        </div>
      ) : (
        <MarkdownEditor value={body} onChange={setBody} minRows={14} placeholder="Pasos, tablas, notas importantes…" />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" defaultChecked={article?.published ?? true} className="size-4 accent-[#d9342c]" />
          Publicado (visible para todos)
        </label>
        <div className="flex gap-2">
          {article && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => confirm("¿Eliminar este artículo?") && startTransition(() => deleteArticleAction(article.id))}
            >
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar artículo"}
          </Button>
        </div>
      </div>
    </form>
  );
}
