'use client';

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { useScreenData } from '@/hooks/useScreenData';
import { priorityOf } from '@/lib/utils';
import type { ScreenData } from '@/lib/types';

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
  price?: string;
  link?: string;
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
    // 1. Explicit end time
    // 2. No end time but explicit start time: 1 hour duration
    // 3. No time at all (all-day): end of the calendar day
    const effectiveEnd = endTime
      ? endTime
      : startParsed
        ? new Date(startTime.getTime() + 60 * 60 * 1000)
        : new Date(isoYear, isoMonth - 1, isoDay, 23, 59, 59, 999);

    const isInProgress = startTime <= now && now < effectiveEnd;
    const isPast = effectiveEnd <= now;

    // Skip events that have already ended
    if (isPast) continue;

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
      price:      event.price,
      link:       event.link,
      priority:   priorityOf(event.title, priorityKeywords),
    });
  }

  if (candidates.length === 0) return null;

  // Final selection logic:
  // 1. Highest keyword priority wins (Keyword index 0 < 1 < ... < Infinity)
  // 2. Among same priority: Current events (isNow) win over upcoming ones.
  // 3. Among same priority and status: Closest day wins.
  // 4. Tie-break: soonest start time wins.
  return candidates.reduce((best, c) => {
    // a. Compare Priority first (Absolute rule)
    if (c.priority < best.priority) return c;
    if (c.priority > best.priority) return best;

    // b. Same priority: prefer Now over Upcoming
    if (c.isNow && !best.isNow) return c;
    if (!c.isNow && best.isNow) return best;

    // c. Same priority & status: Compare Day (YYYY-MM-DD)
    const cScore = c.startTime.getFullYear() * 10000 + (c.startTime.getMonth() + 1) * 100 + c.startTime.getDate();
    const bScore = best.startTime.getFullYear() * 10000 + (best.startTime.getMonth() + 1) * 100 + best.startTime.getDate();

    if (cScore < bScore) return c;
    if (cScore > bScore) return best;

    // d. Tie-break by startTime
    return c.startTime < best.startTime ? c : best;
  });
}

/** Specific helper to only resolve the next upcoming workshop. */
export function resolveNextWorkshop(data: ScreenData | null, nowOverride?: Date): NextEvent | null {
  if (!data) return null;
  // Create a subset that only includes workshops
  const workshopOnlyData = { ...data, recurringEvents: [] };
  return resolveEvent(workshopOnlyData, nowOverride);
}

export function Status({ initialData }: { initialData?: ScreenData }) {
  const { data } = useScreenData(initialData);
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);
  const [nextWorkshop, setNextWorkshop] = useState<NextEvent | null>(null);
  const [showWorkshop, setShowWorkshop] = useState(false);

  const reEvaluate = useCallback(() => {
    setNextEvent(resolveEvent(data));
    setNextWorkshop(resolveNextWorkshop(data));
  }, [data]);

  useEffect(() => {
    reEvaluate();
    const tick = setInterval(reEvaluate, 30 * 1000);
    return () => clearInterval(tick);
  }, [reEvaluate]);

  // Rotation logic: if we have both and they are different, swap based on config.
  useEffect(() => {
    if (!nextEvent || !nextWorkshop || nextEvent.title === nextWorkshop.title) {
      setShowWorkshop(false);
      return;
    }

    const intervalSeconds = data?.config?.statusRotationTime ?? 10;
    const rotation = setInterval(() => {
      setShowWorkshop((prev) => !prev);
    }, intervalSeconds * 1000);

    return () => clearInterval(rotation);
  }, [nextEvent, nextWorkshop, data?.config?.statusRotationTime]);

  const active = showWorkshop ? nextWorkshop : nextEvent;

  if (!active) {
    return (
      <div className="p-4 bg-[#F5F2EB] flex-1 flex flex-col justify-center min-h-0">
        <div className="flex-1" />
      </div>
    );
  }

  const whenLabel = active.isNow
    ? 'Nu bezig'
    : active.isToday
      ? 'Vandaag'
      : active.isTomorrow
        ? 'Morgen'
        : active.displayDate;

  const badgeColor = active.isNow ? '#FCA5A5' : active.isToday ? '#FEF08A' : '#F5F2EB';

  const timeDisplay = (() => {
    if (!active.startLabel && !active.endLabel) return null;
    if (active.isNow) {
      return active.endLabel ? `Bezig tot ${active.endLabel}` : 'Bezig';
    }
    if (active.startLabel && active.endLabel) return `${active.startLabel} – ${active.endLabel}`;
    return active.startLabel || active.endLabel;
  })();

  return (
    <div className="bg-[#F5F2EB] flex-1 relative overflow-hidden">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes status-fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-status-fade-in {
            animation: status-fade-in 0.5s ease-out;
          }
        `}} />
        <div
          key={showWorkshop ? 'workshop' : 'status'}
          className="absolute inset-0 p-4 flex flex-col justify-start min-h-0 gap-3 animate-status-fade-in"
        >
          <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black shrink-0">
            {showWorkshop ? 'Volgende Workshop' : active.isNow ? 'Nu bezig' : 'Volgend evenement'}
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
            {active.title}
          </p>

          {/* Extra: Price for workshops */}
          {showWorkshop && active.price && (
            <p className="text-[#2C1E16] font-black text-xs uppercase tracking-widest opacity-60">
              Prijs: {active.price}
            </p>
          )}

          {/* Time and optional QR code */}
          <div className="mt-auto flex items-end justify-between gap-4">
            {timeDisplay && (
              <div className="shrink-0">
                <p className="text-[#2C1E16] text-[10px] uppercase tracking-widest font-black mb-1">
                  {active.isNow ? 'Eindigt' : 'Tijd'}
                </p>
                <p className="text-[#2C1E16] font-black text-lg uppercase leading-tight">
                  {timeDisplay}
                </p>
              </div>
            )}

            {showWorkshop && active.link && (
              <div className="border-2 border-[#2C1E16] p-1 bg-[#F5F2EB] shrink-0">
                <QRCode value={active.link} size={40} bgColor="#F5F2EB" fgColor="#2C1E16" />
              </div>
            )}
          </div>
        </div>
    </div>
  );
}



