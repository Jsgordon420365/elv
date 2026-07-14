// ver 20260714152300.0

import { saveAs } from "file-saver";

export function downloadBlob(blob: Blob, fileName: string): void {
    saveAs(blob, fileName);
}

// Version history
// 20260714152300.0 - Added one statically imported browser-download boundary compatible with Next.js CommonJS interop.
