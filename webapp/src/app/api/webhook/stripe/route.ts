// ver 20260714143000.0

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
        return NextResponse.json({ error: "Stripe webhooks are disabled in local demo mode." }, { status: 403 });
    }
    const body = await request.text();
    const sig = (await headers()).get('stripe-signature');

    let event: Stripe.Event;

    try {
        if (!sig || !webhookSecret) {
            // Fallback for development/manual testing if secret is missing
            event = JSON.parse(body) as Stripe.Event;
        } else {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown webhook error";
        console.error(`Webhook Error: ${message}`);
        return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, templateId } = session.metadata || {};

        if (userId && templateId) {
            console.log(`Fulfilling purchase for User ${userId}, Template ${templateId}`);

            await prisma.purchase.upsert({
                where: { stripeSessionId: session.id },
                update: {
                    status: "ACTIVE"
                },
                create: {
                    userId,
                    templateId,
                    status: "ACTIVE",
                    stripeSessionId: session.id
                }
            });
        }
    }

    return NextResponse.json({ received: true });
}

// Version history
// 20260714143000.0 - Disabled Stripe webhooks in demo mode and replaced legacy any-typed webhook parsing errors.
