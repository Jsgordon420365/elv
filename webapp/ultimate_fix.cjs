const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function fixTemplate(inputPath, outputPath) {
    const content = fs.readFileSync(inputPath, 'binary');
    const zip = new PizZip(content);
    let xml = zip.file('word/document.xml').asText();

    console.log("Original XML length:", xml.length);

    // 1. Replace all curlies with markers to avoid regex confusion
    xml = xml.replace(/{+/g, 'TOKENOPEN');
    xml = xml.replace(/}+/g, 'TOKENCLOSE');

    // 2. Clear out XML tags that are between an OPEN and its NEXT CLOSE
    xml = xml.replace(/TOKENOPEN(.*?)TOKENCLOSE/gs, (match, p1) => {
        // Remove all XML tags and any leftover TOKEN markers inside
        const cleaned = p1.replace(/<[^>]+>/g, '').replace(/TOKENOPEN/g, '').replace(/TOKENCLOSE/g, '');
        return '{{' + cleaned + '}}';
    });

    // 3. Cleanup: Remove any orphan tokens
    xml = xml.replace(/TOKENOPEN/g, '').replace(/TOKENCLOSE/g, '');

    zip.file('word/document.xml', xml);
    const buffer = zip.generate({ type: 'nodebuffer' });
    fs.writeFileSync(outputPath, buffer);

    try {
        new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        console.log("SUCCESS: Template is now clean and valid.");
    } catch (error) {
        console.error("STILL BROKEN");
        if (error.properties && error.properties.errors) {
            error.properties.errors.forEach(err => console.error("-", err.message, "at", err.properties.offset, "context:", err.properties.context));
        }
    }
}

fixTemplate('public/templates/independent-contractor.docx', 'public/templates/independent-contractor-fixed2.docx');
