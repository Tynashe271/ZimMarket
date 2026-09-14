ALTER TABLE "User"
ADD COLUMN "fullName" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "suburb" TEXT,
ADD COLUMN "notificationPreference" TEXT NOT NULL DEFAULT 'EMAIL',
ADD COLUMN "policyVersion" TEXT,
ADD COLUMN "policyAcceptedAt" TIMESTAMP(3);
