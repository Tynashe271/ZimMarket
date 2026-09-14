-- AlterTable
ALTER TABLE "BusinessFiscalisation" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" UUID NOT NULL,
    "fiscalisationId" UUID NOT NULL,
    "documentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedById" UUID,
    "rejectionReason" TEXT,

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCheck" (
    "id" UUID NOT NULL,
    "fiscalisationId" UUID NOT NULL,
    "checkType" TEXT NOT NULL,
    "checkMethod" TEXT NOT NULL,
    "checkResult" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedById" UUID,
    "apiResponse" JSONB,
    "adminNotes" TEXT,
    "nextRetryAt" TIMESTAMP(3),

    CONSTRAINT "ComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReminder" (
    "id" UUID NOT NULL,
    "fiscalisationId" UUID NOT NULL,
    "reminderType" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveryMethod" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,

    CONSTRAINT "ComplianceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreRestriction" (
    "id" UUID NOT NULL,
    "fiscalisationId" UUID NOT NULL,
    "restrictionType" TEXT NOT NULL,
    "isRestricted" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "imposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imposedById" UUID,
    "liftedAt" TIMESTAMP(3),
    "liftedById" UUID,

    CONSTRAINT "StoreRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAuditLog" (
    "id" UUID NOT NULL,
    "fiscalisationId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "actorType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceDocument_fiscalisationId_documentType_idx" ON "ComplianceDocument"("fiscalisationId", "documentType");

-- CreateIndex
CREATE INDEX "ComplianceDocument_verificationStatus_idx" ON "ComplianceDocument"("verificationStatus");

-- CreateIndex
CREATE INDEX "ComplianceCheck_fiscalisationId_checkType_idx" ON "ComplianceCheck"("fiscalisationId", "checkType");

-- CreateIndex
CREATE INDEX "ComplianceCheck_checkResult_checkedAt_idx" ON "ComplianceCheck"("checkResult", "checkedAt");

-- CreateIndex
CREATE INDEX "ComplianceReminder_fiscalisationId_scheduledFor_idx" ON "ComplianceReminder"("fiscalisationId", "scheduledFor");

-- CreateIndex
CREATE INDEX "ComplianceReminder_deliveryStatus_scheduledFor_idx" ON "ComplianceReminder"("deliveryStatus", "scheduledFor");

-- CreateIndex
CREATE INDEX "StoreRestriction_fiscalisationId_restrictionType_idx" ON "StoreRestriction"("fiscalisationId", "restrictionType");

-- CreateIndex
CREATE INDEX "StoreRestriction_isRestricted_idx" ON "StoreRestriction"("isRestricted");

-- CreateIndex
CREATE INDEX "ComplianceAuditLog_fiscalisationId_timestamp_idx" ON "ComplianceAuditLog"("fiscalisationId", "timestamp");

-- CreateIndex
CREATE INDEX "ComplianceAuditLog_action_timestamp_idx" ON "ComplianceAuditLog"("action", "timestamp");

-- CreateIndex
CREATE INDEX "ComplianceAuditLog_actorId_timestamp_idx" ON "ComplianceAuditLog"("actorId", "timestamp");

-- CreateIndex
CREATE INDEX "BusinessFiscalisation_taxpayerActive_deviceActive_idx" ON "BusinessFiscalisation"("taxpayerActive", "deviceActive");

-- CreateIndex
CREATE INDEX "BusinessFiscalisation_nextReviewAt_idx" ON "BusinessFiscalisation"("nextReviewAt");

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_fiscalisationId_fkey" FOREIGN KEY ("fiscalisationId") REFERENCES "BusinessFiscalisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCheck" ADD CONSTRAINT "ComplianceCheck_fiscalisationId_fkey" FOREIGN KEY ("fiscalisationId") REFERENCES "BusinessFiscalisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReminder" ADD CONSTRAINT "ComplianceReminder_fiscalisationId_fkey" FOREIGN KEY ("fiscalisationId") REFERENCES "BusinessFiscalisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRestriction" ADD CONSTRAINT "StoreRestriction_fiscalisationId_fkey" FOREIGN KEY ("fiscalisationId") REFERENCES "BusinessFiscalisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceAuditLog" ADD CONSTRAINT "ComplianceAuditLog_fiscalisationId_fkey" FOREIGN KEY ("fiscalisationId") REFERENCES "BusinessFiscalisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
