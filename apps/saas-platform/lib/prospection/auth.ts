import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: "ADMIN" | "SUPER_ADMIN";
};

/**
 * Require an authenticated user with ADMIN or SUPER_ADMIN role.
 * Redirects to login if not authenticated, throws 403 if not authorized.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      role: "SUPER_ADMIN",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!membership) {
    throw new Error("Forbidden: admin access required");
  }

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    image: session.user.image,
    role: membership.role as "ADMIN" | "SUPER_ADMIN",
  };
}
