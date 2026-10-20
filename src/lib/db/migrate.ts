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
  // ── Espacio de equipo (proyectos, tareas y páginas) ──
  `CREATE TABLE IF NOT EXISTS hd_projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL DEFAULT '📁',
    color TEXT NOT NULL DEFAULT '#d9342c',
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    sort INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS hd_tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES hd_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'por_hacer' CHECK (status IN ('por_hacer','en_curso','en_revision','hecho')),
    priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('alta','media','baja')),
    assignee_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    start_date TEXT,
    due_date TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort DOUBLE PRECISION NOT NULL DEFAULT 0,
    ticket_id INTEGER REFERENCES hd_tickets(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS hd_tasks_project_idx ON hd_tasks(project_id)`,
  `CREATE INDEX IF NOT EXISTS hd_tasks_assignee_idx ON hd_tasks(assignee_id)`,
  `CREATE TABLE IF NOT EXISTS hd_task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES hd_tasks(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_task_comments_task_idx ON hd_task_comments(task_id)`,
  `CREATE TABLE IF NOT EXISTS hd_pages (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES hd_pages(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES hd_projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Sin título',
    icon TEXT NOT NULL DEFAULT '📄',
    content TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_pages_parent_idx ON hd_pages(parent_id)`,
  // ── Chat del equipo (canales y mensajes directos) ──
  `CREATE TABLE IF NOT EXISTS hd_conversations (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('channel','dm')),
    name TEXT,
    description TEXT,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    dm_key TEXT UNIQUE,
    created_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS hd_conversation_members (
    conversation_id INTEGER NOT NULL REFERENCES hd_conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES hd_users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS hd_conversation_members_user_idx ON hd_conversation_members(user_id)`,
  `CREATE TABLE IF NOT EXISTS hd_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES hd_conversations(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    body TEXT NOT NULL DEFAULT '',
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_messages_conv_idx ON hd_messages(conversation_id, id)`,
  `CREATE INDEX IF NOT EXISTS hd_messages_updated_idx ON hd_messages(conversation_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS hd_message_reactions (
    message_id INTEGER NOT NULL REFERENCES hd_messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES hd_users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji)
  )`,
  `CREATE TABLE IF NOT EXISTS hd_message_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id INTEGER NOT NULL REFERENCES hd_messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BYTEA NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS hd_message_files_msg_idx ON hd_message_files(message_id)`,
  // ── Auditoría ──
  `CREATE TABLE IF NOT EXISTS hd_audit_log (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    summary TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_audit_log_created_idx ON hd_audit_log(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hd_audit_log_entity_idx ON hd_audit_log(entity, entity_id)`,
  // ── Base de conocimiento ──
  `CREATE TABLE IF NOT EXISTS hd_kb_articles (
    id SERIAL PRIMARY KEY,
    category_slug TEXT REFERENCES hd_categories(slug) ON DELETE SET NULL,
    title TEXT NOT NULL,
    summary TEXT,
    body TEXT NOT NULL DEFAULT '',
    keywords TEXT,
    published BOOLEAN NOT NULL DEFAULT TRUE,
    views INTEGER NOT NULL DEFAULT 0,
    helpful INTEGER NOT NULL DEFAULT 0,
    not_helpful INTEGER NOT NULL DEFAULT 0,
    deflections INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // Tareas recurrentes (columna agregada después: se añade si no existe).
  `ALTER TABLE hd_tasks ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none'`,
  // ── Aprobación de piezas ──
  `CREATE TABLE IF NOT EXISTS hd_reviews (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES hd_tasks(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','aprobada','cambios')),
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BYTEA NOT NULL,
    submitted_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    decision_comment TEXT,
    UNIQUE (task_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS hd_review_comments (
    id SERIAL PRIMARY KEY,
    review_id INTEGER NOT NULL REFERENCES hd_reviews(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    x REAL,
    y REAL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_review_comments_review_idx ON hd_review_comments(review_id)`,
  // ── Notificaciones push ──
  `CREATE TABLE IF NOT EXISTS hd_push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES hd_users(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_push_subscriptions_user_idx ON hd_push_subscriptions(user_id)`,
  // Enlace personal de acceso (solo contraseña) para clientes internos.
  `ALTER TABLE hd_users ADD COLUMN IF NOT EXISTS access_token TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_users_access_token_idx ON hd_users(access_token)`,
  // ── Seguimientos y recordatorios ──
  `CREATE TABLE IF NOT EXISTS hd_followups (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES hd_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT,
    remind_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','hecho')),
    person_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    ticket_id INTEGER REFERENCES hd_tickets(id) ON DELETE SET NULL,
    task_id INTEGER REFERENCES hd_tasks(id) ON DELETE SET NULL,
    notified_at TIMESTAMPTZ,
    done_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS hd_followups_owner_idx ON hd_followups(owner_id, status)`,
  `CREATE INDEX IF NOT EXISTS hd_followups_due_idx ON hd_followups(remind_at) WHERE status = 'pendiente'`,
  // ── Métricas de marketing y generación de demanda ──
  `CREATE TABLE IF NOT EXISTS hd_marketing_metrics (
    id SERIAL PRIMARY KEY,
    month TEXT NOT NULL,
    project TEXT NOT NULL,
    channel TEXT NOT NULL,
    spend BIGINT NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    leads INTEGER NOT NULL DEFAULT 0,
    qualified INTEGER NOT NULL DEFAULT 0,
    visits INTEGER NOT NULL DEFAULT 0,
    quotes INTEGER NOT NULL DEFAULT 0,
    sales INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual',
    updated_by INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (month, project, channel)
  )`,
  // ── WhatsApp Business (Cloud API) ──
  `ALTER TABLE hd_users ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT`,
  `ALTER TABLE hd_users ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE hd_users ADD COLUMN IF NOT EXISTS whatsapp_prefs JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `ALTER TABLE hd_users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS hd_users_whatsapp_phone_idx ON hd_users(whatsapp_phone)`,
  `CREATE TABLE IF NOT EXISTS hd_whatsapp_log (
    id SERIAL PRIMARY KEY,
    direction TEXT NOT NULL DEFAULT 'out',
    user_id INTEGER REFERENCES hd_users(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    kind TEXT NOT NULL,
    template TEXT,
    body TEXT,
    ticket_id INTEGER REFERENCES hd_tickets(id) ON DELETE SET NULL,
    wa_message_id TEXT,
    status TEXT NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS hd_whatsapp_log_msg_idx ON hd_whatsapp_log(wa_message_id)`,
  `CREATE INDEX IF NOT EXISTS hd_whatsapp_log_ticket_idx ON hd_whatsapp_log(ticket_id, kind)`,
  `ALTER TABLE hd_whatsapp_log ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE hd_whatsapp_log ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ`,
  `CREATE INDEX IF NOT EXISTS hd_whatsapp_log_status_idx ON hd_whatsapp_log(status, created_at)`,
  // Avisos de vencimiento ya enviados (para no repetirlos).
  `ALTER TABLE hd_tickets ADD COLUMN IF NOT EXISTS response_alerted_at TIMESTAMPTZ`,
  `ALTER TABLE hd_tickets ADD COLUMN IF NOT EXISTS due_alerted_at TIMESTAMPTZ`,
];
