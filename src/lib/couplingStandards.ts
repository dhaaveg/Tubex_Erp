/**
 * API Spec 5CT Standard Coupling Length Specifications
 *
 * Provides standard parting lengths for coupling blanks cut from coupling stock
 * organized by size, connection type, and OD.
 */

export interface CouplingLengthSpec {
  category: 'Tubing' | 'Casing';
  size: string; // e.g. 2-3/8", 2-7/8", 7"
  od_mm: number; // approximate OD in mm
  thread: string; // e.g. NU, EU, BTC, STC, LTC, Premium
  length_mm: number;
  label: string;
}

export const COUPLING_LENGTH_SPECS: CouplingLengthSpec[] = [
  // --- Tubing Couplings ---
  { category: 'Tubing', size: '1.900"', od_mm: 48.26, thread: 'NU', length_mm: 95, label: '1.900" NU (95 mm)' },
  { category: 'Tubing', size: '1.900"', od_mm: 48.26, thread: 'EU', length_mm: 98, label: '1.900" EU (98 mm)' },
  { category: 'Tubing', size: '2-3/8"', od_mm: 60.32, thread: 'NU', length_mm: 108, label: '2-3/8" NU (108 mm)' },
  { category: 'Tubing', size: '2-3/8"', od_mm: 60.32, thread: 'EU', length_mm: 124, label: '2-3/8" EU (124 mm)' },
  { category: 'Tubing', size: '2-3/8"', od_mm: 60.32, thread: 'BTC', length_mm: 127, label: '2-3/8" BTC (127 mm)' },
  { category: 'Tubing', size: '2-7/8"', od_mm: 73.02, thread: 'NU', length_mm: 130, label: '2-7/8" NU (130 mm)' },
  { category: 'Tubing', size: '2-7/8"', od_mm: 73.02, thread: 'EU / BTC', length_mm: 135, label: '2-7/8" EU / BTC (135 mm)' },
  { category: 'Tubing', size: '2-7/8"', od_mm: 73.02, thread: 'Premium', length_mm: 140, label: '2-7/8" Premium (140 mm)' },
  { category: 'Tubing', size: '3-1/2"', od_mm: 88.9, thread: 'NU', length_mm: 143, label: '3-1/2" NU (143 mm)' },
  { category: 'Tubing', size: '3-1/2"', od_mm: 88.9, thread: 'EU', length_mm: 146, label: '3-1/2" EU (146 mm)' },
  { category: 'Tubing', size: '3-1/2"', od_mm: 88.9, thread: 'STC', length_mm: 152, label: '3-1/2" STC (152 mm)' },
  { category: 'Tubing', size: '3-1/2"', od_mm: 88.9, thread: 'BTC', length_mm: 152, label: '3-1/2" BTC (152 mm)' },
  { category: 'Tubing', size: '3-1/2"', od_mm: 88.9, thread: 'Premium', length_mm: 155, label: '3-1/2" Premium (155 mm)' },
  { category: 'Tubing', size: '4"', od_mm: 101.6, thread: 'NU', length_mm: 146, label: '4" NU (146 mm)' },
  { category: 'Tubing', size: '4"', od_mm: 101.6, thread: 'EU', length_mm: 152, label: '4" EU (152 mm)' },
  { category: 'Tubing', size: '4-1/2"', od_mm: 114.3, thread: 'NU', length_mm: 152, label: '4-1/2" NU (152 mm)' },
  { category: 'Tubing', size: '4-1/2"', od_mm: 114.3, thread: 'EU', length_mm: 159, label: '4-1/2" EU (159 mm)' },

  // --- Casing Couplings ---
  { category: 'Casing', size: '4-1/2"', od_mm: 114.3, thread: 'STC', length_mm: 152, label: '4-1/2" STC (152 mm)' },
  { category: 'Casing', size: '4-1/2"', od_mm: 114.3, thread: 'LTC', length_mm: 178, label: '4-1/2" LTC (178 mm)' },
  { category: 'Casing', size: '4-1/2"', od_mm: 114.3, thread: 'BTC', length_mm: 225, label: '4-1/2" BTC (225 mm)' },
  { category: 'Casing', size: '4-1/2"', od_mm: 114.3, thread: 'Premium', length_mm: 230, label: '4-1/2" Premium (230 mm)' },
  { category: 'Casing', size: '5"', od_mm: 127.0, thread: 'STC', length_mm: 165, label: '5" STC (165 mm)' },
  { category: 'Casing', size: '5"', od_mm: 127.0, thread: 'LTC', length_mm: 197, label: '5" LTC (197 mm)' },
  { category: 'Casing', size: '5"', od_mm: 127.0, thread: 'BTC', length_mm: 232, label: '5" BTC (232 mm)' },
  { category: 'Casing', size: '5"', od_mm: 127.0, thread: 'Premium', length_mm: 235, label: '5" Premium (235 mm)' },
  { category: 'Casing', size: '5-1/2"', od_mm: 139.7, thread: 'STC', length_mm: 171, label: '5-1/2" STC (171 mm)' },
  { category: 'Casing', size: '5-1/2"', od_mm: 139.7, thread: 'LTC', length_mm: 203, label: '5-1/2" LTC (203 mm)' },
  { category: 'Casing', size: '5-1/2"', od_mm: 139.7, thread: 'BTC', length_mm: 235, label: '5-1/2" BTC (235 mm)' },
  { category: 'Casing', size: '5-1/2"', od_mm: 139.7, thread: 'Premium', length_mm: 240, label: '5-1/2" Premium (240 mm)' },
  { category: 'Casing', size: '6-5/8"', od_mm: 168.28, thread: 'STC', length_mm: 178, label: '6-5/8" STC (178 mm)' },
  { category: 'Casing', size: '6-5/8"', od_mm: 168.28, thread: 'LTC', length_mm: 222, label: '6-5/8" LTC (222 mm)' },
  { category: 'Casing', size: '6-5/8"', od_mm: 168.28, thread: 'BTC', length_mm: 245, label: '6-5/8" BTC (245 mm)' },
  { category: 'Casing', size: '7"', od_mm: 177.8, thread: 'STC', length_mm: 184, label: '7" STC (184 mm)' },
  { category: 'Casing', size: '7"', od_mm: 177.8, thread: 'LTC', length_mm: 229, label: '7" LTC (229 mm)' },
  { category: 'Casing', size: '7"', od_mm: 177.8, thread: 'BTC', length_mm: 254, label: '7" BTC (254 mm)' },
  { category: 'Casing', size: '7"', od_mm: 177.8, thread: 'Premium', length_mm: 260, label: '7" Premium (260 mm)' },
  { category: 'Casing', size: '7-5/8"', od_mm: 193.68, thread: 'STC', length_mm: 191, label: '7-5/8" STC (191 mm)' },
  { category: 'Casing', size: '7-5/8"', od_mm: 193.68, thread: 'LTC', length_mm: 235, label: '7-5/8" LTC (235 mm)' },
  { category: 'Casing', size: '7-5/8"', od_mm: 193.68, thread: 'BTC', length_mm: 260, label: '7-5/8" BTC (260 mm)' },
  { category: 'Casing', size: '8-5/8"', od_mm: 219.08, thread: 'STC', length_mm: 197, label: '8-5/8" STC (197 mm)' },
  { category: 'Casing', size: '8-5/8"', od_mm: 219.08, thread: 'LTC', length_mm: 254, label: '8-5/8" LTC (254 mm)' },
  { category: 'Casing', size: '8-5/8"', od_mm: 219.08, thread: 'BTC', length_mm: 267, label: '8-5/8" BTC (267 mm)' },
  { category: 'Casing', size: '9-5/8"', od_mm: 244.48, thread: 'STC', length_mm: 197, label: '9-5/8" STC (197 mm)' },
  { category: 'Casing', size: '9-5/8"', od_mm: 244.48, thread: 'LTC', length_mm: 267, label: '9-5/8" LTC (267 mm)' },
  { category: 'Casing', size: '9-5/8"', od_mm: 244.48, thread: 'BTC', length_mm: 270, label: '9-5/8" BTC (270 mm)' },
  { category: 'Casing', size: '9-5/8"', od_mm: 244.48, thread: 'Premium', length_mm: 275, label: '9-5/8" Premium (275 mm)' },
  { category: 'Casing', size: '10-3/4"', od_mm: 273.05, thread: 'STC', length_mm: 203, label: '10-3/4" STC (203 mm)' },
  { category: 'Casing', size: '10-3/4"', od_mm: 273.05, thread: 'BTC', length_mm: 267, label: '10-3/4" BTC (267 mm)' },
  { category: 'Casing', size: '11-3/4"', od_mm: 298.45, thread: 'STC', length_mm: 203, label: '11-3/4" STC (203 mm)' },
  { category: 'Casing', size: '11-3/4"', od_mm: 298.45, thread: 'BTC', length_mm: 267, label: '11-3/4" BTC (267 mm)' },
  { category: 'Casing', size: '13-3/8"', od_mm: 339.72, thread: 'STC', length_mm: 203, label: '13-3/8" STC (203 mm)' },
  { category: 'Casing', size: '13-3/8"', od_mm: 339.72, thread: 'BTC', length_mm: 270, label: '13-3/8" BTC (270 mm)' },
  { category: 'Casing', size: '16"', od_mm: 406.4, thread: 'STC', length_mm: 229, label: '16" STC (229 mm)' },
  { category: 'Casing', size: '16"', od_mm: 406.4, thread: 'BTC', length_mm: 270, label: '16" BTC (270 mm)' },
  { category: 'Casing', size: '18-5/8"', od_mm: 473.08, thread: 'STC', length_mm: 229, label: '18-5/8" STC (229 mm)' },
  { category: 'Casing', size: '18-5/8"', od_mm: 473.08, thread: 'BTC', length_mm: 270, label: '18-5/8" BTC (270 mm)' },
  { category: 'Casing', size: '20"', od_mm: 508.0, thread: 'STC', length_mm: 229, label: '20" STC (229 mm)' },
  { category: 'Casing', size: '20"', od_mm: 508.0, thread: 'BTC', length_mm: 270, label: '20" BTC (270 mm)' },
];

