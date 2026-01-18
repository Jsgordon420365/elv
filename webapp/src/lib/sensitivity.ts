/**
 * Field sensitivity tagging for ELV.
 */

export enum Sensitivity {
    PUBLIC = "PUBLIC",   // Not encrypted (metadata)
    SENSITIVE = "SENSITIVE" // Encrypted (pii, legal data)
}

/**
 * Registry of field sensitivity.
 * Add fields here to control their encryption status.
 */
export const FIELD_SENSITIVITY: Record<string, Sensitivity> = {
    // Identity
    "ownerName": Sensitivity.PUBLIC,
    "email": Sensitivity.PUBLIC,

    // Legal Data (Sensitive by default)
    "ssn": Sensitivity.SENSITIVE,
    "taxId": Sensitivity.SENSITIVE,
    "address": Sensitivity.SENSITIVE,
    "phoneNumber": Sensitivity.SENSITIVE,
    "bankAccount": Sensitivity.SENSITIVE,

    // Independent Contractor Fields
    "contractor_name": Sensitivity.SENSITIVE,
    "contractor_address": Sensitivity.SENSITIVE,
    "client_name": Sensitivity.SENSITIVE,
    "compensation": Sensitivity.SENSITIVE,
};

/**
 * Checks if a field should be encrypted.
 * 
 * @param fieldName The name of the field
 * @returns True if the field is marked as SENSITIVE
 */
export function isSensitive(fieldName: string): boolean {
    return FIELD_SENSITIVITY[fieldName] === Sensitivity.SENSITIVE;
}
