import { applyStudioStripeEvent } from "@/lib/studio/payments";
import { applyStripeEvent, stripeClient } from "@/lib/automation/payments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY)
    return new Response("Webhook unavailable", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 1000000)
    return new Response("Payload too large", { status: 413 });
  const stripe = stripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    if (!(await applyStudioStripeEvent(stripe, event))) await applyStripeEvent(stripe, event);
    return Response.json({ received: true });
  } catch {
    console.error("Stripe processing failed", event.id);
    return new Response("Retry event", { status: 500 });
  }
}
