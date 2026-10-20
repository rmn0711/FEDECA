# Mesa de Ayuda ACF

Plataforma interna de solicitudes (helpdesk) de Constructora ACF, con el mismo estilo visual del **Cotizador ACF**
(panel lateral de vidrio oscuro, rojo de marca `#d9342c`, componentes shadcn/Base UI, tipografía Geist).

Los usuarios registran lo que necesitan y su prioridad; la mesa de ayuda recibe un correo **con copia al responsable
del área y a quien la registró**, se hace todo el seguimiento en la plataforma y cada respuesta llega **por la
plataforma y por correo**. Las respuestas a esos correos también pueden volver a la plataforma (ver
[Respuestas por correo](#respuestas-por-correo)).

## Categorías

Cada categoría tiene un **responsable** (Administración → Categorías y responsables) y campos propios.
Responsables iniciales: **José Romano** (Sistemas, SINCO, IA y Cotizador), **Elías Saad** (CRM), **Mario Hernández**
(Diseño gráfico) y **Claribel Marchena** (Redes sociales).
Se crean en el primer arranque con los correos de `src/lib/db/team.ts`; ajústelos en Usuarios.

| Categoría | Campos específicos |
| --- | --- |
| **Diseño gráfico** | Tipo de pieza, formato, medidas, cantidad, fecha de entrega, marca, textos, referencias |
| **Inteligencia Artificial** | Tipo de solicitud, herramienta, frecuencia, usuarios, datos sensibles, proceso actual, resultado esperado |
| **Cotizador** | Tipo de solicitud, cliente, NIT, producto/proyecto, N.º de cotización, valor estimado, fecha límite, condiciones |
| **Redes sociales** | Redes, tipo de publicación, objetivo, fecha y hora, presupuesto de pauta, material gráfico, copy |
| **Sistemas** | Tipo, placa del equipo, sede, a quién afecta, ¿puede trabajar?, acceso remoto, mensaje de error |
| **CRM** | Tipo, módulo, proyecto/campaña, contacto o negocio, usuario del CRM, fecha requerida, error/pasos |
| **Sinco Soft** | Módulo, tipo, empresa/proyecto/obra, usuario SINCO, N.º de documento, mensaje de error, pasos |

Los campos se definen en `src/lib/categories.ts`.

## Prioridades y tiempos de respuesta (ANS)

Se cuentan en **horas hábiles**: lunes a viernes, 8:00 a. m. – 5:00 p. m., hora de Colombia
(`BUSINESS_HOURS` en `src/lib/constants.ts`).

| Prioridad | Primera respuesta | Solución | Cuándo usarla |
| --- | --- | --- | --- |
| **Alta** | 1 hora hábil | 4 horas hábiles (mismo día) | Operación detenida o impacto directo en clientes, ventas o varias personas, sin alternativa. |
| **Media** | 4 horas hábiles | 2 días hábiles | Afecta parcialmente a una persona o un área; existe una alternativa temporal. |
| **Baja** | 1 día hábil | 5 días hábiles | Consultas, mejoras, capacitaciones o solicitudes planificadas que no impiden trabajar. |

La plataforma muestra en cada solicitud si la primera respuesta y la solución están *A tiempo*, *Por vencer*,
*Vencido*, *Cumplido* o *Fuera de tiempo*, y el inicio muestra el % de cumplimiento del mes. La página
**Prioridades y tiempos** explica cada nivel con ejemplos.

## Flujo y correos

Estados: **Abierto → En progreso → En espera → Resuelto → Cerrado**.

| Evento | Para | Copia |
| --- | --- | --- |
| Nueva solicitud | Mesa de ayuda (Administración → Notificaciones) | Responsable de la categoría, solicitante, copias |
| Respuesta del equipo | Solicitante | Responsable, mesa de ayuda, copias |
| Respuesta del solicitante | Responsable asignado | Solicitante, mesa de ayuda, copias |
| Cambio de estado / resuelta | Solicitante | Responsable, mesa de ayuda, copias |
| Asignación | Nuevo responsable | Solicitante, mesa de ayuda |
| Nota interna | Responsable | Mesa de ayuda (nunca al solicitante) |
| Calificación (1–5 ★) | Responsable | Mesa de ayuda |

- La primera respuesta pública del equipo pasa la solicitud a *En progreso* automáticamente.
- Si el solicitante responde una solicitud *En espera*, vuelve a *En progreso*; si responde una *Resuelta*, se reabre.
- Para marcar *Resuelta* hay que describir la solución; el solicitante la califica y queda *Cerrada*.
- Todos los correos quedan en **Administración → Registro de correos** con vista previa.

## Espacio de equipo (marketing digital y generación de demanda)

Solo para el líder y los responsables (los solicitantes no lo ven). Menú **Equipo**:

- **Espacio de equipo**: proyectos con avance, entregas de los próximos 7 días, carga por persona y páginas recientes.
  Arranca con *Marketing digital* y *Generación de demanda*.
- **Proyectos** con vista **Tablero** (arrastrar y soltar), **Lista** y **Calendario**. Cada tarea tiene responsable
  (se le avisa por correo), prioridad, fechas, canales (Instagram, Meta Ads, CRM…), checklist, descripción con formato
  y comentarios. Una solicitud del helpdesk se puede **convertir en tarea** desde su detalle.
- **Mi pipeline**: en un solo tablero, las **solicitudes del helpdesk por resolver** de cada persona (asignadas o sin
  asignar de sus categorías; se arrastran entre Abierto, En progreso y En espera) y sus tareas del equipo. El líder
  puede ver el pipeline de cada integrante.
- **Calendario**: calendario de contenidos y entregas de todos los proyectos.
- **Páginas** tipo Notion: subpáginas, ícono, títulos, listas de tareas que se marcan con un clic, tablas, citas y
  guardado automático. Incluye plantillas: *Cómo trabajamos*, *Plan de marketing digital*, *Calendario editorial*,
  *Embudo de generación de demanda* y *Fuentes de leads*.

## Chat del equipo (tipo Slack)

- **Canales** públicos (todo el equipo) y **privados/grupos** (solo quienes se elijan), y **mensajes directos** 1 a 1.
- Formato, @menciones, emojis, reacciones, edición y borrado, archivos e imágenes (también pegando o arrastrando).
- Se actualiza solo cada 3 segundos; el menú muestra los mensajes sin leer.
- Canales iniciales: `#general`, `#marketing-digital` y `#generacion-de-demanda`.

## Alertas

Botón **Alertas** en la barra superior (mismo panel del cotizador), actualizado cada minuto:

- Solicitudes a tu cargo: solución vencida, sin primera respuesta a tiempo, por vencer, el solicitante respondió y nuevas.
- Tareas vencidas o que vencen hoy; para el líder, tareas en revisión, solicitudes vencidas de otros y sin responsable.
- Mensajes del chat sin leer, y en tus propias solicitudes: las que esperan tu respuesta o tu calificación.
- **Resumen diario por correo** (lunes a viernes, 7:00 a. m.) con lo vencido y lo que vence hoy: `vercel.json` +
  variable `CRON_SECRET`.

## Roles

- **Solicitante**: crea solicitudes y ve solo las suyas.
- **Responsable**: atiende las de sus categorías o las asignadas (estado, prioridad, reasignar, notas internas).
- **Administrador**: ve y gestiona todo, configura categorías, responsables, usuarios y notificaciones.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar valores
npm run dev                  # http://localhost:3000
```

Sin `DATABASE_URL` se usa una base PostgreSQL embebida en `./.data` (solo desarrollo). En producción configure
`DATABASE_URL` con cualquier PostgreSQL (por ejemplo el mismo Supabase del cotizador: las tablas usan el prefijo
`hd_` para no chocar). El esquema se crea solo al arrancar. El primer arranque crea el administrador con
`ADMIN_EMAIL` / `ADMIN_PASSWORD`; con `SEED_DEMO=true` carga un responsable por categoría y solicitudes de
ejemplo (contraseña `Demo2026*`).

Variables obligatorias en producción: `AUTH_SECRET` (≥ 32 caracteres), `DATABASE_URL`, `APP_URL`, y para enviar
correos `SMTP_USER` / `SMTP_PASSWORD` (misma casilla de Microsoft 365 que usa el cotizador).

Despliegue en Vercel: importar el repositorio y cargar las variables de `.env.example`.

## Respuestas por correo

Para que quien responda un correo de la mesa de ayuda quede registrado en la plataforma:

1. Configure `INBOUND_EMAIL_SECRET` y, opcionalmente, `MAIL_REPLY_TO` con el buzón que recibe las respuestas.
2. En **Power Automate** cree un flujo *“Cuando llega un correo nuevo (V3)”* sobre ese buzón, agregue la acción
   *“Html a texto”* sobre el cuerpo del correo y luego una acción **HTTP POST** a `https://SU-DOMINIO/api/inbound-email?secret=SU_SECRETO` y cuerpo JSON:
   ```json
   { "from": "@{triggerOutputs()?['body/from']}", "subject": "@{triggerOutputs()?['body/subject']}", "text": "@{body('Html_a_texto')}" }
   ```
   (también funciona con SendGrid Inbound Parse, Mailgun o Postmark).

El asunto debe conservar el código `[HD-00012]`; el remitente debe ser un usuario registrado con acceso a la
solicitud. El texto citado del correo anterior se elimina automáticamente.

## Scripts

`npm run dev` · `npm run build` · `npm run start` · `npm run lint`
