import { sendStudioMail } from "./mail";
import { prisma } from "../prisma";
import { expireJobs, processGeneration } from "./jobs";
import { refreshSubscription } from "./payments";
import { notifySite } from "./service";
import { verifyDomain } from "./domains";
import { DAY } from "./core";
export async function runStudioWorker() {
  await expireJobs();
  await sendStudioMail();
  for (let n = 0; n < 3; n++) if (!(await processGeneration())) break;
  const subscriptions = await prisma.studioSite.findMany({
    where: {
      stripeSubscriptionId: { not: null },
      OR: [
        { lastBillingCheck: null },
        { lastBillingCheck: { lt: new Date(Date.now() - 3600000) } },
      ],
    },
    orderBy: { lastBillingCheck: { sort: "asc", nulls: "first" } },
    take: 3,
  });
  for (const s of subscriptions) {
    try {
      await refreshSubscription(s.id);
    } catch {
      await prisma.studioSite.update({
        where: { id: s.id },
        data: { lastBillingCheck: new Date() },
      });
      await prisma.studioEvent.upsert({
        where: {
          key: `billing-error:${s.id}:${new Date().toISOString().slice(0, 10)}`,
        },
        create: {
          siteId: s.id,
          key: `billing-error:${s.id}:${new Date().toISOString().slice(0, 10)}`,
          kind: "ERROR",
          detail: "Synchronisation Stripe à vérifier.",
        },
        update: {},
      });
    }
  }
  const domains = await prisma.studioSite.findMany({
    where: {
      domainState: "PENDING",
      domain: { not: null },
      updatedAt: { lt: new Date(Date.now() - 300000) },
    },
    take: 2,
  });
  for (const s of domains) await verifyDomain(s.id);
  const trials = await prisma.studioSite.findMany({
    where: {
      billingStatus: "UNPAID",
      trialEndsAt: {
        lte: new Date(Date.now() + 2 * DAY),
        gte: new Date(Date.now() - DAY),
      },
    },
    take: 50,
  });
  for (const s of trials)
    await notifySite(
      s,
      `trial-end`,
      "Votre essai FLEX-WEB arrive à son terme",
      "Votre aperçu reste privé. Souscrivez à 49 € HT/mois si vous souhaitez publier votre site et continuer à le modifier. Aucun prélèvement sans souscription.",
    );
}
