PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS organizer_profiles (
 id TEXT PRIMARY KEY, display_name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'individual',
 description TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
 social_link TEXT NOT NULL DEFAULT '', owner_id TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_owner ON organizer_profiles(owner_id);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, legacy_event_id TEXT, owner_id TEXT NOT NULL, organizer_name TEXT NOT NULL DEFAULT '',
 title TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
 cultural_relevance TEXT NOT NULL DEFAULT '', supporting_links_json TEXT NOT NULL DEFAULT '[]',
 format TEXT NOT NULL DEFAULT 'Luring', start_date TEXT NOT NULL DEFAULT '', end_date TEXT NOT NULL DEFAULT '',
 start_time TEXT NOT NULL DEFAULT '', end_time TEXT NOT NULL DEFAULT '', venue TEXT NOT NULL DEFAULT '',
 address TEXT NOT NULL DEFAULT '', district TEXT NOT NULL DEFAULT '', map_link TEXT NOT NULL DEFAULT '',
 latitude REAL, longitude REAL, ticket_type TEXT NOT NULL DEFAULT 'Gratis', ticket_price TEXT NOT NULL DEFAULT '',
 ticket_link TEXT NOT NULL DEFAULT '', registration_info TEXT NOT NULL DEFAULT '',
 responsibility_letter_name TEXT NOT NULL DEFAULT '', poster_path TEXT NOT NULL DEFAULT '',
 poster_name TEXT NOT NULL DEFAULT '', poster_content_type TEXT NOT NULL DEFAULT '',
 responsibility_letter_path TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
 admin_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 published_at TEXT NOT NULL DEFAULT '', cancellation_requested INTEGER NOT NULL DEFAULT 0,
 cancellation_reason TEXT NOT NULL DEFAULT '', cancellation_requested_at TEXT NOT NULL DEFAULT '',
 cancellation_admin_note TEXT NOT NULL DEFAULT '', cancelled_at TEXT NOT NULL DEFAULT '',
 history_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_events_owner ON events(owner_id);
CREATE INDEX IF NOT EXISTS idx_events_status_dates ON events(status, end_date);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_legacy_event_id ON events(legacy_event_id);
CREATE TABLE IF NOT EXISTS admins (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, granted_by TEXT NOT NULL DEFAULT '',
 revoked_by TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS admin_audit (
 id TEXT PRIMARY KEY, actor_user_id TEXT NOT NULL DEFAULT '', actor_email TEXT NOT NULL,
 action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit(actor_email);
