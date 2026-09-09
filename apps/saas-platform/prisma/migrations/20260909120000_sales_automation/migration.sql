-- CreateTable
CREATE TABLE "SalesProject" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "monthlyCents" INTEGER NOT NULL,
    "setupCents" INTEGER NOT NULL,
    "offerSnapshot" JSONB NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "prospectId" TEXT,
    "organizationId" TEXT,
    "websiteId" TEXT,
    "brief" JSONB,
    "draftVersion" INTEGER NOT NULL DEFAULT 0,
    "briefSubmittedAt" TIMESTAMP(3),
    "clientApprovedAt" TIMESTAMP(3),
    "qaApprovedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "quoteReference" TEXT,
    "quoteUrl" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeSessionId" TEXT,
    "checkoutAttempt" INTEGER NOT NULL DEFAULT 0,
    "stripeUpdatedAt" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationMessage" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "projectId" TEXT,
    "expectedStage" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationEvent" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesProject_requestKey_key" ON "SalesProject"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "SalesProject_accessTokenHash_key" ON "SalesProject"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "SalesProject_organizationId_key" ON "SalesProject"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesProject_websiteId_key" ON "SalesProject"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesProject_stripeSubscriptionId_key" ON "SalesProject"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesProject_stripeSessionId_key" ON "SalesProject"("stripeSessionId");

-- CreateIndex
CREATE INDEX "SalesProject_stage_createdAt_idx" ON "SalesProject"("stage", "createdAt");

-- CreateIndex
CREATE INDEX "SalesProject_email_idx" ON "SalesProject"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationMessage_dedupeKey_key" ON "AutomationMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "AutomationMessage_status_availableAt_idx" ON "AutomationMessage"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationEvent_externalId_key" ON "AutomationEvent"("externalId");

-- CreateIndex
CREATE INDEX "AutomationEvent_projectId_createdAt_idx" ON "AutomationEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationRateLimit_expiresAt_idx" ON "AutomationRateLimit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_requestKey_key" ON "SupportTicket"("requestKey");

-- CreateIndex
CREATE INDEX "SupportTicket_projectId_status_idx" ON "SupportTicket"("projectId", "status");

