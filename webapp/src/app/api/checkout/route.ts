// ver 20260714143000.0

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');

export async function POST(request: Request) {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
        return NextResponse.json({ error: "Stripe checkout is disabled in local demo mode." }, { status: 403 });
    }
    try {
        const { templateId, userId } = await request.json();

        if (!templateId || !userId) {
            return NextResponse.json({ error: 'Missing templateId or userId' }, { status: 400 });
        }

        const template = await prisma.template.findUnique({
            where: { id: templateId },
        });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: template.name,
                            description: template.description,
                        },
                        unit_amount: template.price,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${baseUrl}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/marketplace?canceled=true`,
            metadata: {
                userId,
                templateId,
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (err: unknown) {
        console.error('Stripe Checkout Error:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : "Stripe checkout failed." }, { status: 500 });
    }
}

// Version history
// 20260714143000.0 - Disabled Stripe in demo mode and replaced legacy any-typed Stripe error handling.
