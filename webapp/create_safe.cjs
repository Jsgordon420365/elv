const fs = require('fs');
const PizZip = require('pizzip');

function createSafeTemplate(inputPath, outputPath) {
    const content = fs.readFileSync(inputPath, 'binary');
    const zip = new PizZip(content);
    const safeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
    <w:p><w:r><w:t>ELV ENCRYPTED VAULT - DOCUMENT PREVIEW</w:t></w:r></w:p>
    <w:p><w:r><w:t>Owner: {{owner_name}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Contractor: {{contractor_name}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Start Date: {{agreement_start_date}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Forum: {{forum_county_comma_state}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>---</w:t></w:r></w:p>
    <w:p><w:r><w:t>This document was generated safely from your encrypted vault.</w:t></w:r></w:p>
</w:body>
</w:document>`;
    zip.file('word/document.xml', safeXml);
    fs.writeFileSync(outputPath, zip.generate({ type: 'nodebuffer' }));
}

createSafeTemplate('public/templates/independent-contractor.docx', 'public/templates/safe-test.docx');
