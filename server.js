const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 5000;

app.use(cors());
const upload = multer({ dest: 'uploads/' });

// Helper: Generate basic EDI envelope
const generateEnvelope = (content, formatCode) => {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
  const time = now.toTimeString().slice(0, 5).replace(/:/g, ''); // HHMM
  const ctrlNumber = String(Math.floor(Math.random() * 1000000)).padStart(9, '0');

  return [
    `ISA*00*          *00*          *ZZ*SENDERSID     *ZZ*RECEIVERSID   *${date}*${time}*U*00401*${ctrlNumber}*0*T*>`,
    `GS*${formatCode}*SENDERSID*RECEIVERSID*${date}*${time}*${ctrlNumber}*X*004010`,
    `ST*${formatCode}*0001`,
    content,
    `SE*${content.split('\n').length + 2}*0001`,
    `GE*1*${ctrlNumber}`,
    `IEA*1*${ctrlNumber}`
  ].join('\n');
};

// Format-specific converters
function convertToEDI204(rows, headers) {
  return rows.map((values, i) => {
    const [shipmentId, origin, destination, weight] = values;
    return [
      `B2*${shipmentId}*CARRIER*SHIPMENTREF`,
      `L11*${shipmentId}*SI`,
      `N1*SH*${origin}`,
      `N1*CN*${destination}`,
      `AT8*G*L*${weight}`
    ].join('\n');
  }).join('\n');
}

function convertToEDI210(rows, headers) {
  return rows.map((values, i) => {
    const [invoiceNo, amount, scac] = values;
    return [
      `BIG*20240530*${invoiceNo}`,
      `N1*BT*BILLTO`,
      `IT1**1*EA*${amount}**SC*${scac}`,
      `TDS*${parseInt(amount * 100)}`
    ].join('\n');
  }).join('\n');
}

function convertToEDI214(rows, headers) {
  return rows.map((values, i) => {
    const [shipmentId, statusCode, date, time] = values;
    return [
      `B10*${shipmentId}*REFERENCE*SCAC`,
      `LX*${i + 1}`,
      `AT7*${statusCode}*NS***${date}*${time}`,
      `MS1*CITY*ST*US`,
      `MS2*SCAC*TRAILER`
    ].join('\n');
  }).join('\n');
}

function convertToEDI990(rows, headers) {
  return rows.map((values, i) => {
    const [shipmentId, acceptReject, carrierId] = values;
    return [
      `B1*${carrierId}*${shipmentId}`,
      `B2A*${acceptReject}`
    ].join('\n');
  }).join('\n');
}

app.post('/convert', upload.single('file'), (req, res) => {
  const format = req.body.format || '214';
  const formatCode = {
    '204': 'SM',
    '210': 'IN',
    '214': 'QM',
    '990': 'GF'
  }[format];

  const csv = fs.readFileSync(req.file.path, 'utf8');
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(line => line.split(','));

  let ediBody = '';
  switch (format) {
    case '204':
      ediBody = convertToEDI204(rows, headers);
      break;
    case '210':
      ediBody = convertToEDI210(rows, headers);
      break;
    case '990':
      ediBody = convertToEDI990(rows, headers);
      break;
    case '214':
    default:
      ediBody = convertToEDI214(rows, headers);
  }

  const fullEDI = generateEnvelope(ediBody, formatCode);
  const ediPath = path.join(__dirname, 'uploads', `output_${format}.edi`);
  fs.writeFileSync(ediPath, fullEDI);

  res.download(ediPath, `output_${format}.edi`, () => {
    fs.unlinkSync(req.file.path);
    fs.unlinkSync(ediPath);
  });
});

app.listen(port, () => console.log(`✅ Server running on http://localhost:${port}`));
