-- Optional defence-in-depth policies. The API already scopes every private query.
-- Apply only after the connection pool sets app.user_id and app.business_id per transaction.
CREATE POLICY business_member_scope ON "BusinessMember"
  USING ("userId" = current_setting('app.user_id', true)::uuid OR "businessId" = current_setting('app.business_id', true)::uuid);
CREATE POLICY product_business_scope ON "Product"
  USING ("businessId" = current_setting('app.business_id', true)::uuid);
CREATE POLICY order_business_scope ON "Order"
  USING ("businessId" = current_setting('app.business_id', true)::uuid OR "customerId" = current_setting('app.user_id', true)::uuid);
CREATE POLICY conversation_scope ON "Conversation"
  USING ("businessId" = current_setting('app.business_id', true)::uuid OR "customerId" = current_setting('app.user_id', true)::uuid);
-- ALTER TABLE statements are deliberately not included: enabling RLS before every
-- worker/provider transaction supplies context would deny legitimate background jobs.
