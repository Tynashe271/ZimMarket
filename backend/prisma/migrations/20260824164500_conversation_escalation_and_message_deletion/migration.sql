ALTER TABLE "Conversation" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "Conversation_escalatedAt_updatedAt_idx" ON "Conversation"("escalatedAt", "updatedAt");
