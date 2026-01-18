"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { deriveMasterKey } from './crypto';
import { getDeviceFingerprint, setDeviceToken } from './device';

interface VaultContextType {
    masterKey: CryptoKey | null;
    userId: string | null;
    isLocked: boolean;
    unlock: (passphrase: string, email: string) => Promise<void>;
    lock: () => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
    const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    const unlock = async (passphrase: string, email: string) => {
        try {
            // 1. Register device / Get User ID
            const fingerprint = getDeviceFingerprint();
            const response = await fetch('/api/auth/register-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, deviceFingerprint: fingerprint })
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to register device");
            }

            // 2. Derive the Master Key
            const key = await deriveMasterKey(passphrase, result.userId);

            setMasterKey(key);
            setUserId(result.userId);
            setDeviceToken(result.token);
        } catch (error) {
            console.error("Unlock Error:", error);
            throw error;
        }
    };

    const lock = () => {
        setMasterKey(null);
        setUserId(null);
    };

    return (
        <VaultContext.Provider value={{ masterKey, userId, isLocked: !masterKey, unlock, lock }}>
            {children}
        </VaultContext.Provider>
    );
}

export function useVault() {
    const context = useContext(VaultContext);
    if (context === undefined) {
        throw new Error('useVault must be used within a VaultProvider');
    }
    return context;
}
