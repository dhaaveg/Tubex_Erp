import assert from 'node:assert';
import {
  getCurrentShift,
  getActiveRotationalShift,
  getShiftProductionDate,
  getShiftTimeRemaining,
  getShiftTimeElapsed,
  isShiftChangeoverImminent,
  getNextShift,
  getTimeInTimezone,
  timeStringToSeconds,
  getPreviousDateString,
  getNextDateString,
  getShiftByCodeOrName,
  DEFAULT_SHIFT_CONFIGS,
} from '../src/utils/shiftUtils';

console.log('--- STARTING SHIFT ENGINE COMPREHENSIVE UNIT TESTS ---');

// Helper to create an exact Date in UTC that maps to specific local time in Asia/Kolkata (UTC + 05:30)
function createKolkataDate(
  year: number,
  month: number, // 1-12
  day: number,
  hours: number,
  minutes: number,
  seconds: number
): Date {
  // Asia/Kolkata is UTC + 5h 30m. Subtract 5h 30m to get UTC time
  const totalMinutes = hours * 60 + minutes - 330;
  const utcHours = Math.floor(totalMinutes / 60);
  const utcMinutes = ((totalMinutes % 60) + 60) % 60;
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, seconds));
  date.setUTCMinutes(date.getUTCMinutes() + totalMinutes);
  return date;
}

// 1. Timezone extraction tests
{
  const testDate = createKolkataDate(2026, 10, 17, 14, 30, 45);
  const info = getTimeInTimezone(testDate, 'Asia/Kolkata');
  assert.strictEqual(info.year, 2026);
  assert.strictEqual(info.month, 10);
  assert.strictEqual(info.day, 17);
  assert.strictEqual(info.hours, 14);
  assert.strictEqual(info.minutes, 30);
  assert.strictEqual(info.seconds, 45);
  assert.strictEqual(info.dateString, '2026-10-17');
  assert.strictEqual(info.timeString, '14:30:45');
  console.log('✓ Timezone component parsing passed.');
}

// 2. Pure Date arithmetic
{
  assert.strictEqual(getPreviousDateString('2026-10-17'), '2026-10-16');
  assert.strictEqual(getPreviousDateString('2026-03-01'), '2026-02-28');
  assert.strictEqual(getPreviousDateString('2024-03-01'), '2024-02-29'); // Leap year
  assert.strictEqual(getPreviousDateString('2026-01-01'), '2025-12-31');

  assert.strictEqual(getNextDateString('2026-10-16'), '2026-10-17');
  assert.strictEqual(getNextDateString('2025-12-31'), '2026-01-01');
  console.log('✓ Pure UTC date string math passed.');
}

// 3. Exact boundary seconds tests
// Boundary 1: 05:59:59 (Shift C) vs 06:00:00 (Shift A)
{
  const t_05_59_59 = createKolkataDate(2026, 10, 17, 5, 59, 59);
  const shiftC = getActiveRotationalShift(t_05_59_59, 'Asia/Kolkata');
  assert.strictEqual(shiftC.code, 'SHIFT_C', '05:59:59 must be Shift C');
  const prodDateC = getShiftProductionDate(t_05_59_59, 'SHIFT_C', 'Asia/Kolkata');
  assert.strictEqual(prodDateC, '2026-10-16', '05:59:59 Shift C must attribute to previous day start date');
  const remC = getShiftTimeRemaining(t_05_59_59, shiftC, 'Asia/Kolkata');
  assert.strictEqual(remC.totalSeconds, 1, '05:59:59 Shift C must have exactly 1 second remaining');

  const t_06_00_00 = createKolkataDate(2026, 10, 17, 6, 0, 0);
  const shiftA = getActiveRotationalShift(t_06_00_00, 'Asia/Kolkata');
  assert.strictEqual(shiftA.code, 'SHIFT_A', '06:00:00 must be Shift A');
  const prodDateA = getShiftProductionDate(t_06_00_00, 'SHIFT_A', 'Asia/Kolkata');
  assert.strictEqual(prodDateA, '2026-10-17', '06:00:00 Shift A must attribute to current date');
  const remA = getShiftTimeRemaining(t_06_00_00, shiftA, 'Asia/Kolkata');
  assert.strictEqual(remA.totalSeconds, 28800, '06:00:00 Shift A must have 28800 seconds (8h) remaining');
  const elapsedA = getShiftTimeElapsed(t_06_00_00, shiftA, 'Asia/Kolkata');
  assert.strictEqual(elapsedA.elapsedSeconds, 0, '06:00:00 Shift A must have 0 elapsed seconds');
  assert.strictEqual(elapsedA.percent, 0);
  console.log('✓ Boundary 05:59:59 -> 06:00:00 passed cleanly.');
}

