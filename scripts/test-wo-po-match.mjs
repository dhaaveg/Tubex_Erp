// Verification script to test PO matching for Customer PO 18434
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

function normalizeThread(t) {
  const str = (t || '').trim().toUpperCase();
  if (str.includes('BTC') || str.includes('BUTTRESS')) return 'BTC';
  if (str.includes('LTC') || str.includes('LONG')) return 'LTC';
  if (str.includes('STC') || str.includes('SHORT')) return 'STC';
  if (str.includes('NU') || str.includes('NON-UPSET') || str.includes('NON UPSET')) return 'NU';
  if (str.includes('EUE') || str.includes('UPSET')) return 'EUE';
  if (str.includes('PREMIUM') || str.includes('GAS-TIGHT')) return 'Premium';
  return (t || '').trim();
}

function isThreadCompatible(t1, t2) {
  const norm1 = normalizeThread(t1);
  const norm2 = normalizeThread(t2);
  if (!norm1 || !norm2) return true;
  if (norm1 === norm2) return true;
  if (norm1 === 'Plain End' || norm2 === 'Plain End' || norm1 === 'PE' || norm2 === 'PE') return true;
  if ((norm1 === 'EUE' || norm1 === 'Premium') && (norm2 === 'EUE' || norm2 === 'Premium')) return true;
  return false;
}

async function main() {
  const [pos, cpos] = await Promise.all([
    fetch(`${baseUrl}/api/purchase-orders`).then(r => r.json()),
    fetch(`${baseUrl}/api/customer-orders`).then(r => r.json())
  ]);

  const targetCpo = cpos.find(c => c.customer_po_no === '18434');
  if (!targetCpo) throw new Error('Customer PO 18434 not found');

  const customerSpecs = targetCpo.items.map(it => ({
    size: normalizeSize(it.size),
    grade: normalizeGrade(it.grade),
    thread: normalizeThread(it.thread)
  }));

  console.log('Customer PO 18434 specifications:', customerSpecs);

  const openPos = pos.filter(po => po.po_status !== 'Closed');

  const matchingPos = openPos.filter(po => {
    return po.po_items?.some(pi => {
      const poSize = normalizeSize(pi.product?.size_od || pi.product?.product_description);
      const poGrade = normalizeGrade(pi.product?.grade);
      const poThread = normalizeThread(pi.product?.thread_type);

      return customerSpecs.some(cs => {
        const sMatch = !cs.size || !poSize || cs.size === poSize || cs.size.includes(poSize) || poSize.includes(cs.size);
        const gMatch = !cs.grade || !poGrade || cs.grade === poGrade;
        const tMatch = isThreadCompatible(cs.thread, poThread);
        return sMatch && gMatch && tMatch;
      });
    });
  });

  console.log('Matching Purchase Orders found:', matchingPos.map(p => p.po_no));

  const foundTargetPo = matchingPos.find(p => p.po_no === 'EOT/RM/2026/11');
  if (!foundTargetPo) {
    throw new Error('PO EOT/RM/2026/11 was NOT matched!');
  }

  console.log('\n============================================================');
  console.log('SUCCESS: PO EOT/RM/2026/11 correctly matched for Customer PO 18434!');
  console.log('============================================================');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
