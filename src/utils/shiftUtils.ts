/**
 * Deterministic Manufacturing Shift Calculation and Synchronization Engine
 * Tubex OCTG Manufacturing ERP
 *
 * Implements deterministic timezone-aware shift rotation, midnight-crossing date attribution,
 * real-time elapsed/remaining time calculation, and changeover detection.
 */

export type ShiftCode = 'SHIFT_A' | 'SHIFT_B' | 'SHIFT_C' | 'SHIFT_GEN';
export type ShiftDisplayName = 'Shift A' | 'Shift B' | 'Shift C' | 'General Shift';

export interface ShiftTheme {
  badgeLight: string;
  badgeDark: string;
  textLight: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
  accentBg: string;
  accentText: string;
  iconName: 'Sun' | 'Sunset' | 'Moon' | 'Clock';
}

export type DateAttributionRule = 'start_date' | 'end_date' | 'current_date';

export interface ShiftConfig {
  code: ShiftCode;
  name: string; // e.g. "Morning Shift"
  displayName: ShiftDisplayName | string; // e.g. "Shift A"
  startTime: string; // "HH:MM:SS" (inclusive)
  endTime: string; // "HH:MM:SS" (exclusive for rotational handoff)
  crossesMidnight: boolean;
  isRotationalProduction: boolean;
  dateAttributionRule: DateAttributionRule;
  description: string;
  theme: ShiftTheme;
}

export interface ShiftTimeComponents {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  secondsOfDay: number;
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:MM:SS
}

export interface ShiftTimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
  totalSeconds: number;
  formatted: string;
}

export interface ShiftTimeElapsed {
  elapsedMinutes: number;
  totalDurationMinutes: number;
  elapsedSeconds: number;
  totalDurationSeconds: number;
  percent: number;
}

export interface ShiftInfo extends ShiftConfig {
  productionDate: string;
  timeRemaining: ShiftTimeRemaining;
  timeElapsed: ShiftTimeElapsed;
  isTransitioning: boolean;
  nextShift: ShiftConfig;
  currentTimeString: string;
}

export const DEFAULT_PLANT_TIMEZONE =
  process.env.NEXT_PUBLIC_PLANT_TIMEZONE || 'Asia/Kolkata';

export const DEFAULT_SHIFT_CONFIGS: ShiftConfig[] = [
  {
    code: 'SHIFT_A',
    name: 'Morning Shift',
    displayName: 'Shift A',
    startTime: '06:00:00',
    endTime: '14:00:00',
    crossesMidnight: false,
    isRotationalProduction: true,
    dateAttributionRule: 'current_date',
    description: 'Primary morning production cycle (CNC threading, sizing, and MPI)',
    theme: {
      badgeLight: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeDark: 'dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800',
      textLight: 'text-blue-700',
      textDark: 'dark:text-blue-300',
      borderLight: 'border-blue-200',
      borderDark: 'dark:border-blue-800',
      accentBg: 'bg-blue-600',
      accentText: 'text-blue-600 dark:text-blue-400',
      iconName: 'Sun',
    },
  },
  {
    code: 'SHIFT_B',
    name: 'Evening Shift',
    displayName: 'Shift B',
    startTime: '14:00:00',
    endTime: '22:00:00',
    crossesMidnight: false,
    isRotationalProduction: true,
    dateAttributionRule: 'current_date',
    description: 'Evening production cycle (threading, hydrotesting, phosphating)',
    theme: {
      badgeLight: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeDark: 'dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
      textLight: 'text-amber-700',
      textDark: 'dark:text-amber-300',
      borderLight: 'border-amber-200',
      borderDark: 'dark:border-amber-800',
      accentBg: 'bg-amber-600',
      accentText: 'text-amber-600 dark:text-amber-400',
      iconName: 'Sunset',
    },
  },
  {
    code: 'SHIFT_C',
    name: 'Night Shift',
    displayName: 'Shift C',
    startTime: '22:00:00',
    endTime: '06:00:00',
    crossesMidnight: true,
    isRotationalProduction: true,
    dateAttributionRule: 'start_date',
    description: 'Night cycle spanning midnight; production date attributed to shift start',
    theme: {
      badgeLight: 'bg-purple-50 text-purple-700 border-purple-200',
      badgeDark: 'dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800',
      textLight: 'text-purple-700',
      textDark: 'dark:text-purple-300',
      borderLight: 'border-purple-200',
      borderDark: 'dark:border-purple-800',
      accentBg: 'bg-purple-600',
      accentText: 'text-purple-600 dark:text-purple-400',
      iconName: 'Moon',
    },
  },
  {
    code: 'SHIFT_GEN',
    name: 'General Shift',
    displayName: 'General Shift',
    startTime: '09:00:00',
    endTime: '17:30:00',
    crossesMidnight: false,
    isRotationalProduction: false,
    dateAttributionRule: 'current_date',
    description: 'Administrative, plant maintenance, QA calibration, and tooling setup',
    theme: {
      badgeLight: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeDark: 'dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800',
      textLight: 'text-emerald-700',
      textDark: 'dark:text-emerald-300',
      borderLight: 'border-emerald-200',
      borderDark: 'dark:border-emerald-800',
      accentBg: 'bg-emerald-600',
      accentText: 'text-emerald-600 dark:text-emerald-400',
      iconName: 'Clock',
    },
  },
];