// Boundary 2: 13:59:59 (Shift A) vs 14:00:00 (Shift B)
{
  const t_13_59_59 = createKolkataDate(2026, 10, 17, 13, 59, 59);
  const shiftA = getActiveRotationalShift(t_13_59_59, 'Asia/Kolkata');
  assert.strictEqual(shiftA.code, 'SHIFT_A', '13:59:59 must be Shift A');
  const remA = getShiftTimeRemaining(t_13_59_59, shiftA, 'Asia/Kolkata');
  assert.strictEqual(remA.totalSeconds, 1, '13:59:59 Shift A must have 1 second remaining');
  assert.strictEqual(isShiftChangeoverImminent(t_13_59_59, shiftA, 15, 'Asia/Kolkata'), true);

  const t_14_00_00 = createKolkataDate(2026, 10, 17, 14, 0, 0);
  const shiftB = getActiveRotationalShift(t_14_00_00, 'Asia/Kolkata');
  assert.strictEqual(shiftB.code, 'SHIFT_B', '14:00:00 must be Shift B');
  const remB = getShiftTimeRemaining(t_14_00_00, shiftB, 'Asia/Kolkata');
  assert.strictEqual(remB.totalSeconds, 28800, '14:00:00 Shift B must have 28800 seconds (8h) remaining');
  assert.strictEqual(isShiftChangeoverImminent(t_14_00_00, shiftB, 15, 'Asia/Kolkata'), false);
  console.log('✓ Boundary 13:59:59 -> 14:00:00 passed cleanly.');
}

// Boundary 3: 21:59:59 (Shift B) vs 22:00:00 (Shift C)
{
  const t_21_59_59 = createKolkataDate(2026, 10, 17, 21, 59, 59);
  const shiftB = getActiveRotationalShift(t_21_59_59, 'Asia/Kolkata');
  assert.strictEqual(shiftB.code, 'SHIFT_B', '21:59:59 must be Shift B');
  const remB = getShiftTimeRemaining(t_21_59_59, shiftB, 'Asia/Kolkata');
  assert.strictEqual(remB.totalSeconds, 1, '21:59:59 Shift B must have 1 second remaining');
  assert.strictEqual(isShiftChangeoverImminent(t_21_59_59, shiftB, 15, 'Asia/Kolkata'), true);

  const t_22_00_00 = createKolkataDate(2026, 10, 17, 22, 0, 0);
  const shiftC = getActiveRotationalShift(t_22_00_00, 'Asia/Kolkata');
  assert.strictEqual(shiftC.code, 'SHIFT_C', '22:00:00 must be Shift C');
  const prodDateC = getShiftProductionDate(t_22_00_00, 'SHIFT_C', 'Asia/Kolkata');
  assert.strictEqual(prodDateC, '2026-10-17', '22:00:00 Shift C must attribute to current date');
  const remC = getShiftTimeRemaining(t_22_00_00, shiftC, 'Asia/Kolkata');
  assert.strictEqual(remC.totalSeconds, 28800, '22:00:00 Shift C must have 28800 seconds (8h) remaining');
  const elapsedC = getShiftTimeElapsed(t_22_00_00, shiftC, 'Asia/Kolkata');
  assert.strictEqual(elapsedC.elapsedSeconds, 0);
  assert.strictEqual(elapsedC.percent, 0);
  console.log('✓ Boundary 21:59:59 -> 22:00:00 passed cleanly.');
}

// Boundary 4: Midnight Transition 23:59:59 to 00:00:00 (Within Shift C)
{
  const t_23_59_59 = createKolkataDate(2026, 10, 17, 23, 59, 59);
  const shiftPreMidnight = getActiveRotationalShift(t_23_59_59, 'Asia/Kolkata');
  assert.strictEqual(shiftPreMidnight.code, 'SHIFT_C');
  const prodDatePre = getShiftProductionDate(t_23_59_59, 'SHIFT_C', 'Asia/Kolkata');
  assert.strictEqual(prodDatePre, '2026-10-17', '23:59:59 Shift C attributes to shift start date (Oct 17)');
  const remPre = getShiftTimeRemaining(t_23_59_59, shiftPreMidnight, 'Asia/Kolkata');
  assert.strictEqual(remPre.totalSeconds, 21601, '23:59:59 has 1s until midnight + 6h = 21601s remaining');
  const elapsedPre = getShiftTimeElapsed(t_23_59_59, shiftPreMidnight, 'Asia/Kolkata');
  assert.strictEqual(elapsedPre.elapsedSeconds, 7199, '23:59:59 has elapsed 2h minus 1s = 7199s');

  const t_00_00_00 = createKolkataDate(2026, 10, 18, 0, 0, 0);
  const shiftPostMidnight = getActiveRotationalShift(t_00_00_00, 'Asia/Kolkata');
  assert.strictEqual(shiftPostMidnight.code, 'SHIFT_C');
  const prodDatePost = getShiftProductionDate(t_00_00_00, 'SHIFT_C', 'Asia/Kolkata');
  assert.strictEqual(prodDatePost, '2026-10-17', '00:00:00 Shift C MUST attribute to previous date when shift started (Oct 17)!');
  const remPost = getShiftTimeRemaining(t_00_00_00, shiftPostMidnight, 'Asia/Kolkata');
  assert.strictEqual(remPost.totalSeconds, 21600, '00:00:00 has exactly 6h (21600s) remaining until 06:00:00');
  const elapsedPost = getShiftTimeElapsed(t_00_00_00, shiftPostMidnight, 'Asia/Kolkata');
  assert.strictEqual(elapsedPost.elapsedSeconds, 7200, '00:00:00 has elapsed 2h (7200s)');
  assert.strictEqual(elapsedPost.percent, 25, '2h of 8h shift is 25%');
  console.log('✓ Midnight transition 23:59:59 -> 00:00:00 passed with flawless date attribution.');
}

