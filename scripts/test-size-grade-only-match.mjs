// Automated verification to confirm PO and Customer PO matching relies strictly on Size & Grade
const baseUrl = 'http://localhost:3000';

function normalizeSize(s) {
  if (!s) return '';
  const str = String(s).trim();
  const fracMatch = str.match(/^(\d+)[-\s](\d+)\/(\d+)/);
  if (fracMatch) {
    const whole = parseFloat(fracMatch[1]);
    const num = parseFloat(fracMatch[2]);
    const den = parseFloat(fracMatch[3]);
    if (den !== 0) {
      const valMm = Number(((whole + num / den) * 25.4).toFixed(1));
      return `${whole}-${num}/${den} in (${valMm} mm)`;
    }
  }
  const num = parseFloat(str);
  if (!isNaN(num) && num > 0) {
    if (str.includes('mm') || num > 30) return `${num} mm`;
    if (str.includes('in') || str.includes('"')) {
      const valMm = Number((num * 25.4).toFixed(1));
      return `${num} in (${valMm} mm)`;
    }
    return `${num} mm`;
  }
  return str;
}

function normalizeGrade(g) {
  return (g || '').trim().toUpperCase();
}

async function main() {
  console.log('Testing Size & Grade ONLY matching between PO and Customer Order...');

  const [pos, cpos] = await Promise.all([
    fetch(`${baseUrl}/api/purchase-orders`).then(r => r.json()),
    fetch(`${baseUrl}/api/customer-orders`).then(r => r.json())
  ]);

  const targetCpo = cpos.find(c => c.customer_po_no === '18434');
  if (!targetCpo) throw new Error('Customer PO 18434 not found');

  const customerSpecs = targetCpo.items.map(it => ({
    size: normalizeSize(it.size),
    grade: normalizeGrade(it.grade),
    thread: it.thread
  }));

  console.log('Customer PO 18434 specifications:', customerSpecs);

  const openPos = pos.filter(po => po.po_status !== 'Closed');

  // Match ONLY Size and Grade
  const matchingPos = openPos.filter(po => {
    return po.po_items?.some(pi => {
      const poSize = normalizeSize(pi.product?.size_od || pi.product?.product_description);
      const poGrade = normalizeGrade(pi.product?.grade);

      return customerSpecs.some(cs => {
        const sMatch = !cs.size || !poSize || cs.size === poSize || cs.size.includes(poSize) || poSize.includes(cs.size);
        const gMatch = !cs.grade || !poGrade || cs.grade === poGrade;
        return sMatch && gMatch;
      });
    });
  });

  console.log('Matching Purchase Orders found strictly by Size & Grade:', matchingPos.map(p => p.po_no));

  const foundTargetPo = matchingPos.find(p => p.po_no === 'EOT/RM/2026/11');
  if (!foundTargetPo) {
    throw new Error('PO EOT/RM/2026/11 failed to match on Size & Grade!');
  }

  // Verify that an unrelated spec does NOT match
  const fakeSpecs = [{ size: '500 mm', grade: 'X80' }];
  const nonMatchingPos = openPos.filter(po => {
    return po.po_items?.some(pi => {
      const poSize = normalizeSize(pi.product?.size_od || pi.product?.product_description);
      const poGrade = normalizeGrade(pi.product?.grade);
      return fakeSpecs.some(cs => {
        const sMatch = !cs.size || !poSize || cs.size === poSize || cs.size.includes(poSize) || poSize.includes(cs.size);
        const gMatch = !cs.grade || !poGrade || cs.grade === poGrade;
        return sMatch && gMatch;
      });
    });
  });

  if (nonMatchingPos.length !== 0) {
    throw new Error('Unrelated specs should not match any PO!');
  }

  console.log('\n============================================================');
  console.log('SUCCESS: Purchase Orders and Customer Orders match ONLY on Size & Grade!');
  console.log('============================================================');
}

main().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
