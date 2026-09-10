ALTER TABLE "Prospect"
 ADD COLUMN "siren" TEXT,
 ADD COLUMN "siret" TEXT,
 ADD COLUMN "importKey" TEXT,
 ADD COLUMN "importBatch" TEXT,
 ADD COLUMN "sourceUrl" TEXT,
 ADD COLUMN "sourceCheckedAt" TIMESTAMP(3),
 ADD COLUMN "registryState" TEXT,
 ADD COLUMN "websiteFinding" TEXT NOT NULL DEFAULT 'TO_CHECK',
 ADD COLUMN "websiteEvidence" TEXT,
 ADD COLUMN "websiteCheckedAt" TIMESTAMP(3),
 ADD COLUMN "preferredChannel" TEXT NOT NULL DEFAULT 'NONE',
 ADD COLUMN "doNotContactAt" TIMESTAMP(3),
 ADD COLUMN "stopReason" TEXT;
CREATE UNIQUE INDEX "Prospect_siren_key" ON "Prospect"("siren");
CREATE UNIQUE INDEX "Prospect_importKey_key" ON "Prospect"("importKey");
CREATE INDEX "Prospect_importBatch_idx" ON "Prospect"("importBatch");
CREATE INDEX "Prospect_department_websiteFinding_idx" ON "Prospect"("department", "websiteFinding");
CREATE INDEX "Prospect_email_idx" ON "Prospect"("email");
CREATE INDEX "Prospect_phone_idx" ON "Prospect"("phone");
ALTER TABLE "SmsOutreachContact" ADD COLUMN "prospectId" TEXT;
CREATE UNIQUE INDEX "SmsOutreachContact_prospectId_key" ON "SmsOutreachContact"("prospectId");
ALTER TABLE "SmsOutreachContact" ADD CONSTRAINT "SmsOutreachContact_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Preserve every legacy lead; clear only dangling references before adding the FK.
UPDATE "OutreachLead" SET "prospectId"=NULL WHERE "prospectId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Prospect" WHERE "Prospect"."id"="OutreachLead"."prospectId");
ALTER TABLE "OutreachLead" ADD CONSTRAINT "OutreachLead_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OutreachLead_prospectId_idx" ON "OutreachLead"("prospectId");
CREATE INDEX "OutreachLead_phone_idx" ON "OutreachLead"("phone");
ALTER TABLE "ProspectInteraction" ADD COLUMN "externalKey" TEXT;
CREATE UNIQUE INDEX "ProspectInteraction_externalKey_key" ON "ProspectInteraction"("externalKey");
CREATE TABLE "CrmMessageTemplate" ("id" TEXT NOT NULL PRIMARY KEY,"name" TEXT NOT NULL,"channel" TEXT NOT NULL,"subject" TEXT,"body" TEXT NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL);
