import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@/lib/env";

const pool = new Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "super@flexweb.local" },
  });

  if (!user) {
    console.error("Super admin non trouvé");
    process.exit(1);
  }

  const prospect = await prisma.prospect.create({
    data: {
      companyName: "Entreprise Estrade",
      phone: "06 60 87 70 43",
      businessType: "Plombier",
      category: "Plombier",
      country: "France",
      googleRating: 3,
      googleReviewCount: 2,
      source: "GOOGLE",
      status: "A_CONTACTER",
      internalNotes: "Plombier. 3,0 étoiles (2 avis). Fermé, ouvre à 08h00 lundi. Prospect à contacter.",
    },
  });

  await prisma.prospectInteraction.create({
    data: {
      prospectId: prospect.id,
      type: "PROSPECT_AJOUTE",
      note: "Prospect ajouté depuis une fiche Google Business",
      newStatus: "A_CONTACTER",
      createdById: user.id,
    },
  });

  console.log("Prospect ajouté:", prospect.companyName);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
