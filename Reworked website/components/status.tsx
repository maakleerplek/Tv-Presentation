'use client';

import { useState, useEffect, useCallback } from 'react';
import { useScreenData } from '@/hooks/useScreenData';
import { priorityOf } from '@/lib/utils';
import type { ScreenData } from '@/hooks/useScreenData';

// Re-export so existing tests (status.test.ts) keep passing
export { priorityOf };

type NextEvent = {
  title: string;
  displayDate: string;
  time: string;         // raw "HH:MM-HH:MM" or "" — used to derive display strings
  startLabel: string;   // e.g. "19:00"
  endLabel: string;     // e.g. "22:00"  (empty if unknown)
  isNow: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  startTime: Date;
};

/** Parse "HH:MM" or "HH.MM" from a string, returns { h, m } or null. */
export function parseTime(str: string, pattern: RegExp): { h: number; m: number } | null {
  const m = str.match(pattern);
  if (!m) return null;
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}

/** Derive the best event to display from the current data + current time. */
export function resolveEvent(
  data: ScreenData | null,
  nowOverride?: Date,
): NextEvent | null {
  if (!data) return null;

  const now = nowOverride ?? new Date();
  const priorityKeywords: string[] = data.config?.eventPriority ?? [];

  // Combine workshops + recurringEvents; both have dateISO
  const allEvents = [...data.workshops, ...data.recurringEvents].filter(
    (e) => e.dateISO,
  );

  const todayMidnight    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterMidnight = new Date(todayMidnight.getTime() + 48 * 60 * 60 * 1000);

  const candidates: (NextEvent & { priority: number })[] = [];

  for (const event of allEvents) {
    const parts = event.dateISO.split('-').map(Number);
    if (parts.length !== 3) continue;
    const [isoYear, isoMonth, isoDay] = parts;

    const startParsed = parseTime(event.time ?? '', /(\d{1,2})[:.](\d{2})/);
    const endParsed   = parseTime(event.time ?? '', /[-–](\d{1,2})[:.](\d{2})/);

    const startHour = startParsed?.h ?? 0;
    const startMin  = startParsed?.m ?? 0;
    const startTime = new Date(isoYear, isoMonth - 1, isoDay, startHour, startMin, 0, 0);

    const endTime = endParsed
      ? new Date(isoYear, isoMonth - 1, isoDay, endParsed.h, endParsed.m, 0, 0)
      : null;

    // Logic for effective end:
    // 1. Explicit end time + 5 min grace
    // 2. No end time but explicit start time: 1 hour duration
    // 3. No time at all (all-day): end of the calendar day
    const effectiveEnd = endTime
      ? new Date(endTime.getTime() + 5 * 60 * 1000)
      : startParsed
        ? new Date(startTime.getTime() + 60 * 60 * 1000)
        : new Date(isoYear, isoMonth - 1, isoDay, 23, 59, 59, 999);

    const isInProgress = startTime <= now && now < effectiveEnd;

    // Skip events fully in the past (with a 5-min grace window)
    if (!isInProgress && effectiveEnd < new Date(now.getTime() - 5 * 60 * 1000)) continue;

    // Format display labels
    const startLabel = startParsed
      ? `${String(startParsed.h).padStart(2, '0')}:${String(startParsed.m).padStart(2, '0')}`
      : '';
    const endLabel = endParsed
      ? `${String(endParsed.h).padStart(2, '0')}:${String(endParsed.m).padStart(2, '0')}`
      : '';

    candidates.push({
      title:       event.title,
      displayDate: event.date ?? event.dateISO,
      time:        event.time ?? '',
      startLabel,
      endLabel,
      isNow:      isInProgress,
      isToday:    startTime >= todayMidnight    && startTime < tomorrowMidnight,
      isTomorrow: startTime >= tomorrowMidnight && startTime < dayAfterMidnight,
      startTime,
      priority:   priorityOf(event.title, priorityKeywords),
    });
  }

  if (candidates.length === 0) return null;

  // Final selection logic:
  // 1. Closest day wins (Today < Tomorrow < Next Week)
  // 2. Highest priority wins on the same day (index 0 < 1 < ... < Infinity)
  // 3. Current events win over upcoming events of SAME priority on the same day
  // 4. Tie-break: if both Now, most recent wins. If both Upcoming, soonest wins.
  return candidates.reduce((best, c) => {
    // a. Compare Day (YYYY-MM-DD)
    const cScore = c.startTime.getFullYear() * 10000 + (c.startTime.getMonth() + 1) * 100 + c.startTime.getDate();
    const bScore = best.startTime.getFullYear() * 10000 + (best.startTime.getMonth() + 1) * 100 + best.startTime.getDate();

    if (cScore < bScore) return c;
    if (cScore > bScore) return best;

    // b. Same day: Compare Priority
    if (c.priority < best.priority) return c;
    if (c.priority > best.priority) return best;

    // c. Same priority: prefer Now over Upcoming
    if (c.isNow && !best.isNow) return c;
    if (!c.isNow && best.isNow) return best;

    // d. Tie-break by startTime
    if (c.isNow) {
      // For simultaneous active events, prefer the one that started more recently
      return c.startTime > best.startTime ? c : best;
    } else {
      // For future events, prefer the one starting soonest
      return c.startTime < best.startTime ? c : best;
    }
  });
}

