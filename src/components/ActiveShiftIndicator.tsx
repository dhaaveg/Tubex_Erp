'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Sunset,
  Moon,
  Clock,
  AlertTriangle,
  ChevronDown,
  Calendar,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useCurrentShift } from '@/hooks/useCurrentShift';

export default function ActiveShiftIndicator() {
  const {
    currentShift,
    productionDate,
    timeRemaining,
    timeElapsed,
    timeElapsedPercent,
    isTransitioning,
    nextShift,
    currentTimeString,
    isMounted,
    plantTimezone,
  } = useCurrentShift();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!isMounted) {
    // Deterministic skeleton to guarantee zero hydration mismatch
    return (
      <div className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center space-x-2 animate-pulse">
        <div className="w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="w-20 h-3 bg-slate-300 dark:bg-slate-600 rounded" />
      </div>
    );
  }

  const getShiftIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sun':
        return <Sun className="w-3.5 h-3.5 text-amber-500" />;
      case 'Sunset':
        return <Sunset className="w-3.5 h-3.5 text-orange-500" />;
      case 'Moon':
        return <Moon className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  const getShiftStartTimeFormatted = (timeStr: string) => timeStr.slice(0, 5);
  const getShiftEndTimeFormatted = (timeStr: string) => timeStr.slice(0, 5);

  return (
    <div className="relative" ref={containerRef}>
      {/* Top Header Live Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Active Manufacturing Shift Status"
        title={`Active: ${currentShift.displayName} (${currentShift.startTime.slice(0, 5)} - ${currentShift.endTime.slice(0, 5)}). Production Date: ${productionDate}. Click for details.`}
        className={`group relative flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 cursor-pointer select-none shadow-sm ${
          isTransitioning
            ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/40 animate-pulse'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
        }`}
      >
        {/* Pulsing indicator beacon or Shift icon */}
        <div className="flex items-center space-x-1.5">
          {isTransitioning ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-bounce" />
          ) : (
            getShiftIcon(currentShift.theme.iconName)
          )}
          <span className="font-semibold">{currentShift.displayName}</span>
        </div>

        {/* Separator */}
        <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>

        {/* Shift Time Window or Warning */}
        {isTransitioning ? (
          <span className="text-amber-800 dark:text-amber-300 font-bold hidden md:inline">
            Handover: {timeRemaining.formatted} left
          </span>
        ) : (
          <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px] hidden sm:inline">
            {getShiftStartTimeFormatted(currentShift.startTime)} -{' '}
            {getShiftEndTimeFormatted(currentShift.endTime)}
          </span>
        )}

        {/* Progress pill indicator */}
        <div className="hidden lg:flex items-center space-x-1.5 pl-1">
          <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isTransitioning ? 'bg-amber-500' : 'bg-[#4F46E5] dark:bg-indigo-400'
              }`}
              style={{ width: `${timeElapsedPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            {timeRemaining.formatted}
          </span>
        </div>

        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-4 transition-all duration-150 animate-in fade-in slide-in-from-top-2">
          {/* Card Header */}
          <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                  isTransitioning
                    ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700 text-amber-600 dark:text-amber-300'
                    : 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/60 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {getShiftIcon(currentShift.theme.iconName)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <span>{currentShift.displayName}</span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    ({currentShift.name})
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                  <span>Live Manufacturing Rotation</span>
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {plantTimezone}
            </span>
          </div>

          {/* Warning Banner if Transitioning */}
          {isTransitioning && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <span className="font-semibold">Shift Changeover Imminent:</span> Complete all
                pending work order postings and hand over scrap/inspection tallies. Handoff in{' '}
                <span className="font-bold">{timeRemaining.formatted}</span>.
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2.5 mt-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Production Date</span>
              </span>
              <div className="font-mono font-bold text-slate-900 dark:text-white mt-1">
                {productionDate}
              </div>
              {currentShift.crossesMidnight && (
                <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">
                  Cross-midnight start date
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Shift Window</span>
              </span>
              <div className="font-mono font-semibold text-slate-900 dark:text-white mt-1">
                {currentShift.startTime} - {currentShift.endTime}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Current Time: {currentTimeString}
              </div>
            </div>
          </div>

          {/* Shift Elapsed Progress */}
          <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Shift Progress</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {timeElapsedPercent}% ({timeElapsed.elapsedMinutes}m /{' '}
                {timeElapsed.totalDurationMinutes}m)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isTransitioning
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                }`}
                style={{ width: `${timeElapsedPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
              <span>Remaining: {timeRemaining.formatted}</span>
              <span>Total: {Math.round(timeElapsed.totalDurationMinutes / 60)} Hours</span>
            </div>
          </div>

          {/* Next Shift Preview */}
          <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-600 dark:text-slate-400">Next Rotation:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {nextShift.displayName}
              </span>
            </div>
            <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px] flex items-center space-x-1">
              <ArrowRight className="w-3 h-3 inline" />
              <span>{nextShift.startTime.slice(0, 5)}</span>
            </span>
          </div>

          {/* Footer Note */}
          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center space-x-1">
              <Info className="w-3 h-3 text-slate-400" />
              <span>Auto-populates Work Orders & Goods Receipts</span>
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
