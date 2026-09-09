-- CreateTable
CREATE TABLE "SmsAutomationSettings" (
    "id" TEXT NOT NULL DEFAULT 'onoff',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sender" TEXT NOT NULL,
    "webhookKeyHash" TEXT,
    "dispatchKeyHash" TEXT,
    "webhookVerifiedAt" TIMESTAMP(3),
    "dispatchVerifiedAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "dailyLimit" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsAutomationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOutreachContact" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "companyName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "websiteCheckUrl" TEXT NOT NULL,
    "websiteFinding" TEXT NOT NULL DEFAULT 'TO_CHECK',
    "checkedAt" TIMESTAMP(3),
    "contactBasis" TEXT NOT NULL DEFAULT 'TO_CHECK',
    "evidence" TEXT,
    "reviewedBy" TEXT,
    "stoppedAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsOutreachContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOutreachMessage" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "dispatchRequestHash" TEXT,
    "providerEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsOutreachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOutreachEvent" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "externalId" TEXT,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOutreachEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsSuppression" (
    "phoneHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsSuppression_pkey" PRIMARY KEY ("phoneHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsOutreachContact_leadId_key" ON "SmsOutreachContact"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOutreachContact_phone_key" ON "SmsOutreachContact"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOutreachMessage_contactId_key" ON "SmsOutreachMessage"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOutreachMessage_dispatchRequestHash_key" ON "SmsOutreachMessage"("dispatchRequestHash");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOutreachMessage_providerEventId_key" ON "SmsOutreachMessage"("providerEventId");

-- CreateIndex
CREATE INDEX "SmsOutreachMessage_status_approvedAt_idx" ON "SmsOutreachMessage"("status", "approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsOutreachEvent_externalId_key" ON "SmsOutreachEvent"("externalId");

-- CreateIndex
CREATE INDEX "SmsOutreachEvent_contactId_createdAt_idx" ON "SmsOutreachEvent"("contactId", "createdAt");

-- AddForeignKey
ALTER TABLE "SmsOutreachMessage" ADD CONSTRAINT "SmsOutreachMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "SmsOutreachContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsOutreachEvent" ADD CONSTRAINT "SmsOutreachEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "SmsOutreachContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