/**
 * Converts a time string "HH:MM:SS" into total seconds of the day (0..86399).
 */
export function timeStringToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  const s = parseInt(parts[2] || '0', 10);
  return (h * 3600 + m * 60 + s) % 86400;
}

/**
 * Parses a Date into precise timezone components using Intl.DateTimeFormat.
 * Guarantees zero hydration mismatch and works across SSR and client runtimes.
 */
export function getTimeInTimezone(
  date: Date = new Date(),
  timezone: string = DEFAULT_PLANT_TIMEZONE
): ShiftTimeComponents {
  // Gracefully validate timezone; fallback to local environment timezone if invalid
  let validTimezone = timezone;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: validTimezone });
  } catch {
    validTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: validTimezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  }

  const year = parseInt(map.year || '1970', 10);
  const month = parseInt(map.month || '1', 10);
  const day = parseInt(map.day || '1', 10);

  let hours = parseInt(map.hour || '0', 10);
  if (hours === 24) hours = 0; // Some environments format midnight as 24:00
  const minutes = parseInt(map.minute || '0', 10);
  const seconds = parseInt(map.second || '0', 10);

  const secondsOfDay = hours * 3600 + minutes * 60 + seconds;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateString = `${year}-${pad(month)}-${pad(day)}`;
  const timeString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    secondsOfDay,
    dateString,
    timeString,
  };
}

/**
 * Calculates previous calendar date in YYYY-MM-DD format using pure UTC math.
 */
export function getPreviousDateString(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  const py = date.getUTCFullYear();
  const pm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const pd = String(date.getUTCDate()).padStart(2, '0');
  return `${py}-${pm}-${pd}`;
}

/**
 * Calculates next calendar date in YYYY-MM-DD format using pure UTC math.
 */
