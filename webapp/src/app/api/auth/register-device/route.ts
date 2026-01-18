import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, deviceFingerprint, deviceName } = body;

        if (!email || !deviceFingerprint) {
            return NextResponse.json({ success: false, error: "Email and device fingerprint are required" }, { status: 400 });
        }

        // 1. Find or create the user
        let user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            user = await prisma.user.create({
                data: { email }
            });
        }

        // 2. Register the device
        const device = await prisma.device.upsert({
            where: { deviceFingerprint },
            update: {
                userId: user.id,
                name: deviceName || null,
                lastSeen: new Date()
            },
            create: {
                userId: user.id,
                deviceFingerprint,
                name: deviceName || null
            }
        });

        return NextResponse.json({
            success: true,
            userId: user.id,
            deviceId: device.id,
            token: `mock_jwt_${device.id}` // In a real app, this would be a real JWT
        });
    } catch (error) {
        console.error("Device Registration Error:", error);
        return NextResponse.json({ success: false, error: "Failed to register device" }, { status: 500 });
    }
}
