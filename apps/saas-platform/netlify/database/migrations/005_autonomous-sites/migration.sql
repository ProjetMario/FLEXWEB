CREATE TABLE "StudioSite" (
"id" TEXT PRIMARY KEY, "identityId" TEXT NOT NULL UNIQUE, "email" TEXT NOT NULL,
"organizationId" TEXT NOT NULL UNIQUE REFERENCES "Organization"("id"), "websiteId" TEXT NOT NULL UNIQUE REFERENCES "Website"("id"), "prospectId" TEXT REFERENCES "Prospect"("id"),
"slug" TEXT NOT NULL UNIQUE, "trialEndsAt" TIMESTAMP(3) NOT NULL, "brief" JSONB NOT NULL, "draft" JSONB NOT NULL, "draftRevision" INTEGER NOT NULL DEFAULT 1, "published" JSONB, "previousPublished" JSONB, "approvedRevision" INTEGER,
"state" TEXT NOT NULL DEFAULT 'TRIAL', "stripeCustomerId" TEXT, "stripeSessionId" TEXT, "stripeSubscriptionId" TEXT UNIQUE, "paidThrough" TIMESTAMP(3), "pastDueAt" TIMESTAMP(3), "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false, "billingStatus" TEXT NOT NULL DEFAULT 'UNPAID', "publishedAt" TIMESTAMP(3), "lastBillingCheck" TIMESTAMP(3),
"domain" TEXT UNIQUE, "domainToken" TEXT, "domainState" TEXT NOT NULL DEFAULT 'NONE', "domainError" TEXT,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "StudioJob" ("id" TEXT PRIMARY KEY, "siteId" TEXT NOT NULL REFERENCES "StudioSite"("id"), "requestKey" TEXT NOT NULL UNIQUE, "kind" TEXT NOT NULL DEFAULT 'GENERATE', "state" TEXT NOT NULL DEFAULT 'PENDING', "input" JSONB NOT NULL, "baseRevision" INTEGER NOT NULL, "quotaPeriod" TEXT NOT NULL, "budgetPeriod" TEXT NOT NULL, "reservedCents" INTEGER NOT NULL DEFAULT 10, "inputTokens" INTEGER NOT NULL DEFAULT 0, "outputTokens" INTEGER NOT NULL DEFAULT 0, "error" TEXT, "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "StudioJob_state_createdAt_idx" ON "StudioJob"("state","createdAt");
CREATE INDEX "StudioJob_siteId_quotaPeriod_idx" ON "StudioJob"("siteId","quotaPeriod");
CREATE TABLE "StudioBudget" ("period" TEXT PRIMARY KEY, "reservedCents" INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "StudioAsset" ("id" TEXT PRIMARY KEY, "siteId" TEXT NOT NULL REFERENCES "StudioSite"("id"), "key" TEXT NOT NULL UNIQUE, "bytes" INTEGER NOT NULL, "state" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "StudioInquiry" ("id" TEXT PRIMARY KEY, "siteId" TEXT NOT NULL REFERENCES "StudioSite"("id"), "name" TEXT NOT NULL, "email" TEXT NOT NULL, "message" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "StudioEvent" ("id" TEXT PRIMARY KEY, "siteId" TEXT NOT NULL REFERENCES "StudioSite"("id"), "key" TEXT NOT NULL UNIQUE, "kind" TEXT NOT NULL, "detail" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
