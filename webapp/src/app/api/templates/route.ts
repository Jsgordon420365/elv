// ver 20260714160800.0

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getForm } from '@/lib/registry';

export async function GET() {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") {
        const form = getForm("independent-contractor-nc");
        return NextResponse.json([{ id: form.id, slug: form.id, name: "Independent Contractor — North Carolina", description: form.scope, category: "Business" }]);
    }
    try {
        const templates = await prisma.template.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(templates);
    } catch (error) {
        console.error("Fetch Templates Error:", error);
        return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
    }
}

// Version history
// 20260714160800.0 - Granted the local demo form without querying Prisma.
