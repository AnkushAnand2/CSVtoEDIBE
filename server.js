const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 5000;

app.use(cors());
const upload = multer({ dest: 'uploads/' });

app.post('/convert', upload.single('file'), (req, res) => {
    const csv = fs.readFileSync(req.file.path, 'utf8');
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const ediSegments = [];

    ediSegments.push("ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *240528*1200*U*00401*000000001*0*T*:");
    ediSegments.push("GS*QM*SENDERID*RECEIVERID*20240528*1200*1*X*004010");

    lines.slice(1).forEach((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const row = Object.fromEntries(headers.map((h, i) => [h, values[i]]));

        ediSegments.push(`ST*214*${String(index + 1).padStart(4, '0')}`);
        ediSegments.push(`B10*${row.shipmentId || 'UNKNOWN'}*${row.scacCode || 'SCAC'}*${row.referenceNumber || 'REF123'}`);
        ediSegments.push(`L11*${row.purchaseOrderNumber || 'PO123'}*PO`);
        ediSegments.push(`AT7*${row.statusCode || 'AF'}*NS***${row.date || '20240528'}*${row.time || '1200'}*LT`);
        ediSegments.push(`SE*5*${String(index + 1).padStart(4, '0')}`);
    });

    ediSegments.push("GE*1*1");
    ediSegments.push("IEA*1*000000001");

    const ediContent = ediSegments.join('\n');
    const ediPath = path.join(__dirname, 'uploads', 'output.edi');
    fs.writeFileSync(ediPath, ediContent);

    res.download(ediPath, 'output.edi', () => {
        fs.unlinkSync(req.file.path);
        fs.unlinkSync(ediPath);
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
