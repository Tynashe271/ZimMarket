ALTER TYPE "FiscalisationMethod" ADD VALUE 'FISCALISED_POS' AFTER 'PHYSICAL_DEVICE';
ALTER TYPE "FiscalisationStatus" RENAME TO "ComplianceStatus";
ALTER TYPE "ComplianceStatus" RENAME VALUE 'PENDING' TO 'PENDING_VERIFICATION';
ALTER TYPE "ComplianceStatus" RENAME VALUE 'VERIFIED' TO 'COMPLIANT';
ALTER TYPE "ComplianceStatus" RENAME VALUE 'REJECTED' TO 'CHANGES_REQUIRED';
ALTER TYPE "ComplianceStatus" ADD VALUE 'DRAFT' BEFORE 'PENDING_VERIFICATION';
ALTER TYPE "ComplianceStatus" ADD VALUE 'EXPIRING_SOON' AFTER 'COMPLIANT';
ALTER TYPE "ComplianceStatus" ADD VALUE 'DEVICE_INACTIVE' AFTER 'EXPIRED';
ALTER TYPE "ComplianceStatus" ADD VALUE 'SUSPENDED' AFTER 'DEVICE_INACTIVE';
ALTER TYPE "ComplianceStatus" ADD VALUE 'UNDER_REVIEW' AFTER 'SUSPENDED';
ALTER TYPE "ComplianceStatus" ADD VALUE 'RENEWAL_PENDING' AFTER 'UNDER_REVIEW';
DROP INDEX "BusinessFiscalisation_status_licenceExpiresAt_idx";
ALTER TABLE "BusinessFiscalisation" RENAME COLUMN "licenceExpiresAt" TO "taxClearanceExpiresAt";
ALTER TABLE "BusinessFiscalisation"
  ADD COLUMN "registeredBusinessName" TEXT NOT NULL, ADD COLUMN "tradingName" TEXT NOT NULL,
  ADD COLUMN "taxpayerActive" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "vatNumber" TEXT,
  ADD COLUMN "taxClearanceCertificateNumber" TEXT NOT NULL, ADD COLUMN "taxClearanceIssuedAt" TIMESTAMP(3) NOT NULL,
  ADD COLUMN "taxClearanceDocumentKey" TEXT NOT NULL, ADD COLUMN "deviceModel" TEXT,
  ADD COLUMN "deviceSerialNumber" TEXT, ADD COLUMN "virtualDeviceIdentifier" TEXT,
  ADD COLUMN "approvedSupplierOrIntegrator" TEXT NOT NULL, ADD COLUMN "branchInformation" JSONB NOT NULL,
  ADD COLUMN "sampleFiscalReceiptKey" TEXT NOT NULL, ADD COLUMN "receiptVerificationCode" TEXT NOT NULL,
  ADD COLUMN "authorisedRepresentative" TEXT NOT NULL, ADD COLUMN "deviceActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deviceRegistered" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "reminder30SentAt" TIMESTAMP(3),
  ADD COLUMN "reminder3SentAt" TIMESTAMP(3), ADD COLUMN "reminder1SentAt" TIMESTAMP(3), ADD COLUMN "nextReviewAt" TIMESTAMP(3);
CREATE INDEX "BusinessFiscalisation_status_taxClearanceExpiresAt_idx" ON "BusinessFiscalisation"("status", "taxClearanceExpiresAt");
