import { eq } from "drizzle-orm";
import type { DB } from "./index";
import { pages, projects, settings, users } from "./schema";

const FLAG = "workspace_v1";

const GUIA = `Este es el espacio de trabajo del equipo de **marketing digital y generación de demanda** de ACF.

## Cómo trabajamos

- Todo trabajo vive como **tarea** dentro de un proyecto, con responsable y fecha de entrega.
- Las solicitudes que llegan a la mesa de ayuda (Diseño, Redes, CRM…) se pueden **convertir en tarea** desde la solicitud.
- Revisamos el tablero cada **lunes a las 8:30 a. m.** y cerramos la semana el **viernes**.
- Los documentos (planes, guías, actas) van en **Páginas**.

## Estados de una tarea

| Estado | Significa |
| --- | --- |
| Por hacer | Priorizada, aún sin empezar |
| En curso | Alguien está trabajando en ella |
| En revisión | Lista para aprobación del líder |
| Hecho | Publicada / entregada |

## Rituales

- [ ] Reunión semanal de tablero (lunes)
- [ ] Informe de resultados de pauta (viernes)
- [ ] Comité de contenidos del mes (último jueves)
`;

const PLAN_MKT = `## Objetivo del trimestre

> Escriba aquí el objetivo principal. Ej.: *Aumentar 30 % los leads calificados de los proyectos en venta.*

## Indicadores (KPI)

| Indicador | Meta | Actual | Responsable |
| --- | --- | --- | --- |
| Alcance en redes | | | Claribel Marchena |
| Leads desde pauta | | | |
| Costo por lead (CPL) | | | |
| Visitas a sala de ventas | | | |

## Estrategia por canal

### Redes sociales
- Pilares de contenido: proyectos, avance de obra, testimonios, educación financiera.
- Frecuencia: 4 publicaciones + 10 historias por semana.

### Pauta digital (Meta / Google)
- Campañas siempre activas por proyecto.
- Optimización semanal por costo por lead.

### Diseño
- Piezas solicitadas a través de la mesa de ayuda (categoría Diseño gráfico).

## Presupuesto

| Mes | Pauta | Producción | Total |
| --- | --- | --- | --- |
| | | | |
`;

const CALENDARIO = `Calendario editorial del mes. Cada publicación también debe existir como **tarea** en el proyecto *Marketing digital* con su fecha, para verla en la vista **Calendario**.

| Fecha | Red | Formato | Tema / proyecto | Copy | Estado |
| --- | --- | --- | --- | --- | --- |
| | Instagram | Reel | | | Por hacer |
| | Facebook | Carrusel | | | Por hacer |
| | LinkedIn | Post | | | Por hacer |

## Fechas especiales del mes

-
`;

const EMBUDO = `## Etapas del embudo

| Etapa | Definición | Meta mensual | Fuente |
| --- | --- | --- | --- |
| Lead | Dejó sus datos (formulario, WhatsApp, sala) | | CRM |
| Lead calificado | Cumple perfil de compra (ingresos, interés) | | CRM |
| Visita a sala | Asistió a sala de ventas o recorrido | | Turnero / CRM |
| Cotización | Recibió cotización formal | | Cotizador |
| Separación | Separó unidad | | Cotizador |

## Acciones por etapa

### Atraer
- [ ] Campañas de pauta por proyecto
- [ ] Landing pages con formulario conectado al CRM

### Convertir
- [ ] Respuesta a leads en menos de 15 minutos
- [ ] Secuencia de WhatsApp y correo de seguimiento

### Cerrar
- [ ] Eventos de sala y open house
- [ ] Ofertas por tiempo limitado

## Aprendizajes

-
`;

const FUENTES = `## Fuentes de leads

| Fuente | Leads mes | Calificados | Costo | CPL |
| --- | --- | --- | --- | --- |
| Meta Ads | | | | |
| Google Ads | | | | |
| Orgánico redes | | | | |
| Referidos | | | | |
| Ferias / eventos | | | | |

## Próximos experimentos

1.
`;

/** Proyectos y páginas de arranque del espacio de equipo (una sola vez). */
export async function seedWorkspace(db: DB) {
  const [done] = await db.select().from(settings).where(eq(settings.key, FLAG));
  if (done) return;

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  const createdBy = owner?.id ?? null;

  const [mkt] = await db
    .insert(projects)
    .values({
      name: "Marketing digital",
      description: "Redes sociales, contenido, pauta y diseño de los proyectos de ACF.",
      icon: "📣",
      color: "#d9342c",
      sort: 0,
      createdBy,
    })
    .returning();
  const [demand] = await db
    .insert(projects)
    .values({
      name: "Generación de demanda",
      description: "Campañas, embudo, leads, CRM y conversión a visitas y separaciones.",
      icon: "🎯",
      color: "#2a78d6",
      sort: 1,
      createdBy,
    })
    .returning();

  await db.insert(pages).values({ title: "Cómo trabajamos", icon: "🧭", content: GUIA, sort: 0, createdBy, updatedBy: createdBy });
  const [plan] = await db
    .insert(pages)
    .values({ title: "Plan de marketing digital", icon: "📣", content: PLAN_MKT, projectId: mkt.id, sort: 1, createdBy, updatedBy: createdBy })
    .returning();
  await db
    .insert(pages)
    .values({ title: "Calendario editorial", icon: "🗓️", content: CALENDARIO, parentId: plan.id, projectId: mkt.id, sort: 0, createdBy, updatedBy: createdBy });
  const [funnel] = await db
    .insert(pages)
    .values({ title: "Embudo de generación de demanda", icon: "🎯", content: EMBUDO, projectId: demand.id, sort: 2, createdBy, updatedBy: createdBy })
    .returning();
  await db
    .insert(pages)
    .values({ title: "Fuentes de leads y metas", icon: "🧲", content: FUENTES, parentId: funnel.id, projectId: demand.id, sort: 0, createdBy, updatedBy: createdBy });

  await db.insert(settings).values({ key: FLAG, value: new Date().toISOString() }).onConflictDoNothing();
}
