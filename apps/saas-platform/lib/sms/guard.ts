import type { Prisma } from "@prisma/client";
import { hash, mobileNumber } from "./core";
export async function smsBlocksEmail(
  tx: Prisma.TransactionClient,
  lead: { id: string; phone: string | null },
) {
  let phone: string | undefined;
  try {
    if (lead.phone) phone = mobileNumber(lead.phone);
  } catch {
    /* Not a mobile. */
  }
  if (
    phone &&
    (await tx.smsSuppression.findUnique({ where: { phoneHash: hash(phone) } }))
  )
    return true;
  const contact = await tx.smsOutreachContact.findFirst({
    where: { OR: [{ leadId: lead.id }, ...(phone ? [{ phone }] : [])] },
    include: { messages: true },
  });
  return (
    !!contact &&
    (!!contact.stoppedAt ||
      contact.messages.some((m) => !!m.attemptedAt || m.status === "APPROVED"))
  );
}
