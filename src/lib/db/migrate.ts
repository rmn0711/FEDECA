/**
 * Esquema de la base de datos. Es idempotente (IF NOT EXISTS): se ejecuta
 * automáticamente al iniciar la aplicación, así que no hace falta correr
 * migraciones a mano. Las tablas usan el prefijo hd_ para poder convivir en
 * la misma base de datos de otros sistemas (p. ej. el Supabase del cotizador).
 */
export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS hd_users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','agent','user')),
    department TEXT,
    phone TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS hd_categories (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    responsible_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    cc_emails TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS hd_tickets (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category_slug TEXT NOT NULL REFERENCES hd_categories(slug),
    urgency TEXT NOT NULL CHECK (urgency IN ('alta','media','baja')),
    status TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto','en_progreso','en_espera','resuelto','cerrado')),
    requester_id INTEGER NOT NULL REFERENCES hd_users(id),
    assignee_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    cc_emails TEXT,
    response_due_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    rating_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_tickets_status_idx ON hd_tickets(status)`,
  `CREATE INDEX IF NOT EXISTS hd_tickets_requester_idx ON hd_tickets(requester_id)`,
  `CREATE INDEX IF NOT EXISTS hd_tickets_assignee_idx ON hd_tickets(assignee_id)`,
  `CREATE INDEX IF NOT EXISTS hd_tickets_category_idx ON hd_tickets(category_slug)`,
  `CREATE TABLE IF NOT EXISTS hd_ticket_events (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES hd_tickets(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    body TEXT,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    source TEXT NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_ticket_events_ticket_idx ON hd_ticket_events(ticket_id)`,
  `CREATE TABLE IF NOT EXISTS hd_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id INTEGER NOT NULL REFERENCES hd_tickets(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES hd_ticket_events(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BYTEA NOT NULL,
    uploaded_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_attachments_ticket_idx ON hd_attachments(ticket_id)`,
  `CREATE TABLE IF NOT EXISTS hd_email_log (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES hd_tickets(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    "to" TEXT NOT NULL,
    cc TEXT,
    subject TEXT NOT NULL,
    html TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS hd_password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES hd_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS hd_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];
