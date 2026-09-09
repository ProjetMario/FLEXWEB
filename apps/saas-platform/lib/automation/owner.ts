import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "./core";

// The route calling this function requires the server-to-server shared secret.
// Initialization is allowed only on a new database and cannot replace an existing account.
export async function initializeOwner(input: unknown) {
  const data = z.object({email:z.email().max(254),password:z.string().min(24).max(128)}).parse(input);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(42673341)`;
    if (await tx.user.count()) throw new HttpError(409,"L’administration est déjà initialisée.");
    const owner = await tx.user.create({data:{email:data.email.toLowerCase(),name:"FLEX-WEB",passwordHash:await bcrypt.hash(data.password,12)}});
    const organization = await tx.organization.create({data:{slug:"flexweb-administration",name:"FLEX-WEB",businessType:"agence",status:"ACTIVE"}});
    await tx.membership.create({data:{organizationId:organization.id,userId:owner.id,role:"SUPER_ADMIN"}});
    await tx.automationEvent.create({data:{type:"OWNER_INITIALIZED",detail:"Compte propriétaire initialisé sur une base neuve."}});
    return {email:owner.email};
  },{timeout:15000});
}
