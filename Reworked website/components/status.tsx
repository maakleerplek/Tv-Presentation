'use client';

import { useState, useEffect, useCallback } from 'react';
import { useScreenData } from '@/hooks/useScreenData';

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

/** Return the priority index of an event title given the ordered keyword list (lower = higher priority).
 *  Returns Infinity if no keyword matches. */
export function priorityOf(title: string, keywords: string[]): number {
  const lower = title.toLowerCase();
  for (let i = 0; i < keywords.length; i++) {
    if (lower.includes(keywords[i])) return i;
  }
  return Infinity;
}

/** Parse "HH:MM" or "HH.MM" from a string, returns { h, m } or null. */
export function parseTime(str: string, pattern: RegExp): { h: number; m: number } | null {
  const m = str.match(pattern);
  if (!m) return null;
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}

/** Derive the best event to display from the current data + current time. */
export function resolveEvent(
  data: ReturnType<typeof useScreenData>['data'],
): NextEvent | null {
  if (!data) return null;

  const priorityKeywords: string[] = data.config?.eventPriority ?? [];

  // Combine workshops + recurringEvents; both have dateISO
  const allEvents = [...data.workshops, ...data.recurringEvents].filter(
    (e) => e.dateISO,
  );

  const now = new Date();
  const todayMidnight    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterMidnight = new Date(todayMidnight.getTime() + 48 * 60 * 60 * 1000);

  console.log('[Status] resolveEvent — allEvents:', allEvents.map(e => ({ title: e.title, dateISO: e.dateISO, time: e.time, type: e.type })));
  console.log('[Status] priorityKeywords:', priorityKeywords);

  // Candidates split into "happening now" and "upcoming"
  const nowCandidates: (NextEvent & { priority: number })[] = [];
  const upcomingCandidates: (NextEvent & { priority: number })[] = [];

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

    const effectiveEnd = endTime
      ? new Date(endTime.getTime() + 5 * 60 * 1000)
      : new Date(startTime.getTime() + 60 * 60 * 1000);

    const isInProgress = startTime <= now && now < effectiveEnd;

    // Format display labels
    const startLabel = startParsed
      ? `${String(startParsed.h).padStart(2, '0')}:${String(startParsed.m).padStart(2, '0')}`
      : '';
    const endLabel = endParsed
      ? `${String(endParsed.h).padStart(2, '0')}:${String(endParsed.m).padStart(2, '0')}`
      : '';

    const candidate = {
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
    };

    if (isInProgress) {
      console.log(`[Status] NOW candidate: "${event.title}" priority=${priorityOf(event.title, priorityKeywords)} startTime=${startTime.toISOString()} endTime=${effectiveEnd.toISOString()}`);
      nowCandidates.push(candidate);
      continue;
    }

    // Skip events fully in the past (with a 5-min grace window)
    if (effectiveEnd < new Date(now.getTime() - 5 * 60 * 1000)) continue;

    console.log(`[Status] UPCOMING candidate: "${event.title}" priority=${priorityOf(event.title, priorityKeywords)} startTime=${startTime.toISOString()}`);
    upcomingCandidates.push(candidate);
  }

  /** Pick the best candidate: lowest priority index wins; ties broken by startTime (most recent / soonest). */
  function pickBest<T extends { priority: number; startTime: Date }>(
    candidates: T[],
    tieBreak: 'mostRecent' | 'soonest',
  ): T | null {
    if (candidates.length === 0) return null;
    return candidates.reduce((best, c) => {
      if (c.priority < best.priority) return c;
      if (c.priority > best.priority) return best;
      // Same priority — apply tieBreak
      if (tieBreak === 'mostRecent') return c.startTime > best.startTime ? c : best;
      return c.startTime < best.startTime ? c : best;
    });
  }

  // In-progress events: highest priority wins; tie → most recently started
  const bestNow = pickBest(nowCandidates, 'mostRecent');
  console.log('[Status] bestNow:', bestNow ? `"${bestNow.title}" priority=${bestNow.priority}` : 'null');
  if (bestNow) return bestNow;

  // Upcoming events: highest priority wins; tie → soonest start
  const bestUpcoming = pickBest(upcomingCandidates, 'soonest');
  console.log('[Status] bestUpcoming:', bestUpcoming ? `"${bestUpcoming.title}" priority=${bestUpcoming.priority}` : 'null');
  return bestUpcoming;
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
