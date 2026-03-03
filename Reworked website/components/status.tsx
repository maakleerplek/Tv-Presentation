'use client';

import { useState, useEffect } from 'react';
import { useScreenData } from '@/hooks/useScreenData';

type NextEvent = {
  title: string;
  displayDate: string;
  displayTime: string;
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
    let soonest: NextEvent | null = null;

    for (const event of allEvents) {
      // Parse start time from the time string (e.g. "19:00-22:00" or "9:30")
      const timeMatch = event.time.match(/(\d{1,2})[:.](\d{2})/);
      if (!timeMatch) continue;

      const startHour = parseInt(timeMatch[1], 10);
      const startMin = parseInt(timeMatch[2], 10);

      // Build a reliable Date from dateISO ("2026-03-04") + parsed time
      // Split manually to avoid timezone shifts from `new Date("2026-03-04")`
      const [isoYear, isoMonth, isoDay] = event.dateISO.split('-').map(Number);
      const startTime = new Date(isoYear, isoMonth - 1, isoDay, startHour, startMin, 0, 0);

      // Only consider events that haven't started yet (5 min grace window)
      if (startTime < new Date(now.getTime() - 5 * 60 * 1000)) continue;

      if (!soonest || startTime < soonest.startTime) {
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
        const dayAfterMidnight = new Date(todayMidnight.getTime() + 48 * 60 * 60 * 1000);

        soonest = {
          title: event.title,
          // Use the Dutch date string from the API directly for display
          displayDate: event.date ?? event.dateISO,
          displayTime: event.time,
          isToday: startTime >= todayMidnight && startTime < tomorrowMidnight,
          isTomorrow: startTime >= tomorrowMidnight && startTime < dayAfterMidnight,
          startTime,
        };
      }
    }

    setNextEvent(soonest);
  }, [data]);

  if (!nextEvent) {
    return (
      <div className="p-4 bg-[#F5F2EB] flex-1 flex flex-col justify-center min-h-0">
        <div className="flex-1" />
      </div>
    );
  }

  const whenLabel = nextEvent.isToday
    ? 'Vandaag'
    : nextEvent.isTomorrow
      ? 'Morgen'
      : nextEvent.displayDate;

  return (
    <div className="p-4 bg-[#F5F2EB] flex-1 flex flex-col justify-start min-h-0 gap-3">
      <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black shrink-0">
        Volgend evenement
      </h2>

      {/* When badge */}
      <div className="inline-flex items-center gap-2 border-2 border-[#2C1E16] px-3 py-1 shrink-0 self-start"
        style={{ backgroundColor: nextEvent.isToday ? '#FEF08A' : '#F5F2EB' }}>
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
