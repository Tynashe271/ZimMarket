-- One-time setup so Row-Level Security (see the
-- 20260918090000_enable_row_level_security migration) actually enforces
-- anything, on top of running the migration itself.
--
-- Postgres RLS policies never apply to a table's owner (FORCE ROW LEVEL
-- SECURITY only extends that to the owner, not past it) and never apply to a
-- role with the BYPASSRLS attribute. Today, ONE role does everything: it owns
-- the tables (via `prisma migrate deploy`) and is what the app's DATABASE_URL
-- connects as. Under that setup the migration above is syntactically valid
-- but functionally inert -- every query is running as the table owner, so
-- every policy always matches.
--
-- This script creates a second, non-owner role for the app to connect as
-- instead, while the original role keeps owning the tables and running
-- migrations.
--
-- LOCAL (Podman/docker-compose Postgres): run this file directly, then point
-- backend/.env's DATABASE_URL at the new role:
--   psql "$DATABASE_URL" -f prisma/rls-role-setup.sql
--
-- PRODUCTION (Neon): run the same statements via Neon's SQL editor or `psql`
-- against the Neon connection string from Neon's dashboard, using Neon's
-- existing owner role in place of "zimmarket" below. Then, in Render's
-- zimmarket-backend service -> Environment, change DATABASE_URL's user/password
-- to this new role (keep the same host/database). Do this deliberately and
-- test against Neon directly first -- nobody has done this step yet, so
-- RLS is not currently enforced in production; only the migration itself has
-- been applied there once deployed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zimmarket_app') THEN
    CREATE ROLE zimmarket_app WITH LOGIN PASSWORD 'change-me-zimmarket-app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO zimmarket_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zimmarket_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zimmarket_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO zimmarket_app;

-- So tables created by future `prisma migrate deploy` runs (owned by whichever
-- role runs them) stay reachable by the app role without re-running this script.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zimmarket_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO zimmarket_app;
