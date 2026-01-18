/**
 * Device fingerprinting and token management for ELV.
 */

const DEVICE_FINGERPRINT_KEY = "elv_device_fingerprint";
const DEVICE_TOKEN_KEY = "elv_device_token";

/**
 * Generates or retrieves a unique fingerprint for this device/browser.
 * This is a simple implementation for the MVP.
 */
export function getDeviceFingerprint(): string {
    if (typeof window === "undefined") return "server";

    let fingerprint = localStorage.getItem(DEVICE_FINGERPRINT_KEY);
    if (!fingerprint) {
        // Generate a random string as a simple fingerprint for MVP
        fingerprint = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);
    }
    return fingerprint;
}

/**
 * Stores the registration token locally.
 */
export function setDeviceToken(token: string): void {
    if (typeof window !== "undefined") {
        localStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
}

/**
 * Retrieves the local registration token.
 */
export function getDeviceToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(DEVICE_TOKEN_KEY);
}

/**
 * Checks if the current device is registered.
 */
export function isDeviceRegistered(): boolean {
    return !!getDeviceToken();
}
