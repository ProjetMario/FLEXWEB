import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getTenantFromRequest } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenantFromRequest();

  if (!tenant) {
    notFound();
  }

  const organization = await prisma.organization.findUnique({
    where: { id: tenant.organizationId },
    include: {
      websiteSettings: true,
      socialLinks: { orderBy: { order: "asc" } },
    },
  });

  if (!organization || organization.status === "SUSPENDED") {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <span className="font-semibold tracking-tight">
            {organization.websiteSettings?.logoUrl ? (
              <Image
                src={organization.websiteSettings.logoUrl}
                alt={organization.name}
                width={120}
                height={32}
                className="h-8 w-auto"
              />
            ) : (
              organization.name
            )}
          </span>
          <nav className="hidden gap-4 md:flex">
            <Link href="/" className="text-sm font-medium hover:underline">
              Accueil
            </Link>
            <Link href="/contact" className="text-sm font-medium hover:underline">
              Contact
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/40 py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {organization.name}. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
