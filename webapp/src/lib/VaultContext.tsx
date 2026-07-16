// ver 20260714132600.1

"use client";

import { createContext, ReactNode, useContext, useState } from "react";
import { deriveMasterKey } from "./crypto";
import { getDeviceFingerprint, setDeviceToken } from "./device";
import { verifyVaultKey } from "./vault";

interface VaultContextType {
    masterKey: CryptoKey | null;
    userId: string | null;
    isLocked: boolean;
    isDemoMode: boolean;
    unlock: (passphrase: string, email: string) => Promise<void>;
    lock: () => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
    const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

    const unlock = async (passphrase: string, email: string) => {
        const normalizedEmail = email.trim().toLowerCase();
        if (isDemoMode) {
            const localIdentity = normalizedEmail || "local-demo-vault";
            const key = await deriveMasterKey(passphrase, `elv-demo:${localIdentity}`);
            await verifyVaultKey(key);
            setMasterKey(key);
            setUserId(localIdentity);
            return;
        }

        const fingerprint = getDeviceFingerprint();
        const response = await fetch("/api/auth/register-device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalizedEmail, deviceFingerprint: fingerprint }),
        });
        const result = await response.json() as { success: boolean; error?: string; userId: string; token: string };
        if (!result.success) throw new Error(result.error || "Failed to register device");
        const key = await deriveMasterKey(passphrase, result.userId);
        await verifyVaultKey(key);
        setMasterKey(key);
        setUserId(result.userId);
        setDeviceToken(result.token);
    };

    const lock = () => {
        setMasterKey(null);
        setUserId(null);
    };

    return (
        <VaultContext.Provider value={{ masterKey, userId, isLocked: !masterKey, isDemoMode, unlock, lock }}>
            {children}
        </VaultContext.Provider>
    );
}

export function useVault(): VaultContextType {
    const context = useContext(VaultContext);
    if (!context) throw new Error("useVault must be used within a VaultProvider");
    return context;
}

// Version history
// 20260714132600.0 - Added local demo unlock that derives the vault key without device registration or network access.
// 20260714132600.1 - Refused to initialize an apparently empty session when existing encrypted records cannot be decrypted by the supplied identity and passphrase.
