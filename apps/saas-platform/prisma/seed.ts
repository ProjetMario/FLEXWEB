import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

const pool = new Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: "super@flexweb.local" },
    update: {},
    create: {
      email: "super@flexweb.local",
      name: "Super Admin",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "admin@demo.local" },
    update: {},
    create: {
      email: "admin@demo.local",
      name: "Admin Demo",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const demoOrg = await prisma.organization.upsert({
    where: { slug: "demo-artisan" },
    update: {},
    create: {
      slug: "demo-artisan",
      name: "Artisan Demo",
      businessType: "artisan",
      status: "ACTIVE",
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: demoOrg.id,
        userId: superAdmin.id,
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      userId: superAdmin.id,
      role: "SUPER_ADMIN",
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: demoOrg.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      userId: demoUser.id,
      role: "ADMIN",
    },
  });

  const template = await prisma.template.upsert({
    where: { slug: "generic-classic" },
    update: {},
    create: {
      slug: "generic-classic",
      name: "Classique",
      category: "generic",
      description: "Template classique adaptable à tous les secteurs.",
      defaultPages: {
        pages: [
          { slug: "", title: "Accueil", isHomepage: true },
          { slug: "a-propos", title: "À propos" },
          { slug: "contact", title: "Contact" },
        ],
      },
      defaultStyles: {
        colors: { primary: "#0f172a", secondary: "#64748b" },
        fonts: { heading: "Inter", body: "Inter" },
      },
      availableModules: [
        "services",
        "testimonials",
        "team",
        "faq",
        "contact",
        "gallery",
      ],
    },
  });

  const website = await prisma.website.upsert({
    where: { id: demoOrg.id },
    update: {},
    create: {
      organizationId: demoOrg.id,
      templateId: template.id,
      name: "Site Artisan Demo",
      isPublished: true,
    },
  });

  await prisma.page.upsert({
    where: {
      organizationId_websiteId_slug: {
        organizationId: demoOrg.id,
        websiteId: website.id,
        slug: "",
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      websiteId: website.id,
      slug: "",
      title: "Accueil",
      isHomepage: true,
      status: "PUBLISHED",
      publishedAt: new Date(),
      sections: {
        create: [
          {
            type: "header",
            order: 0,
            config: {
              title: "Artisan Demo",
              subtitle: "Votre artisan de confiance",
              align: "center",
            },
          },
          {
            type: "text",
            order: 1,
            config: {
              content:
                "Bienvenue sur notre site. Nous mettons notre expertise au service de vos projets.",
              align: "left",
            },
          },
          {
            type: "services",
            order: 2,
            config: { title: "Nos prestations", limit: 6 },
          },
          {
            type: "cta",
            order: 3,
            config: {
              title: "Demandez un devis gratuit",
              buttonText: "Contactez-nous",
              buttonHref: "/contact",
            },
          },
        ],
      },
    },
  });

  await prisma.service.upsert({
    where: { id: "service-1" },
    update: {},
    create: {
      id: "service-1",
      organizationId: demoOrg.id,
      title: "Réparation",
      description: "Service de réparation rapide et professionnel.",
      price: "Sur devis",
      order: 0,
    },
  });

  await prisma.service.upsert({
    where: { id: "service-2" },
    update: {},
    create: {
      id: "service-2",
      organizationId: demoOrg.id,
      title: "Installation",
      description: "Installation sur mesure selon vos besoins.",
      price: "À partir de 150 €",
      order: 1,
    },
  });

  const features = [
    { key: "services", name: "Services / Prestations" },
    { key: "products", name: "Produits" },
    { key: "projects", name: "Réalisations" },
    { key: "team", name: "Équipe" },
    { key: "testimonials", name: "Témoignages" },
    { key: "blog", name: "Blog / Actualités" },
    { key: "events", name: "Événements" },
    { key: "faq", name: "FAQ" },
    { key: "gallery", name: "Galerie" },
    { key: "appointments", name: "Rendez-vous" },
    { key: "quotes", name: "Devis" },
    { key: "contact", name: "Contact" },
  ];

  for (const feature of features) {
    await prisma.feature.upsert({
      where: { key: feature.key },
      update: {},
      create: {
        key: feature.key,
        name: feature.name,
      },
    });
  }

  await prisma.organizationFeature.createMany({
    data: [
      { organizationId: demoOrg.id, featureKey: "services", isEnabled: true },
      { organizationId: demoOrg.id, featureKey: "team", isEnabled: true },
      { organizationId: demoOrg.id, featureKey: "testimonials", isEnabled: true },
      { organizationId: demoOrg.id, featureKey: "faq", isEnabled: true },
      { organizationId: demoOrg.id, featureKey: "contact", isEnabled: true },
    ],
    skipDuplicates: true,
  });

  console.log("Seed completed:");
  console.log("- Super admin:", superAdmin.email, "/ Password123!");
  console.log("- Demo admin:", demoUser.email, "/ Password123!");
  console.log("- Organization:", demoOrg.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
