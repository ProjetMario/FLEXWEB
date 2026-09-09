-- CreateTable
CREATE TABLE "OutreachCampaign" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "targetLimit" INTEGER NOT NULL DEFAULT 50,
    "registryPage" INTEGER NOT NULL DEFAULT 1,
    "exhausted" BOOLEAN NOT NULL DEFAULT false,
    "dailyLimit" INTEGER NOT NULL DEFAULT 10,
    "lastRunAt" TIMESTAMP(3),
    "lastResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachLead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "siren" TEXT NOT NULL,
    "siret" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "activityCode" TEXT NOT NULL,
    "registryUrl" TEXT NOT NULL,
    "sourceFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactSourceUrl" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "enrichmentState" TEXT NOT NULL DEFAULT 'PENDING',
    "auditState" TEXT NOT NULL DEFAULT 'PENDING',
    "audit" JSONB,
    "score" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "firstSentAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "prospectId" TEXT,
    "appointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT NOT NULL,
    "lastError" TEXT,

    CONSTRAINT "OutreachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSuppression" (
    "emailHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachSuppression_pkey" PRIMARY KEY ("emailHash")
);

-- CreateTable
CREATE TABLE "OutreachMailbox" (
    "id" TEXT NOT NULL DEFAULT 'ionos',
    "uidValidity" TEXT,
    "lastUid" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockToken" TEXT,

    CONSTRAINT "OutreachMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "externalId" TEXT,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachCampaign_key_key" ON "OutreachCampaign"("key");

-- CreateIndex
CREATE INDEX "OutreachLead_campaignId_enrichmentState_auditState_idx" ON "OutreachLead"("campaignId", "enrichmentState", "auditState");

-- CreateIndex
CREATE INDEX "OutreachLead_email_idx" ON "OutreachLead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachLead_campaignId_siren_key" ON "OutreachLead"("campaignId", "siren");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachMessage_messageId_key" ON "OutreachMessage"("messageId");

-- CreateIndex
CREATE INDEX "OutreachMessage_status_attemptedAt_idx" ON "OutreachMessage"("status", "attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachMessage_leadId_step_key" ON "OutreachMessage"("leadId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachEvent_externalId_key" ON "OutreachEvent"("externalId");

-- CreateIndex
CREATE INDEX "OutreachEvent_leadId_createdAt_idx" ON "OutreachEvent"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "OutreachLead" ADD CONSTRAINT "OutreachLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OutreachCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "OutreachLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEvent" ADD CONSTRAINT "OutreachEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "OutreachLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

