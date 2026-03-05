'use client';

import { useState, useEffect } from 'react';
import { useScreenData } from '@/hooks/useScreenData';

type NextEvent = {
  title: string;
  displayDate: string;
  displayTime: string;
  isNow: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  startTime: Date;
};

export function Status() {
  const { data } = useScreenData();
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);

  useEffect(() => {
    if (!data) return;

    // Combine all events that have a dateISO and a time
    const allEvents = [...data.workshops, ...data.recurringEvents].filter(
      (e) => e.dateISO && e.time,
    );

    const now = new Date();
    let happeningNow: NextEvent | null = null;
    let soonest: NextEvent | null = null;

    for (const event of allEvents) {
      // Parse start time from the time string (e.g. "19:00-22:00" or "9:30")
      const startMatch = event.time.match(/(\d{1,2})[:.](\d{2})/);
      if (!startMatch) continue;

      const startHour = parseInt(startMatch[1], 10);
      const startMin = parseInt(startMatch[2], 10);

      // Parse end time from "HH:MM-HH:MM" or "HH:MM–HH:MM" format
      const endMatch = event.time.match(/[-–](\d{1,2})[:.](\d{2})/);
      const endHour = endMatch ? parseInt(endMatch[1], 10) : null;
      const endMin = endMatch ? parseInt(endMatch[2], 10) : null;

      // Build reliable Dates from dateISO ("2026-03-04") + parsed times
      // Split manually to avoid timezone shifts from `new Date("2026-03-04")`
      const [isoYear, isoMonth, isoDay] = event.dateISO.split('-').map(Number);
      const startTime = new Date(isoYear, isoMonth - 1, isoDay, startHour, startMin, 0, 0);
      const endTime =
        endHour !== null && endMin !== null
          ? new Date(isoYear, isoMonth - 1, isoDay, endHour, endMin, 0, 0)
          : null;

      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
      const dayAfterMidnight = new Date(todayMidnight.getTime() + 48 * 60 * 60 * 1000);

      // Check if the event is currently in progress
      // Use a 5-min grace window on the end so "just finished" events still show briefly
      const effectiveEnd = endTime
        ? new Date(endTime.getTime() + 5 * 60 * 1000)
        : new Date(startTime.getTime() + 60 * 60 * 1000); // fallback: assume 1h duration
      const isInProgress = startTime <= now && now < effectiveEnd;

      if (isInProgress && !happeningNow) {
        happeningNow = {
          title: event.title,
          displayDate: event.date ?? event.dateISO,
          displayTime: event.time,
          isNow: true,
          isToday: true,
          isTomorrow: false,
          startTime,
        };
        continue;
      }

      // Only consider upcoming events (5-min grace window so near-future shows up)
      if (startTime < new Date(now.getTime() - 5 * 60 * 1000)) continue;

      if (!soonest || startTime < soonest.startTime) {
        soonest = {
          title: event.title,
          displayDate: event.date ?? event.dateISO,
          displayTime: event.time,
          isNow: false,
          isToday: startTime >= todayMidnight && startTime < tomorrowMidnight,
          isTomorrow: startTime >= tomorrowMidnight && startTime < dayAfterMidnight,
          startTime,
        };
      }
    }

    // In-progress event takes priority over upcoming
    setNextEvent(happeningNow ?? soonest);
  }, [data]);

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
      <div className="mt-auto shrink-0">
        <p className="text-[#2C1E16] text-[10px] uppercase tracking-widest font-black mb-1">Tijd</p>
        <p className="text-[#2C1E16] font-black text-sm uppercase leading-tight">
          {nextEvent.displayTime}
        </p>
      </div>
    </div>
  );
}
