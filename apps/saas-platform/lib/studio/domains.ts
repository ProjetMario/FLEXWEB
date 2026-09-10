import { randomBytes } from "node:crypto";
import { resolveTxt, resolveCname } from "node:dns/promises";
import { z } from "zod";
import { prisma } from "../prisma";
import { publicGet } from "../outreach/web-audit";
import { HttpError } from "../automation/core";
import { APP } from "./core";
import { ownSite } from "./service";
import type { Identity } from "./auth";
export async function setDomain(identity: Identity, value: unknown) {
  const domain = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){2,}[a-z]{2,63}$/)
    .max(253)
    .parse(value);
  if (
    domain.endsWith(".netlify.app") ||
    domain === "www.flex-web.fr" ||
    domain.endsWith(".flex-web.fr")
  )
    throw new HttpError(
      400,
      "Utilisez un domaine vous appartenant, par exemple www.monentreprise.fr.",
    );
  const s = await ownSite(identity);
  if (s.domainState === "VERIFIED" && s.domain !== domain)
    throw new HttpError(
      409,
      "Contactez le support pour remplacer un domaine déjà connecté.",
    );
  if (s.domain === domain) return s;
  return prisma.studioSite.update({
    where: { id: s.id },
    data: {
      domain,
      domainToken: randomBytes(24).toString("hex"),
      domainState: "PENDING",
      domainError: null,
    },
  });
}
export async function verifyDomain(siteId: string) {
  const s = await prisma.studioSite.findUniqueOrThrow({
    where: { id: siteId },
  });
  if (!s.domain || !s.domainToken) return;
  try {
    const records = await resolveTxt(`_flexweb.${s.domain}`);
    if (!records.some((r) => r.join("") === s.domainToken))
      throw Error(
        "Ajoutez le TXT de vérification chez votre fournisseur de domaine.",
      );
    const cname = await resolveCname(s.domain);
    if (!cname.some((v) => v.replace(/\.$/, "") === new URL(APP()).hostname))
      throw Error(
        "Ajoutez le CNAME vers flexweb-gestion.netlify.app, puis attendez sa propagation.",
      );
    if (!process.env.STUDIO_NETLIFY_TOKEN)
      throw Error(
        "Le raccordement automatique des domaines est en cours de configuration.",
      );
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('studio-domain-aliases'))`;
        const endpoint =
          "https://api.netlify.com/api/v1/sites/8629ade6-d7d3-4b72-bf37-a6199968ca48";
        const headers = {
          Authorization: `Bearer ${process.env.STUDIO_NETLIFY_TOKEN}`,
          "Content-Type": "application/json",
        };
        const response = await fetch(endpoint, {
          headers,
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok)
          throw Error(
            "La connexion au service d’hébergement doit être vérifiée.",
          );
        const config = await response.json();
        const aliases: string[] = config.domain_aliases || [];
        if (!aliases.includes(s.domain!)) {
          const update = await fetch(endpoint, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ domain_aliases: [...aliases, s.domain] }),
            signal: AbortSignal.timeout(10000),
          });
          if (!update.ok)
            throw Error(
              "Le domaine ne peut pas encore être raccordé. Vérifiez qu’il n’est pas associé à un autre site.",
            );
        }
      },
      { timeout: 20000 },
    );
    const proof = await publicGet(
      `https://${s.domain}/.well-known/flexweb-site`,
    );
    if (proof.status !== 200 || proof.body !== s.id)
      throw Error(
        "Le certificat HTTPS est en cours de préparation. Réessayez dans quelques minutes.",
      );
    await prisma.studioSite.updateMany({
      where: { id: s.id, domain: s.domain, domainToken: s.domainToken },
      data: { domainState: "VERIFIED", domainError: null },
    });
  } catch (error) {
    await prisma.studioSite.update({
      where: { id: s.id },
      data: {
        domainState: "PENDING",
        domainError:
          error instanceof Error && !error.message.includes("prisma")
            ? error.message.slice(0, 180)
            : "Vérification DNS ou HTTPS en attente.",
      },
    });
  }
}