// 4. Changeover Imminent Warning Thresholds
{
  // Shift A ends at 14:00. Threshold = 15m (13:45:00)
  const t_13_44_00 = createKolkataDate(2026, 10, 17, 13, 44, 0);
  assert.strictEqual(isShiftChangeoverImminent(t_13_44_00, undefined, 15, 'Asia/Kolkata'), false);

  const t_13_45_00 = createKolkataDate(2026, 10, 17, 13, 45, 0);
  assert.strictEqual(isShiftChangeoverImminent(t_13_45_00, undefined, 15, 'Asia/Kolkata'), true);

  const t_13_55_00 = createKolkataDate(2026, 10, 17, 13, 55, 0);
  assert.strictEqual(isShiftChangeoverImminent(t_13_55_00, undefined, 15, 'Asia/Kolkata'), true);

  // Shift C ends at 06:00. Threshold = 15m (05:45:00)
  const t_05_44_00 = createKolkataDate(2026, 10, 17, 5, 44, 0);
  assert.strictEqual(isShiftChangeoverImminent(t_05_44_00, undefined, 15, 'Asia/Kolkata'), false);

  const t_05_45_00 = createKolkataDate(2026, 10, 17, 5, 45, 0);
  assert.strictEqual(isShiftChangeoverImminent(t_05_45_00, undefined, 15, 'Asia/Kolkata'), true);
  console.log('✓ Shift changeover threshold tests passed.');
}

// 5. Next Shift Rotation
{
  const shiftA = DEFAULT_SHIFT_CONFIGS[0];
  const shiftB = DEFAULT_SHIFT_CONFIGS[1];
  const shiftC = DEFAULT_SHIFT_CONFIGS[2];

  assert.strictEqual(getNextShift(shiftA).code, 'SHIFT_B');
  assert.strictEqual(getNextShift(shiftB).code, 'SHIFT_C');
  assert.strictEqual(getNextShift(shiftC).code, 'SHIFT_A');
  console.log('✓ Next shift sequence rotation passed (A -> B -> C -> A).');
}

// 6. Full snapshot calculation via getCurrentShift()
{
  const t_now = createKolkataDate(2026, 10, 17, 10, 30, 0);
  const snapshot = getCurrentShift(t_now, 'Asia/Kolkata');
  assert.strictEqual(snapshot.code, 'SHIFT_A');
  assert.strictEqual(snapshot.displayName, 'Shift A');
  assert.strictEqual(snapshot.productionDate, '2026-10-17');
  assert.strictEqual(snapshot.timeRemaining.hours, 3);
  assert.strictEqual(snapshot.timeRemaining.minutes, 30);
  assert.strictEqual(snapshot.timeElapsed.percent, 56);
  assert.strictEqual(snapshot.isTransitioning, false);
  assert.strictEqual(snapshot.nextShift.code, 'SHIFT_B');
  assert.strictEqual(snapshot.currentTimeString, '10:30:00');
  console.log('✓ Full getCurrentShift() snapshot verification passed.');
}

// 7. Lookup by code or display name
{
  assert.strictEqual(getShiftByCodeOrName('SHIFT_A').code, 'SHIFT_A');
  assert.strictEqual(getShiftByCodeOrName('Shift a').code, 'SHIFT_A');
  assert.strictEqual(getShiftByCodeOrName('Shift B').code, 'SHIFT_B');
  assert.strictEqual(getShiftByCodeOrName('Night Shift').code, 'SHIFT_C');
  assert.strictEqual(getShiftByCodeOrName('SHIFT_GEN').code, 'SHIFT_GEN');
  assert.strictEqual(getShiftByCodeOrName('General Shift').code, 'SHIFT_GEN');
  console.log('✓ getShiftByCodeOrName() normalization passed.');
}

console.log('--- ALL UNIT TESTS COMPLETED SUCCESSFULLY WITH 100% PASS RATE ---');
