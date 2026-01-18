import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ownerName, data, userId } = body;

        if (!data) {
            return NextResponse.json({ success: false, error: "Data is required" }, { status: 400 });
        }

        const stringifiedData = typeof data === 'string' ? data : JSON.stringify(data);

        let s3Key = null;

        // Attempt S3 Backup if configured
        if (process.env.S3_BUCKET_NAME && userId) {
            try {
                s3Key = `vaults/${userId}/${Date.now()}.json`;
                await s3Client.send(new PutObjectCommand({
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: s3Key,
                    Body: stringifiedData,
                    ContentType: "application/json",
                }));
                console.log(`Cloud Sync Success: ${s3Key}`);
            } catch (s3Error) {
                console.error("Cloud Sync Failed, falling back to local DB:", s3Error);
                // We continue to DB save anyway as fallback
            }
        }

        const entry = await prisma.vaultData.create({
            data: {
                userId: userId || null,
                ownerName: ownerName || "Unknown Owner",
                data: stringifiedData, // We still store in DB as fallback/primary for now
            },
        });

        return NextResponse.json({
            success: true,
            id: entry.id,
            cloudSynced: !!s3Key
        });
    } catch (error) {
        console.error("Save Error:", error);
        return NextResponse.json({ success: false, error: "Failed to save data" }, { status: 500 });
    }
}
