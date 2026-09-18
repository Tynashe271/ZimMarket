-- Row-level security for the four highest-value tables: User, Order, Payment, Message.
--
-- These policies key off three session settings, which the app sets per unit of
-- work via PrismaService.withContext()/withSystemContext() (see
-- src/prisma/prisma.service.ts):
--   app.user_id       -- the authenticated caller's User.id, or '' if none
--   app.account_type  -- the authenticated caller's accountType, or '' if none
--   app.bypass_rls    -- 'true' for pre-auth, webhook, and background job paths
--                         that legitimately have no per-user session to key off
--
-- IMPORTANT (production/Neon): RLS policies never apply to a table's owner, and
-- FORCE ROW LEVEL SECURITY below only extends that to the owner -- not to a
-- role granted BYPASSRLS. These policies only enforce anything if the
-- application connects as a role that is (a) not the table owner, or owner
-- with FORCE applied, and (b) does NOT have the BYPASSRLS attribute. Neon's
-- default connection role is commonly the database owner. Before this has any
-- effect in production, create a non-owner, non-superuser, NOBYPASSRLS role
-- for the app to connect as (see backend/prisma/rls-role-setup.sql), grant it
-- table privileges, and point Render's DATABASE_URL at it. Until that's done,
-- this migration is inert in production (harmless, but provides no protection)
-- while still being fully enforced locally against a correctly configured role.

CREATE OR REPLACE FUNCTION app_bypass() RETURNS boolean AS $$
  SELECT current_setting('app.bypass_rls', true) = 'true';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_account_type() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.account_type', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean AS $$
  SELECT app_account_type() = 'ADMIN';
$$ LANGUAGE sql STABLE;

-- User -----------------------------------------------------------------

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_select ON "User" FOR SELECT USING (
  app_bypass() OR app_is_admin() OR id = app_user_id()
  OR EXISTS (
    SELECT 1 FROM "Order" o
    JOIN "BusinessMember" bm ON bm."businessId" = o."businessId"
    WHERE o."customerId" = "User".id AND bm."userId" = app_user_id()
  )
  OR EXISTS (
    SELECT 1 FROM "Conversation" c
    JOIN "BusinessMember" bm ON bm."businessId" = c."businessId"
    WHERE c."customerId" = "User".id AND bm."userId" = app_user_id()
  )
  -- Fellow staff on a business the caller also belongs to (e.g. business
  -- notification recipients, staff directory) -- not just customer contact.
  OR EXISTS (
    SELECT 1 FROM "BusinessMember" bm1
    JOIN "BusinessMember" bm2 ON bm2."businessId" = bm1."businessId"
    WHERE bm1."userId" = "User".id AND bm2."userId" = app_user_id()
  )
);

-- Registration is the only path that ever creates a User row, and it's
-- always pre-authentication (there is no session to scope it to yet).
CREATE POLICY user_insert ON "User" FOR INSERT WITH CHECK (app_bypass());

CREATE POLICY user_update ON "User" FOR UPDATE USING (
  app_bypass() OR app_is_admin() OR id = app_user_id()
) WITH CHECK (
  app_bypass() OR app_is_admin() OR id = app_user_id()
);

-- No DELETE policy: the app never hard-deletes a User row (account deletion is
-- a soft delete via UPDATE), so DELETE is denied by default under FORCE RLS.

-- Order ------------------------------------------------------------------

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;

CREATE POLICY order_select ON "Order" FOR SELECT USING (
  app_bypass() OR app_is_admin() OR "customerId" = app_user_id()
  OR EXISTS (SELECT 1 FROM "BusinessMember" bm WHERE bm."businessId" = "Order"."businessId" AND bm."userId" = app_user_id())
);

CREATE POLICY order_insert ON "Order" FOR INSERT WITH CHECK (
  app_bypass() OR "customerId" = app_user_id()
);

CREATE POLICY order_update ON "Order" FOR UPDATE USING (
  app_bypass() OR app_is_admin()
  OR EXISTS (SELECT 1 FROM "BusinessMember" bm WHERE bm."businessId" = "Order"."businessId" AND bm."userId" = app_user_id())
) WITH CHECK (
  app_bypass() OR app_is_admin()
  OR EXISTS (SELECT 1 FROM "BusinessMember" bm WHERE bm."businessId" = "Order"."businessId" AND bm."userId" = app_user_id())
);

-- Payment ------------------------------------------------------------------
-- Payment has no direct customerId/businessId column; scope through its Order.

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;

CREATE POLICY payment_select ON "Payment" FOR SELECT USING (
  app_bypass() OR app_is_admin()
  OR EXISTS (
    SELECT 1 FROM "Order" o WHERE o.id = "Payment"."orderId" AND (
      o."customerId" = app_user_id()
      OR EXISTS (SELECT 1 FROM "BusinessMember" bm WHERE bm."businessId" = o."businessId" AND bm."userId" = app_user_id())
    )
  )
);

CREATE POLICY payment_insert ON "Payment" FOR INSERT WITH CHECK (
  app_bypass()
  OR EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "Payment"."orderId" AND o."customerId" = app_user_id())
);

CREATE POLICY payment_update ON "Payment" FOR UPDATE USING (
  app_bypass() OR app_is_admin()
  OR EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "Payment"."orderId" AND o."customerId" = app_user_id())
) WITH CHECK (
  app_bypass() OR app_is_admin()
  OR EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "Payment"."orderId" AND o."customerId" = app_user_id())
);

-- Message ------------------------------------------------------------------
-- Visibility is per-conversation (either participant sees every message in
-- it), not per-sender -- a customer must be able to read the business's
-- replies and vice versa.

ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" FORCE ROW LEVEL SECURITY;

CREATE POLICY message_select ON "Message" FOR SELECT USING (
  app_bypass() OR app_is_admin()
  OR EXISTS (
    SELECT 1 FROM "Conversation" c WHERE c.id = "Message"."conversationId" AND (
      c."customerId" = app_user_id()
      OR EXISTS (SELECT 1 FROM "BusinessMember" bm WHERE bm."businessId" = c."businessId" AND bm."userId" = app_user_id())
    )
  )
);

CREATE POLICY message_insert ON "Message" FOR INSERT WITH CHECK (
  app_bypass() OR (
    "senderId" = app_user_id() AND EXISTS (
      SELECT 1 FROM "Conversation" c WHERE c.id = "Message"."conversationId" AND (
        c."customerId" = app_user_id()
        OR EXISTS (SELECT 1 FROM "BusinessMember" bm WHERE bm."businessId" = c."businessId" AND bm."userId" = app_user_id())
      )
    )
  )
);

CREATE POLICY message_update ON "Message" FOR UPDATE USING (
  app_bypass() OR app_is_admin() OR "senderId" = app_user_id()
) WITH CHECK (
  app_bypass() OR app_is_admin() OR "senderId" = app_user_id()
);
