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
    const headers = lines[0].split(',');
    const ediSegments = lines.slice(1).map((line, index) => {
        const values = line.split(',');
        const segment = headers.map((h, i) => `${h.trim()}:${values[i].trim()}`).join('|');
        return `EDI214-${index + 1}|${segment}`;
    });
    const ediContent = ediSegments.join('\n');
    const ediPath = path.join(__dirname, 'uploads', 'output.edi');
    fs.writeFileSync(ediPath, ediContent);
    res.download(ediPath, 'output.edi', () => {
        fs.unlinkSync(req.file.path);
        fs.unlinkSync(ediPath);
    });
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));