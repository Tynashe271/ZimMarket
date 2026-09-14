CREATE TYPE "FiscalisationMethod" AS ENUM ('PHYSICAL_DEVICE', 'VIRTUAL_DEVICE', 'FDMS_API');
CREATE TYPE "FiscalisationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
CREATE TABLE "BusinessFiscalisation" (
  "id" UUID NOT NULL, "businessId" UUID NOT NULL, "tin" TEXT NOT NULL,
  "method" "FiscalisationMethod" NOT NULL, "deviceIdentifier" TEXT NOT NULL,
  "zimraRegistrationEvidenceKey" TEXT NOT NULL, "licenceExpiresAt" TIMESTAMP(3) NOT NULL,
  "status" "FiscalisationStatus" NOT NULL DEFAULT 'PENDING', "receiptVerifiedAt" TIMESTAMP(3),
  "receiptVerificationReference" TEXT, "reviewedById" UUID, "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT, "reminder14SentAt" TIMESTAMP(3), "reminder7SentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessFiscalisation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BusinessFiscalisation_businessId_key" ON "BusinessFiscalisation"("businessId");
CREATE INDEX "BusinessFiscalisation_status_licenceExpiresAt_idx" ON "BusinessFiscalisation"("status", "licenceExpiresAt");
ALTER TABLE "BusinessFiscalisation" ADD CONSTRAINT "BusinessFiscalisation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
UPDATE "Business" SET "status" = 'PENDING' WHERE "status" = 'ACTIVE';
UPDATE "Product" SET "status" = 'DRAFT' WHERE "status" = 'ACTIVE';
