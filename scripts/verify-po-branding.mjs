import http from 'http';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('--- Verifying PO Invoice Modal Branding & Assets ---');

  const compPath = path.resolve('src/components/PoInvoiceModal.tsx');
  const compContent = fs.readFileSync(compPath, 'utf8');

  const expectedIdentifiers = [
    'COMPANY_LOGO_DATA_URI',
    'COMPANY_NAME',
    'COMPANY_GSTIN',
    'COMPANY_CIN',
    'COMPANY_IEC'
  ];

  let missing = [];
  for (const s of expectedIdentifiers) {
    if (!compContent.includes(s)) {
      missing.push(s);
    }
  }

  if (missing.length > 0) {
    console.error('FAILED: Missing identifiers in PoInvoiceModal.tsx:', missing);
    process.exit(1);
  }
  console.log('SUCCESS: All branding identifiers referenced in PoInvoiceModal.tsx');

  // Verify companyLogo.ts
  const logoPath = path.resolve('src/lib/companyLogo.ts');
  const logoContent = fs.readFileSync(logoPath, 'utf8');
  const expectedValues = [
    'EOT COUPLINGS AND CONNECTIONS PVT. LTD.',
    '27AAGCE9584L1ZU',
    'U29309DL2022PTC395581',
    'AAGCE9584L'
  ];
  for (const v of expectedValues) {
    if (!logoContent.includes(v)) {
      console.error('FAILED: Missing value in companyLogo.ts:', v);
      process.exit(1);
    }
  }
  console.log('SUCCESS: All required values verified in companyLogo.ts');
  if (!logoContent.includes('COMPANY_LOGO_DATA_URI = "data:image/png;base64,')) {
    console.error('FAILED: Logo data URI missing in companyLogo.ts');
    process.exit(1);
  }
  console.log('SUCCESS: Logo Data URI confirmed in companyLogo.ts');

  // Verify static logo file
  const publicLogoPath = path.resolve('public/images/eot-logo.png');
  if (!fs.existsSync(publicLogoPath)) {
    console.error('FAILED: Public logo file missing');
    process.exit(1);
  }
  console.log('SUCCESS: public/images/eot-logo.png exists and size is', fs.statSync(publicLogoPath).size, 'bytes');

  // Test server connectivity
  http.get('http://localhost:3000/', (res) => {
    console.log(`Server HTTP Status: ${res.statusCode}`);
    if (res.statusCode === 200) {
      console.log('Server verified responding with 200 OK');
      process.exit(0);
    } else {
      console.warn('Unexpected status:', res.statusCode);
      process.exit(0);
    }
  }).on('error', (err) => {
    console.error('Server connection error:', err.message);
    process.exit(1);
  });
}

main();
