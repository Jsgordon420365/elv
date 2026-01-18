import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding templates...');

    const templates = [
        {
            slug: 'independent-contractor',
            name: 'Independent Contractor Agreement',
            description: 'Standard agreement for hiring independent contractors. Covers IP, confidentiality, and termination.',
            price: 2900, // $29.00
            category: 'Business',
        },
        {
            slug: 'landlord-lease',
            name: 'Residential Lease Agreement',
            description: 'A comprehensive residential lease agreement covering all standard clauses and local compliance.',
            price: 3900, // $39.00
            category: 'Real Estate',
        },
        {
            slug: 'founder-nda',
            name: 'Founder Mutual NDA',
            description: 'Protect your early-stage startup ideas during founder discussions.',
            price: 1900, // $19.00
            category: 'Startup',
        }
    ];

    for (const t of templates) {
        const template = await prisma.template.upsert({
            where: { slug: t.slug },
            update: t,
            create: t,
        });
        console.log(`- Seeded template: ${template.name} (${template.slug})`);
    }

    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
