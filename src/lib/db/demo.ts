import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { DB } from "./index";
import { categories, ticketEvents, tickets, users } from "./schema";
import { URGENCY_META, addBusinessHours, type Status, type Urgency } from "@/lib/constants";

/** Datos de demostración (SEED_DEMO=true): un responsable por categoría y solicitudes de ejemplo. */
export async function seedDemo(db: DB) {
  const hash = await bcrypt.hash("Demo2026*", 10);
  const agents: Array<[string, string, string, string]> = [
    ["diseno", "Laura Gómez", "diseno@demo.acf", "Diseño gráfico"],
    ["ia", "Andrés Rojas", "ia@demo.acf", "Transformación digital"],
    ["cotizador", "Carolina Pérez", "cotizador@demo.acf", "Comercial"],
    ["redes", "Valentina Ruiz", "redes@demo.acf", "Mercadeo"],
    ["sistemas", "Julián Martínez", "sistemas@demo.acf", "Tecnología"],
    ["sinco", "Diana Castro", "sinco@demo.acf", "Administrativa y financiera"],
  ];
  const agentIds: Record<string, number> = {};
  for (const [slug, name, email, department] of agents) {
    const [u] = await db.insert(users).values({ name, email, department, role: "agent", passwordHash: hash }).returning();
    agentIds[slug] = u.id;
    await db.update(categories).set({ responsibleId: u.id }).where(eq(categories.slug, slug));
  }
  const [requester] = await db
    .insert(users)
    .values({ name: "Mateo Herrera", email: "usuario@demo.acf", department: "Obra Altos del Río", role: "user", passwordHash: hash })
    .returning();

  const samples: Array<{
    slug: string;
    title: string;
    description: string;
    urgency: Urgency;
    status: Status;
    hoursAgo: number;
    fields: Record<string, string | string[]>;
    reply?: string;
  }> = [
    {
      slug: "sinco",
      title: "Error al aprobar orden de compra en Compras",
      description: "Al aprobar la OC aparece 'El centro de costo no tiene presupuesto disponible', pero sí tiene saldo.",
      urgency: "alta",
      status: "en_progreso",
      hoursAgo: 3,
      fields: { modulo: "Compras", tipo: "Error / falla", empresa: "Proyecto Altos del Río", documento: "OC-15873" },
      reply: "Hola Mateo, ya estamos revisando la parametrización del presupuesto de la obra. Te confirmo en una hora.",
    },
    {
      slug: "diseno",
      title: "Pieza para lanzamiento de la etapa 2",
      description: "Necesitamos un post y una historia para anunciar el lanzamiento de la etapa 2 con el precio desde.",
      urgency: "media",
      status: "abierto",
      hoursAgo: 20,
      fields: { tipo_pieza: "Post para redes sociales", formato: "Digital", fecha_entrega: "2026-10-28", medidas: "1080 x 1350 px" },
    },
    {
      slug: "sistemas",
      title: "Impresora del piso 3 no imprime",
      description: "La impresora muestra 'sin conexión' desde esta mañana. Varias personas del área están afectadas.",
      urgency: "media",
      status: "resuelto",
      hoursAgo: 50,
      fields: { tipo: "Impresora / escáner", ubicacion: "Oficina principal, piso 3", afectados: "A mi área", puede_trabajar: "Parcialmente" },
      reply: "Se reinició el servidor de impresión y se reasignó la IP fija. Ya está imprimiendo.",
    },
    {
      slug: "ia",
      title: "Automatizar resumen semanal de informes de obra",
      description: "Cada semana consolidamos 8 informes en Word. Queremos un resumen automático para gerencia.",
      urgency: "baja",
      status: "abierto",
      hoursAgo: 6,
      fields: { tipo_solicitud: "Automatización de un proceso", herramienta: "Claude", datos_sensibles: "No", resultado_esperado: "Resumen de 1 página con avances, riesgos y pendientes." },
    },
  ];

  for (const s of samples) {
    const createdAt = new Date(Date.now() - s.hoursAgo * 3_600_000);
    const responseDueAt = addBusinessHours(createdAt, URGENCY_META[s.urgency].responseHours);
    const dueAt = addBusinessHours(createdAt, URGENCY_META[s.urgency].slaHours);
    const replyAt = new Date(createdAt.getTime() + 40 * 60_000);
    const [t] = await db
      .insert(tickets)
      .values({
        title: s.title,
        description: s.description,
        categorySlug: s.slug,
        urgency: s.urgency,
        status: s.status,
        requesterId: requester.id,
        assigneeId: agentIds[s.slug],
        fields: s.fields,
        responseDueAt,
        dueAt,
        firstResponseAt: s.reply ? replyAt : null,
        resolvedAt: s.status === "resuelto" ? replyAt : null,
        createdAt,
        updatedAt: s.reply ? replyAt : createdAt,
      })
      .returning();
    await db.insert(ticketEvents).values({ ticketId: t.id, authorId: requester.id, type: "created", createdAt });
    if (s.reply) {
      if (s.status === "resuelto") {
        await db.insert(ticketEvents).values({
          ticketId: t.id,
          authorId: agentIds[s.slug],
          type: "status",
          body: s.reply,
          meta: { from: "abierto", to: "resuelto" },
          createdAt: replyAt,
        });
      } else {
        await db.insert(ticketEvents).values({ ticketId: t.id, authorId: agentIds[s.slug], type: "comment", body: s.reply, createdAt: replyAt });
        await db.insert(ticketEvents).values({
          ticketId: t.id,
          type: "status",
          meta: { from: "abierto", to: s.status, auto: true },
          createdAt: new Date(replyAt.getTime() + 1),
        });
      }
    }
  }
  console.info("[mesa-de-ayuda] Datos de demostración cargados (contraseña de los usuarios demo: Demo2026*)");
}
