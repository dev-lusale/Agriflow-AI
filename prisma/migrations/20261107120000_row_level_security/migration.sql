-- Row Level Security hardening.
-- The application connects through Prisma as the table owner and enforces authorisation in the
-- service layer. RLS is enabled (without permissive policies) on every table so that Supabase's
-- auto-generated REST/GraphQL APIs (roles "anon" and "authenticated") cannot read or write data
-- even if the anon key is exposed. On plain PostgreSQL this is harmless.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
  END IF;
END $$;
