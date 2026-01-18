import { getAllVaultItems } from './vault';
import { encryptField } from './crypto';

/**
 * Backs up the local IndexedDB vault to the server.
 * 
 * @param userId The ID of the current user
 * @param masterKey The master key to encrypt the bundle
 * @param ownerName The name of the vault owner (public metadata)
 */
export async function backupVaultToServer(userId: string, masterKey: CryptoKey, ownerName: string): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        // 1. Get all items from local storage
        const vaultItems = await getAllVaultItems();

        // 2. Wrap them in a JSON bundle and encrypt the whole thing
        const bundle = JSON.stringify(vaultItems);
        const encryptedBundle = await encryptField(bundle, masterKey);

        // 3. Send to the server
        // Note: In a real app, 'ownerName' and 'userId' would be handled by auth/session
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                ownerName,
                data: JSON.stringify(encryptedBundle) // We store the whole bundle as a JSON string
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Backup Sync Error:", error);
        return { success: false, error: "Failed to sync to server" };
    }
}

/**
 * RESTORES the vault from the server.
 * (To be implemented in a future step)
 */
export async function restoreVaultFromServer(userId: string, masterKey: CryptoKey): Promise<void> {
    // 1. Fetch from /api/vault by userId
    // 2. Decrypt the master bundle
    // 3. Populate IndexedDB
    throw new Error("Not implemented yet");
}
