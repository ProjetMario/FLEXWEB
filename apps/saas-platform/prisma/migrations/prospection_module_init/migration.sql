-- Prospection module init migration
-- Apply via Supabase SQL Editor or `prisma migrate dev` when DATABASE_URL is reachable

-- Create enums
CREATE TYPE "ProspectionStatus" AS ENUM (
  'NOUVEAU',
  'A_CONTACTER',
  'SMS_ENVOYE',
  'SANS_REPONSE',
  'REPONDU',
  'INTERESSE',
  'A_RELANCER',
  'RDV_PLANIFIE',
  'RDV_EFFECTUE',
  'DEVIS_ENVOYE',
  'NEGOCIATION',
  'CLIENT_SIGNE',
  'PAS_INTERESSE',
  'A_RECONTACTER_PLUS_TARD',
  'PERDU'
);

CREATE TYPE "InteractionType" AS ENUM (
  'PROSPECT_AJOUTE',
  'SMS_ENVOYE',
  'REPONSE_RECUE',
  'APPEL',
  'EMAIL',
  'NOTE',
  'RELANCE',
  'RDV',
  'DEVIS',
  'CLIENT_SIGNE',
  'STATUT_MODIFIE'
);

CREATE TYPE "FollowUpStatus" AS ENUM (
  'PENDING',
  'DONE',
  'SKIPPED'
);

-- Extend existing Appointment table
ALTER TABLE "Appointment" ADD COLUMN "prospectId" TEXT;
CREATE INDEX "Appointment_prospectId_idx" ON "Appointment"("prospectId");

-- Campaigns
CREATE TABLE "SmsCampaign" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "city" TEXT,
  "department" TEXT,
  "country" TEXT NOT NULL DEFAULT 'France',
  "businessType" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SmsCampaign_status_idx" ON "SmsCampaign"("status");
CREATE INDEX "SmsCampaign_startDate_idx" ON "SmsCampaign"("startDate");

-- SMS templates
CREATE TABLE "SmsTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Prospects
CREATE TABLE "Prospect" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "website" TEXT,
  "googleBusinessUrl" TEXT,
  "businessType" TEXT,
  "category" TEXT,
  "city" TEXT,
  "department" TEXT,
  "country" TEXT NOT NULL DEFAULT 'France',
  "source" TEXT,
  "googleReviewCount" INTEGER,
  "googleRating" DOUBLE PRECISION,
  "internalNotes" TEXT,
  "status" "ProspectionStatus" NOT NULL DEFAULT 'NOUVEAU',
  "setupFee" INTEGER,
  "monthlyPrice" INTEGER,
  "oneTimePrice" INTEGER,
  "estimatedValue" INTEGER,
  "signedValue" INTEGER,
  "campaignId" TEXT,
  "nextFollowUpAt" TIMESTAMP(3),
  "firstSmsSentAt" TIMESTAMP(3),
  "lastInteractionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Prospect_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmsCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Prospect_phone_companyName_key" UNIQUE ("phone", "companyName")
);
CREATE INDEX "Prospect_status_idx" ON "Prospect"("status");
CREATE INDEX "Prospect_city_idx" ON "Prospect"("city");
CREATE INDEX "Prospect_businessType_idx" ON "Prospect"("businessType");
CREATE INDEX "Prospect_nextFollowUpAt_idx" ON "Prospect"("nextFollowUpAt");
CREATE INDEX "Prospect_campaignId_idx" ON "Prospect"("campaignId");

-- Prospect interactions
CREATE TABLE "ProspectInteraction" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "prospectId" TEXT NOT NULL,
  "type" "InteractionType" NOT NULL,
  "note" TEXT,
  "oldStatus" "ProspectionStatus",
  "newStatus" "ProspectionStatus",
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectInteraction_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProspectInteraction_prospectId_idx" ON "ProspectInteraction"("prospectId");
CREATE INDEX "ProspectInteraction_type_idx" ON "ProspectInteraction"("type");
CREATE INDEX "ProspectInteraction_createdAt_idx" ON "ProspectInteraction"("createdAt");

-- Follow-ups
CREATE TABLE "FollowUp" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "prospectId" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "doneAt" TIMESTAMP(3),
  "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowUp_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FollowUp_prospectId_idx" ON "FollowUp"("prospectId");
CREATE INDEX "FollowUp_dueAt_idx" ON "FollowUp"("dueAt");
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");

-- Prospect notes
CREATE TABLE "ProspectNote" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "prospectId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectNote_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProspectNote_prospectId_idx" ON "ProspectNote"("prospectId");

-- Link Appointment to Prospect
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
