import { openDB, IDBPDatabase } from 'idb';
import { encryptField, decryptField, EncryptedField } from './crypto';
import { isSensitive } from './sensitivity';

const DB_NAME = 'ELV_VAULT';
const STORE_NAME = 'vault_items';
const DB_VERSION = 1;

/**
 * Opens the IndexedDB database.
 */
async function getDB(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
}

/**
 * Saves a single field to the vault, encrypting it if necessary.
 * 
 * @param key The field name/key
 * @param value The plaintext value
 * @param masterKey The master key for encryption
 */
export async function saveVaultItem(key: string, value: string, masterKey: CryptoKey): Promise<void> {
    const db = await getDB();

    if (isSensitive(key)) {
        const encrypted = await encryptField(value, masterKey);
        await db.put(STORE_NAME, encrypted, key);
    } else {
        await db.put(STORE_NAME, value, key);
    }
}

/**
 * Retrieves a single field from the vault, decrypting it if necessary.
 * 
 * @param key The field name/key
 * @param masterKey The master key for decryption
 * @returns The plaintext value
 */
export async function getVaultItem(key: string, masterKey: CryptoKey): Promise<string | null> {
    const db = await getDB();
    const data = await db.get(STORE_NAME, key);

    if (!data) return null;

    // Check if the data is an EncryptedField (has ciphertext and iv)
    if (typeof data === 'object' && 'ciphertext' in data && 'iv' in data) {
        return await decryptField(data as EncryptedField, masterKey);
    }

    return data as string;
}

/**
 * Saves a full data object to the vault.
 * 
 * @param data Object containing key-value pairs
 * @param masterKey The master key for encryption
 */
export async function syncToVault(data: Record<string, string>, masterKey: CryptoKey): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
        await saveVaultItem(key, value, masterKey);
    }
}

/**
 * Retrieves all items from the local vault (as stored).
 */
export async function getAllVaultItems(): Promise<Record<string, any>> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const keys = await store.getAllKeys();
    const items: Record<string, any> = {};
    for (const key of keys) {
        items[key as string] = await store.get(key);
    }
    return items;
}

/**
 * Clears the local vault storage.
 */
export async function clearVault(): Promise<void> {
    const db = await getDB();
    await db.clear(STORE_NAME);
}
