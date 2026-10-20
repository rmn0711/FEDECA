import { boolean, customType, doublePrecision, integer, jsonb, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Role, Status, Urgency } from "@/lib/constants";
import type { ChecklistItem, TaskStatus } from "@/lib/workspace/constants";

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

export type User = typeof users.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type TicketEvent = typeof ticketEvents.$inferSelect;
export type Category = typeof categories.$inferSelect;
