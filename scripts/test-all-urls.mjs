import http from 'http';

const PAGE_URLS = [
  '/',
  '/overview',
  '/master-data',
  '/procurement',
  '/receiving',
  '/customer-orders',
  '/shop-floor',
  '/quality',
  '/traceability',
  '/admin-export',
  // Short Aliases
  '/po',
  '/purchase-orders',
  '/tally',
  '/grn',
  '/cpo',
  '/orders',
  '/wo',
  '/work-orders',
  '/qa',
  '/rejections',
  '/export',
];

const API_URLS = [
  '/api/stats',
  '/api/suppliers',
  '/api/products',
  '/api/purchase-orders',
  '/api/grn',
  '/api/tally',
  '/api/customer-orders',
  '/api/work-orders',
  '/api/production-postings',
  '/api/rejections',
  '/api/traceability?q=TAG-HT84920-001',
  '/api/export',
];

function checkUrl(urlPath) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path: urlPath,
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          success: res.statusCode >= 200 && res.statusCode < 400,
          length: data.length
        });
      });
    }).on('error', (err) => {
      resolve({
        path: urlPath,
        statusCode: 0,
        error: err.message,
        success: false
      });
    });
  });
}

async function main() {
  console.log('========================================================');
  console.log('       TESTING ALL ERP APPLICATION & API URLS           ');
  console.log('========================================================');

  let failedCount = 0;

  console.log('\n--- Checking Frontend Module & Page URLs ---');
  for (const p of PAGE_URLS) {
    const res = await checkUrl(p);
    if (res.success) {
      console.log(`[PASS] ${p.padEnd(20)} -> HTTP ${res.statusCode} (${res.length} bytes)`);
    } else {
      console.error(`[FAIL] ${p.padEnd(20)} -> HTTP ${res.statusCode} error: ${res.error || 'bad status'}`);
      failedCount++;
    }
  }

  console.log('\n--- Checking Backend REST API URLs ---');
  for (const p of API_URLS) {
    const res = await checkUrl(p);
    if (res.success) {
      console.log(`[PASS] ${p.padEnd(38)} -> HTTP ${res.statusCode}`);
    } else {
      console.error(`[FAIL] ${p.padEnd(38)} -> HTTP ${res.statusCode} error: ${res.error || 'bad status'}`);
      failedCount++;
    }
  }

  console.log('\n========================================================');
  if (failedCount === 0) {
    console.log(' SUCCESS: ALL URLS ARE ACTIVATED AND RETURNING 200 OK!');
    console.log('========================================================');
    process.exit(0);
  } else {
    console.error(` FAILED: ${failedCount} URLs failed.`);
    console.log('========================================================');
    process.exit(1);
  }
}

main();
