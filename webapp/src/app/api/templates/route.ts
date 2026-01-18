import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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
