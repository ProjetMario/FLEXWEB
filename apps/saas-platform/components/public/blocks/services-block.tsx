import { prisma } from "@/lib/prisma";
import type { Service } from "@prisma/client";

interface ServicesBlockProps {
  config: Record<string, unknown>;
  organizationId: string;
}

export async function ServicesBlock({ config, organizationId }: ServicesBlockProps) {
  const title = config.title ? String(config.title) : "Nos prestations";
  const limit = Number(config.limit ?? 6);

  const services = await prisma.service.findMany({
    where: { organizationId, isVisible: true },
    orderBy: { order: "asc" },
    take: limit,
  });

  if (services.length === 0) return null;

  return (
    <section className="space-y-6">
      <h2 className="text-center text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service: Service) => (
          <div key={service.id} className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="font-medium">{service.title}</h3>
            {service.description && (
              <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
            )}
            {service.price && (
              <p className="mt-4 text-sm font-semibold">{service.price}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
