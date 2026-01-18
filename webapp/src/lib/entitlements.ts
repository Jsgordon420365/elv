import { prisma } from './prisma';

/**
 * Checks if a user is entitled to a specific template.
 * 
 * @param userId The ID of the user
 * @param templateSlug The slug of the template
 * @returns True if the user has an ACTIVE purchase for this template
 */
export async function isEntitled(userId: string, templateSlug: string): Promise<boolean> {
    const template = await prisma.template.findUnique({
        where: { slug: templateSlug }
    });

    if (!template) return false;

    const purchase = await prisma.purchase.findFirst({
        where: {
            userId: userId,
            templateId: template.id,
            status: "ACTIVE"
        }
    });

    return !!purchase;
}

/**
 * Retrieves all templates a user is entitled to.
 */
export async function getEntitledTemplates(userId: string) {
    return prisma.template.findMany({
        where: {
            purchases: {
                some: {
                    userId: userId,
                    status: "ACTIVE"
                }
            }
        }
    });
}
