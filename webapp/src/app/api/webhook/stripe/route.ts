import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
    apiVersion: '2025-01-27.acacia' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
    const body = await request.text();
    const sig = (await headers()).get('stripe-signature');

    let event: Stripe.Event;

    try {
        if (!sig || !webhookSecret) {
            // Fallback for development/manual testing if secret is missing
            event = JSON.parse(body);
        } else {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        }
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
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