export function Status() {
  const { data } = useScreenData();
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);

  const reEvaluate = useCallback(() => {
    setNextEvent(resolveEvent(data));
  }, [data]);

  useEffect(() => {
    reEvaluate();
    // Tick every 30 seconds so transitions (upcoming → now, now → done) are prompt
    const tick = setInterval(reEvaluate, 30 * 1000);
    return () => clearInterval(tick);
  }, [reEvaluate]);

  if (!nextEvent) {
    return (
      <div className="p-4 bg-[#F5F2EB] flex-1 flex flex-col justify-center min-h-0">
        <div className="flex-1" />
      </div>
    );
  }

  const whenLabel = nextEvent.isNow
    ? 'Nu bezig'
    : nextEvent.isToday
      ? 'Vandaag'
      : nextEvent.isTomorrow
        ? 'Morgen'
        : nextEvent.displayDate;

  const badgeColor = nextEvent.isNow ? '#FCA5A5' : nextEvent.isToday ? '#FEF08A' : '#F5F2EB';

  // Time line:
  //   Happening now  → "Bezig tot 22:00"  (or "Bezig" if no end known)
  //   Upcoming       → "19:00 – 22:00"    (or just "19:00" if no end)
  //   No time at all → nothing shown
  const timeDisplay = (() => {
    if (!nextEvent.startLabel && !nextEvent.endLabel) return null;
    if (nextEvent.isNow) {
      return nextEvent.endLabel ? `Bezig tot ${nextEvent.endLabel}` : 'Bezig';
    }
    if (nextEvent.startLabel && nextEvent.endLabel) return `${nextEvent.startLabel} – ${nextEvent.endLabel}`;
    return nextEvent.startLabel || nextEvent.endLabel;
  })();

  return (
    <div className="p-4 bg-[#F5F2EB] flex-1 flex flex-col justify-start min-h-0 gap-3">
      <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black shrink-0">
        {nextEvent.isNow ? 'Nu bezig' : 'Volgend evenement'}
      </h2>

      {/* When badge */}
      <div
        className="inline-flex items-center gap-2 border-2 border-[#2C1E16] px-3 py-1 shrink-0 self-start"
        style={{ backgroundColor: badgeColor }}
      >
        <span className="text-[#2C1E16] font-black text-xs uppercase tracking-widest">
          {whenLabel}
        </span>
      </div>

      {/* Title */}
      <p className="text-[#2C1E16] font-black text-sm uppercase leading-snug shrink-0">
        {nextEvent.title}
      </p>

      {/* Time */}
      {timeDisplay && (
        <div className="mt-auto shrink-0">
          <p className="text-[#2C1E16] text-[10px] uppercase tracking-widest font-black mb-1">
            {nextEvent.isNow ? 'Eindigt' : 'Tijd'}
          </p>
          <p className="text-[#2C1E16] font-black text-lg uppercase leading-tight">
            {timeDisplay}
          </p>
        </div>
      )}
    </div>
  );
}
