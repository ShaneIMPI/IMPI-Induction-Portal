-- ══════════════════════════════════════════════════════════════
-- IMPI Safety Induction Portal — Supabase Migration
-- Run this in the SQL Editor:
-- https://supabase.com/dashboard/project/rizcweifbwcnvxgakzfi/sql
-- ══════════════════════════════════════════════════════════════

-- ── 1. DISABLE ROW LEVEL SECURITY on all portal tables ────────
--    Required so the Netlify functions can read/write without
--    needing per-row Supabase policies.
ALTER TABLE IF EXISTS portal_settings  DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS events           DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS completions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_users      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS induction_topics DISABLE ROW LEVEL SECURITY;

-- ── 2. COLUMN ADDITIONS ───────────────────────────────────────

-- events: custom per-event induction topics (JSON array)
ALTER TABLE events ADD COLUMN IF NOT EXISTS induction_content jsonb;

-- portal_settings: single-row JSONB blob for all portal config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_settings' AND column_name = 'settings'
  ) THEN
    ALTER TABLE portal_settings ADD COLUMN settings jsonb DEFAULT '{}';
  END IF;
END $$;

-- admin_users: plain-text password for team member logins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'password'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN password text;
  END IF;
END $$;

-- completions: extra tracking columns
ALTER TABLE completions
  ADD COLUMN IF NOT EXISTS id_type    text    DEFAULT 'RSA ID',
  ADD COLUMN IF NOT EXISTS is_group   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;

-- ── 3. STORAGE BUCKET: event-files ───────────────────────────
--    Public bucket used for event logos, PDFs, and portal images.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-files', 'event-files', true, 52428800, null)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

-- ── 4. STORAGE POLICIES for event-files ──────────────────────
--    Auth is enforced at the Netlify function level (JWT check),
--    so the storage policies just need to allow the service key.

-- Storage policies: drop first (safe), then recreate
DROP POLICY IF EXISTS "Public read event-files"  ON storage.objects;
DROP POLICY IF EXISTS "Allow upload event-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow update event-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete event-files" ON storage.objects;

CREATE POLICY "Public read event-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-files');

CREATE POLICY "Allow upload event-files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-files');

CREATE POLICY "Allow update event-files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'event-files');

CREATE POLICY "Allow delete event-files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-files');