export function getNextDateString(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  const ny = date.getUTCFullYear();
  const nm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(date.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * Finds a shift config by code or display name.
 */
export function getShiftByCodeOrName(
  identifier: string,
  configs: ShiftConfig[] = DEFAULT_SHIFT_CONFIGS
): ShiftConfig {
  const normalized = identifier.trim().toLowerCase();
  const match = configs.find(
    (c) =>
      c.code.toLowerCase() === normalized ||
      c.displayName.toLowerCase() === normalized ||
      c.name.toLowerCase() === normalized
  );
  if (match) return match;
  // Fallback to Shift A if unrecognized
  return configs[0];
}

/**
 * Deterministically finds the active rotational production shift for a given time.
 * Covers exact boundaries:
 * - 06:00:00 <= t < 14:00:00 -> Shift A
 * - 14:00:00 <= t < 22:00:00 -> Shift B
 * - 22:00:00 <= t < 24:00:00 or 00:00:00 <= t < 06:00:00 -> Shift C
 */
export function getActiveRotationalShift(
  currentTime: Date = new Date(),
  plantTimezone: string = DEFAULT_PLANT_TIMEZONE,
  configs: ShiftConfig[] = DEFAULT_SHIFT_CONFIGS
): ShiftConfig {
  const { secondsOfDay } = getTimeInTimezone(currentTime, plantTimezone);
  const rotationalShifts = configs.filter((c) => c.isRotationalProduction);

  for (const shift of rotationalShifts) {
    const startSec = timeStringToSeconds(shift.startTime);
    const endSec = timeStringToSeconds(shift.endTime);

    if (shift.crossesMidnight) {
      // e.g. 22:00:00 (79200) to 06:00:00 (21600)
      if (secondsOfDay >= startSec || secondsOfDay < endSec) {
        return shift;
      }
    } else {
      // Normal within-day shift e.g. 06:00:00 to 14:00:00
      if (secondsOfDay >= startSec && secondsOfDay < endSec) {
        return shift;
      }
    }
  }

  // Guaranteed fallback to first rotational shift
  return rotationalShifts[0] || configs[0];
}

/**
 * Determines the next scheduled shift in the rotation.
 */
export function getNextShift(
  currentShift: ShiftConfig,
  configs: ShiftConfig[] = DEFAULT_SHIFT_CONFIGS
): ShiftConfig {
  const rotational = configs.filter((c) => c.isRotationalProduction);
  const idx = rotational.findIndex((s) => s.code === currentShift.code);
  if (idx === -1) {
    return rotational[0];
  }
  return rotational[(idx + 1) % rotational.length];
}

/**
 * Computes production date for a given timestamp and shift.
 * Adheres strictly to the Night Shift date attribution rule:
 * - Shift C crossings: if post-midnight (00:00:00 to 05:59:59), attributes to the date the shift started (yesterday).
 * - If 22:00:00 to 23:59:59, attributes to current calendar date.
 */
export function getShiftProductionDate(
  currentTime: Date = new Date(),
  shiftCode?: string,
  plantTimezone: string = DEFAULT_PLANT_TIMEZONE,
  attributionRule: DateAttributionRule = 'start_date'
): string {
  const timeInfo = getTimeInTimezone(currentTime, plantTimezone);
  const shift = shiftCode
    ? getShiftByCodeOrName(shiftCode)
    : getActiveRotationalShift(currentTime, plantTimezone);

  if (shift.code === 'SHIFT_C' || shift.crossesMidnight) {
    if (attributionRule === 'start_date') {
      // After midnight (00:00:00 to 05:59:59): shift started yesterday at 22:00
      if (timeInfo.hours < 6) {
        return getPreviousDateString(timeInfo.dateString);
      }
      // Before midnight (22:00:00 to 23:59:59): shift started today
      return timeInfo.dateString;
    } else {
      // 'end_date' plant policy alternative
      if (timeInfo.hours >= 22) {
        return getNextDateString(timeInfo.dateString);
      }
      return timeInfo.dateString;
    }
  }

  // Shift A, Shift B, General Shift: current calendar date
  return timeInfo.dateString;
}

/**
 * Calculates precise time remaining until the active shift finishes.
 */
export function getShiftTimeRemaining(
  currentTime: Date = new Date(),
  shift: ShiftConfig,
  plantTimezone: string = DEFAULT_PLANT_TIMEZONE
): ShiftTimeRemaining {
  const { secondsOfDay } = getTimeInTimezone(currentTime, plantTimezone);
  const endSec = timeStringToSeconds(shift.endTime);

  let totalSecondsRemaining: number;

  if (shift.crossesMidnight) {
    // e.g. 22:00:00 to 06:00:00 (endSec = 21600)
    if (secondsOfDay >= timeStringToSeconds(shift.startTime)) {
      // Currently before midnight (e.g. 23:30:00)
      const secUntilMidnight = 86400 - secondsOfDay;
      totalSecondsRemaining = secUntilMidnight + endSec;
    } else {
      // Currently after midnight (e.g. 03:00:00)
      totalSecondsRemaining = Math.max(0, endSec - secondsOfDay);
    }
  } else {
    // Normal day shift (e.g. 06:00 to 14:00)
    totalSecondsRemaining = Math.max(0, endSec - secondsOfDay);
  }

  const hours = Math.floor(totalSecondsRemaining / 3600);
  const minutes = Math.floor((totalSecondsRemaining % 3600) / 60);
  const seconds = totalSecondsRemaining % 60;
  const totalMinutes = Math.floor(totalSecondsRemaining / 60);

  const formatted =
    hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;

  return {
    hours,
    minutes,
    seconds,
    totalMinutes,
    totalSeconds: totalSecondsRemaining,
    formatted,
  };
}

/**
 * Calculates elapsed time and completion percentage for the current shift.
 */
export function getShiftTimeElapsed(
  currentTime: Date = new Date(),
  shift: ShiftConfig,
  plantTimezone: string = DEFAULT_PLANT_TIMEZONE
): ShiftTimeElapsed {
  const { secondsOfDay } = getTimeInTimezone(currentTime, plantTimezone);
  const startSec = timeStringToSeconds(shift.startTime);
  const endSec = timeStringToSeconds(shift.endTime);

  let totalDurationSeconds: number;
  let elapsedSeconds: number;

  if (shift.crossesMidnight) {
    totalDurationSeconds = 86400 - startSec + endSec; // e.g. (86400 - 79200) + 21600 = 28800 (8h)
    if (secondsOfDay >= startSec) {
      elapsedSeconds = secondsOfDay - startSec;
    } else {
      elapsedSeconds = 86400 - startSec + secondsOfDay;
    }
  } else {
    totalDurationSeconds = endSec - startSec;
    elapsedSeconds = Math.max(0, Math.min(secondsOfDay - startSec, totalDurationSeconds));
  }

  const totalDurationMinutes = Math.floor(totalDurationSeconds / 60);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const percent = Math.min(
    100,
    Math.max(0, Math.round((elapsedSeconds / totalDurationSeconds) * 100))
  );

  return {
    elapsedMinutes,
    totalDurationMinutes,
    elapsedSeconds,
    totalDurationSeconds,
    percent,
  };
}

/**
 * Checks whether shift handoff / changeover is imminent (within thresholdMinutes, default 15m).
 */
export function isShiftChangeoverImminent(
  currentTime: Date = new Date(),
  shift?: ShiftConfig,
  thresholdMinutes: number = 15,
  plantTimezone: string = DEFAULT_PLANT_TIMEZONE
): boolean {
  const activeShift = shift || getActiveRotationalShift(currentTime, plantTimezone);
  const remaining = getShiftTimeRemaining(currentTime, activeShift, plantTimezone);
  return remaining.totalSeconds <= thresholdMinutes * 60;
}

/**
 * Comprehensive shift calculation snapshot.
 * Pure function suitable for server and client execution.
 */
export function getCurrentShift(
  currentTime: Date = new Date(),
  plantTimezone: string = DEFAULT_PLANT_TIMEZONE,
  configs: ShiftConfig[] = DEFAULT_SHIFT_CONFIGS
): ShiftInfo {
  const timeInfo = getTimeInTimezone(currentTime, plantTimezone);
  const shiftConfig = getActiveRotationalShift(currentTime, plantTimezone, configs);
  const productionDate = getShiftProductionDate(
    currentTime,
    shiftConfig.code,
    plantTimezone,
    shiftConfig.dateAttributionRule
  );
  const timeRemaining = getShiftTimeRemaining(currentTime, shiftConfig, plantTimezone);
  const timeElapsed = getShiftTimeElapsed(currentTime, shiftConfig, plantTimezone);
  const isTransitioning = isShiftChangeoverImminent(currentTime, shiftConfig, 15, plantTimezone);
  const nextShift = getNextShift(shiftConfig, configs);

  return {
    ...shiftConfig,
    productionDate,
    timeRemaining,
    timeElapsed,
    isTransitioning,
    nextShift,
    currentTimeString: timeInfo.timeString,
  };
}
