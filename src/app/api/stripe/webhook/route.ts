import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const status =
          sub.status === "active"
            ? "active"
            : sub.status === "past_due"
            ? "past_due"
            : sub.status;
        // current_period_end moved to subscription item in Stripe API v2025+
        const periodEndTs = sub.items?.data?.[0]?.current_period_end;
        const periodEnd = periodEndTs ? new Date(periodEndTs * 1000) : null;

        await db.execute(sql`
          UPDATE users
          SET
            stripe_subscription_id    = ${sub.id},
            subscription_status       = ${status},
            subscription_period_end   = ${periodEnd},
            pro_rec_calls_this_period = 0
          WHERE stripe_customer_id = ${customerId}
        `);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        await db.execute(sql`
          UPDATE users
          SET
            subscription_status     = 'canceled',
            stripe_subscription_id  = NULL,
            subscription_period_end = NULL
          WHERE stripe_customer_id = ${customerId}
        `);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer as Stripe.Customer | null)?.id;

        if (customerId) {
          await db.execute(sql`
            UPDATE users
            SET subscription_status = 'past_due'
            WHERE stripe_customer_id = ${customerId}
          `);
        }
        break;
      }
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
