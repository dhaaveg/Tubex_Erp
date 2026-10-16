'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCurrentShift,
  ShiftInfo,
  DEFAULT_PLANT_TIMEZONE,
  DEFAULT_SHIFT_CONFIGS,
  ShiftConfig,
} from '@/utils/shiftUtils';

export interface UseCurrentShiftOptions {
  plantTimezone?: string;
  configs?: ShiftConfig[];
  changeoverThresholdMinutes?: number;
  onShiftChange?: (newShift: ShiftInfo, previousShift: ShiftInfo | null) => void;
}

export interface UseCurrentShiftResult {
  currentShift: ShiftInfo;
  productionDate: string;
  timeRemaining: ShiftInfo['timeRemaining'];
  timeElapsed: ShiftInfo['timeElapsed'];
  timeElapsedPercent: number;
  isTransitioning: boolean;
  nextShift: ShiftConfig;
  currentTimeString: string;
  isMounted: boolean;
  plantTimezone: string;
  refresh: () => void;
}

export function useCurrentShift(options: UseCurrentShiftOptions = {}): UseCurrentShiftResult {
  const {
    plantTimezone = DEFAULT_PLANT_TIMEZONE,
    configs = DEFAULT_SHIFT_CONFIGS,
    onShiftChange,
  } = options;

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [shiftState, setShiftState] = useState<ShiftInfo>(() =>
    getCurrentShift(new Date(), plantTimezone, configs)
  );

  const prevShiftRef = useRef<ShiftInfo | null>(null);
  const onShiftChangeRef = useRef(onShiftChange);
  onShiftChangeRef.current = onShiftChange;

  const updateShift = useCallback(() => {
    const now = new Date();
    const updated = getCurrentShift(now, plantTimezone, configs);

    setShiftState((prev) => {
      // Detect shift rollover
      if (prev && prev.code !== updated.code) {
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('tubex:shift-change', {
            detail: {
              previousShift: prev,
              newShift: updated,
              productionDate: updated.productionDate,
            },
          });
          window.dispatchEvent(event);
        }

        if (onShiftChangeRef.current) {
          onShiftChangeRef.current(updated, prev);
        }
      }
      return updated;
    });

    prevShiftRef.current = updated;
    return updated;
  }, [plantTimezone, configs]);

  useEffect(() => {
    setIsMounted(true);
    // Initial sync on client mount to ensure client clock alignment
    const initial = updateShift();
    prevShiftRef.current = initial;

    let timerId: NodeJS.Timeout | null = null;

    // Self-correcting scheduler aligned to the clock second boundary
    const scheduleNextTick = () => {
      const now = new Date();
      const currentSeconds = now.getSeconds();
      const currentMs = now.getMilliseconds();

      // If in imminent changeover (last 15m), update every 5 seconds for responsive countdown.
      // Otherwise, sync to the start of the next minute (60s boundary).
      const isImminent = prevShiftRef.current?.isTransitioning ?? false;

      let delayMs: number;
      if (isImminent) {
        // Ticks every 5 seconds aligned to modulo 5
        const remSecInBlock = 5 - (currentSeconds % 5);
        delayMs = remSecInBlock * 1000 - currentMs;
        if (delayMs <= 50) delayMs += 5000;
      } else {
        // Ticks at the top of the next minute
        delayMs = (60 - currentSeconds) * 1000 - currentMs;
        if (delayMs <= 100) delayMs += 60000;
      }

      timerId = setTimeout(() => {
        updateShift();
        scheduleNextTick();
      }, delayMs);
    };

    scheduleNextTick();

    // Tab sleep & visibility change recovery
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateShift();
        if (timerId) clearTimeout(timerId);
        scheduleNextTick();
      }
    };

    const handleWindowFocus = () => {
      updateShift();
      if (timerId) clearTimeout(timerId);
      scheduleNextTick();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [updateShift]);

  return {
    currentShift: shiftState,
    productionDate: shiftState.productionDate,
    timeRemaining: shiftState.timeRemaining,
    timeElapsed: shiftState.timeElapsed,
    timeElapsedPercent: shiftState.timeElapsed.percent,
    isTransitioning: shiftState.isTransitioning,
    nextShift: shiftState.nextShift,
    currentTimeString: shiftState.currentTimeString,
    isMounted,
    plantTimezone,
    refresh: updateShift,
  };
}
