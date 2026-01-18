import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { saveAs } from "file-saver";

/**
 * Generates a DOCX document by merging data into a template and triggers a download.
 * 
 * @param templatePath Path to the template in the public folder (e.g., '/templates/independent-contractor.docx')
 * @param data The data object to merge into the template
 * @param fileName The name of the file to be downloaded
 */
export async function generateDocument(templatePath: string, data: Record<string, any>, fileName: string) {
    try {
        // 1. Fetch the template file
        const response = await fetch(templatePath);
        if (!response.ok) throw new Error(`Failed to fetch template: ${templatePath}`);
        const content = await response.arrayBuffer();

        // 2. Load the binary content into PizZip
        const zip = new PizZip(content);

        // 3. Initialize Docxtemplater
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // 4. Render the document (replace placeholders with data)
        doc.render(data);

        // 5. Generate the output as a blob
        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        // 6. Trigger the download
        saveAs(out, fileName);

        return { success: true };
    } catch (error: any) {
        console.error("Document Generation Error:", error);

        // Handle docxtemplater multi-errors
        if (error.properties && error.properties.errors instanceof Array) {
            const errorMessages = error.properties.errors.map((e: any) => e.message).join("\n");
            throw new Error(`Template Error: ${errorMessages}`);
        }

        throw error;
    }
}