/**
 * Helper to match standard coupling length from size, OD (mm), or thread
 */
export function findMatchingCouplingLength(
  sizeOrOd?: string | number | null,
  thread?: string | null
): number | null {
  if (!sizeOrOd && !thread) return null;

  const threadNormalized = (thread || '').trim().toUpperCase();
  const sizeStr = (typeof sizeOrOd === 'string' ? sizeOrOd : '').trim().toUpperCase();
  const odNum = typeof sizeOrOd === 'number' ? sizeOrOd : parseFloat(sizeStr);

  // Exact match by size/OD and thread
  for (const spec of COUPLING_LENGTH_SPECS) {
    const specThread = spec.thread.toUpperCase();
    const matchesThread =
      Boolean(threadNormalized) &&
      (specThread.includes(threadNormalized) || threadNormalized.includes(specThread));

    const cleanSpecSize = spec.size.replace(/["'\s]/g, '');
    const cleanInputSize = sizeStr.replace(/["'\s]/g, '');
    const matchesSizeStr = Boolean(cleanInputSize) && cleanSpecSize === cleanInputSize;

    const matchesOd = !isNaN(odNum) && spec.od_mm && Math.abs(spec.od_mm - odNum) < 2.0;

    if ((matchesSizeStr || matchesOd) && matchesThread) {
      return spec.length_mm;
    }
  }

  // Secondary match: by size/OD alone
  for (const spec of COUPLING_LENGTH_SPECS) {
    const cleanSpecSize = spec.size.replace(/["'\s]/g, '');
    const cleanInputSize = sizeStr.replace(/["'\s]/g, '');
    if (Boolean(cleanInputSize) && cleanSpecSize === cleanInputSize) {
      return spec.length_mm;
    }
    if (!isNaN(odNum) && spec.od_mm && Math.abs(spec.od_mm - odNum) < 2.0) {
      return spec.length_mm;
    }
  }

  return null;
}
