/**
 * Core cryptographic utilities for the Encrypted Legal Vault (ELV).
 * This module uses the WebCrypto API for secure key derivation and encryption.
 */

const PBKDF2_ITERATIONS = 600000;
const HASH_FUNCTION = 'SHA-256';

/**
 * Derives a 256-bit AES-GCM Master Key from a passphrase using PBKDF2.
 * 
 * @param passphrase The user's secret passphrase
 * @param salt The salt value (typically the userId or email)
 * @returns A CryptoKey suitable for AES-GCM encryption/decryption
 */
export async function deriveMasterKey(passphrase: string, salt: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passphraseBytes = encoder.encode(passphrase);
    const saltBytes = encoder.encode(salt);

    // Import the passphrase as a "raw" key material
    const baseKey = await crypto.subtle.importKey(
        "raw",
        passphraseBytes,
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    // Derive the Master Key using PBKDF2
    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBytes,
            iterations: PBKDF2_ITERATIONS,
            hash: HASH_FUNCTION
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false, // Key is not extractable
        ["encrypt", "decrypt"]
    );
}

/**
 * Interface for encrypted field data.
 */
export interface EncryptedField {
    ciphertext: string;
    iv: string;
}

/**
 * Encrypts a plaintext string using AES-GCM (256-bit).
 * 
 * @param plaintext The string to encrypt
 * @param masterKey The derived master key
 * @returns An object containing the ciphertext and IV as Base64 strings
 */
export async function encryptField(plaintext: string, masterKey: CryptoKey): Promise<EncryptedField> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate random IV (96-bit = 12 bytes)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
            tagLength: 128  // 128-bit authentication tag
        },
        masterKey,
        data
    );

    return {
        ciphertext: bufferToBase64(ciphertext),
        iv: bufferToBase64(iv)
    };
}

/**
 * Decrypts an encrypted field.
 * 
 * @param encrypted The EncryptedField object
 * @param masterKey The derived master key
 * @returns The decrypted plaintext string
 */
export async function decryptField(encrypted: EncryptedField, masterKey: CryptoKey): Promise<string> {
    const ciphertext = base64ToBuffer(encrypted.ciphertext);
    const iv = base64ToBuffer(encrypted.iv);

    const plaintext = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: new Uint8Array(iv),
            tagLength: 128
        },
        masterKey,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
}

/**
 * Helper to convert an ArrayBuffer to a Base64 string.
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Helper to convert a Base64 string to an ArrayBuffer.
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
