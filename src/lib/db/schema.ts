import { bigint, boolean, customType, doublePrecision, integer, jsonb, pgTable, primaryKey, real, serial, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { Role, Status, Urgency } from "@/lib/constants";
import type { ChecklistItem, Recurrence, TaskStatus } from "@/lib/workspace/constants";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("hd_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull().default("user"),
  department: text("department"),
  phone: text("phone"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastLoginAt: ts("last_login_at"),
  /** Enlace personal de acceso: /acceso/<token> (la persona solo digita su contraseña) */
  accessToken: text("access_token").unique(),
});

export const categories = pgTable("hd_categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  responsibleId: integer("responsible_id").references(() => users.id, { onDelete: "set null" }),
  /** Correos adicionales que siempre van en copia para esta categoría */
  ccEmails: text("cc_emails"),
  active: boolean("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const tickets = pgTable("hd_tickets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categorySlug: text("category_slug")
    .notNull()
    .references(() => categories.slug),
  urgency: text("urgency").$type<Urgency>().notNull(),
  status: text("status").$type<Status>().notNull().default("abierto"),
  requesterId: integer("requester_id")
    .notNull()
    .references(() => users.id),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
  fields: jsonb("fields").$type<Record<string, string | string[]>>().notNull().default({}),
  ccEmails: text("cc_emails"),
  /** Vencimiento de la primera respuesta (ANS) */
  responseDueAt: ts("response_due_at").notNull(),
  /** Vencimiento de la solución (ANS) */
  dueAt: ts("due_at").notNull(),
  firstResponseAt: ts("first_response_at"),
  resolvedAt: ts("resolved_at"),
  closedAt: ts("closed_at"),
  rating: integer("rating"),
  ratingComment: text("rating_comment"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type EventType = "created" | "comment" | "note" | "status" | "assign" | "urgency" | "rating" | "category";

export const ticketEvents = pgTable("hd_ticket_events", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").$type<EventType>().notNull(),
  body: text("body"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  /** "web" o "email" (respuesta recibida por correo) */
  source: text("source").notNull().default("web"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const attachments = pgTable("hd_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  eventId: integer("event_id").references(() => ticketEvents.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const emailLog = pgTable("hd_email_log", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  to: text("to").notNull(),
  cc: text("cc"),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  /** enviado | fallido | simulado */
  status: text("status").notNull(),
  error: text("error"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const passwordResets = pgTable("hd_password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const settings = pgTable("hd_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ── Espacio de equipo ──

export const projects = pgTable("hd_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("📁"),
  color: text("color").notNull().default("#d9342c"),
  archived: boolean("archived").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tasks = pgTable("hd_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").$type<TaskStatus>().notNull().default("por_hacer"),
  priority: text("priority").$type<Urgency>().notNull().default("media"),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
  /** Fechas como texto AAAA-MM-DD (sin zona horaria) */
  startDate: text("start_date"),
  dueDate: text("due_date"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull().default([]),
  sort: doublePrecision("sort").notNull().default(0),
  /** none | weekdays | weekly | biweekly | monthly */
  recurrence: text("recurrence").$type<Recurrence>().notNull().default("none"),
  ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  completedAt: ts("completed_at"),
});

export const taskComments = pgTable("hd_task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const pages = pgTable("hd_pages", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id"),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull().default("Sin título"),
  icon: text("icon").notNull().default("📄"),
  content: text("content").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Page = typeof pages.$inferSelect;

// ── Chat del equipo ──

export const conversations = pgTable("hd_conversations", {
  id: serial("id").primaryKey(),
  kind: text("kind").$type<"channel" | "dm">().notNull(),
  name: text("name"),
  description: text("description"),
  isPrivate: boolean("is_private").notNull().default(false),
  /** Para mensajes directos: "idMenor:idMayor" (evita duplicados) */
  dmKey: text("dm_key").unique(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastMessageAt: ts("last_message_at").notNull().defaultNow(),
});

export const conversationMembers = pgTable(
  "hd_conversation_members",
  {
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: ts("last_read_at").notNull().defaultNow(),
    joinedAt: ts("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] })]
);

export const messages = pgTable("hd_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull().default(""),
  editedAt: ts("edited_at"),
  deletedAt: ts("deleted_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  /** Cambia con cada edición o reacción: el chat consulta "lo que cambió desde…" */
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const messageReactions = pgTable(
  "hd_message_reactions",
  {
    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })]
);

export const messageFiles = pgTable("hd_message_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
});

export const auditLog = pgTable("hd_audit_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  ip: text("ip"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const kbArticles = pgTable("hd_kb_articles", {
  id: serial("id").primaryKey(),
  categorySlug: text("category_slug").references(() => categories.slug, { onDelete: "set null" }),
  title: text("title").notNull(),
  summary: text("summary"),
  body: text("body").notNull().default(""),
  keywords: text("keywords"),
  published: boolean("published").notNull().default(true),
  views: integer("views").notNull().default(0),
  helpful: integer("helpful").notNull().default(0),
  notHelpful: integer("not_helpful").notNull().default(0),
  /** Veces que el artículo resolvió el problema y evitó crear una solicitud */
  deflections: integer("deflections").notNull().default(0),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const reviews = pgTable("hd_reviews", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  note: text("note"),
  status: text("status").$type<"pendiente" | "aprobada" | "cambios">().notNull().default("pendiente"),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  submittedBy: integer("submitted_by").references(() => users.id, { onDelete: "set null" }),
  submittedAt: ts("submitted_at").notNull().defaultNow(),
  decidedBy: integer("decided_by").references(() => users.id, { onDelete: "set null" }),
  decidedAt: ts("decided_at"),
  decisionComment: text("decision_comment"),
});

export const reviewComments = pgTable("hd_review_comments", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  /** Posición del comentario sobre la imagen, en % (null = comentario general) */
  x: real("x"),
  y: real("y"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("hd_push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const followups = pgTable("hd_followups", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes"),
  remindAt: ts("remind_at"),
  status: text("status").$type<"pendiente" | "hecho">().notNull().default("pendiente"),
  /** Persona a la que se le hace seguimiento (opcional) */
  personId: integer("person_id").references(() => users.id, { onDelete: "set null" }),
  ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "set null" }),
  notifiedAt: ts("notified_at"),
  doneAt: ts("done_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const marketingMetrics = pgTable(
  "hd_marketing_metrics",
  {
    id: serial("id").primaryKey(),
    /** AAAA-MM */
    month: text("month").notNull(),
    /** Proyecto inmobiliario o campaña */
    project: text("project").notNull(),
    channel: text("channel").notNull(),
    spend: bigint("spend", { mode: "number" }).notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    leads: integer("leads").notNull().default(0),
    qualified: integer("qualified").notNull().default(0),
    visits: integer("visits").notNull().default(0),
    quotes: integer("quotes").notNull().default(0),
    sales: integer("sales").notNull().default(0),
    /** manual | csv | api */
    source: text("source").notNull().default("manual"),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.month, t.project, t.channel)]
);

export type User = typeof users.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type TicketEvent = typeof ticketEvents.$inferSelect;
export type Category = typeof categories.$inferSelect;
