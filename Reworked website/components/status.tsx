'use client';

import { useState, useEffect } from 'react';
import { useScreenData } from '@/hooks/useScreenData';

// Dutch months map for parsing
const DUTCH_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, maa: 2, mrt: 2, apr: 3, mei: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dec: 11,
};

// Parse 'do 26 feb' to Date (using current year)
function parseDateFromDutchString(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = dateStr.toLowerCase().match(/\w+\s+(\d+)\s+(\w+)/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const monthStr = match[2].substring(0, 3);
  const month = DUTCH_MONTHS[monthStr];
  if (month === undefined) return null;

  const now = new Date();
  let year = now.getFullYear();
  const date = new Date(year, month, day);

  // If date is more than 2 months in past, assume next year
  if (date < new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)) {
    date.setFullYear(year + 1);
  }
  return date;
}

export function Status() {
  const { data } = useScreenData();
  const [currentEvent, setCurrentEvent] = useState<any>(null);

  useEffect(() => {
    if (!data) return;

    // Combine events that have a time component
    const allEvents = [...data.workshops, ...data.recurringEvents].filter(e => e.time && e.date);
    const now = new Date();

    let activeEvent = null;

    for (const event of allEvents) {
      // time might look like "14:00-16:00" or "14.00-16.00u" or "18:00"
      const timeMatch = event.time.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
      let startTimeStr, endTimeStr;

      if (timeMatch) {
        // Has range
        startTimeStr = `${timeMatch[1]}:${timeMatch[2]}`;
        endTimeStr = `${timeMatch[3]}:${timeMatch[4]}`;
      } else {
        const singleTime = event.time.match(/(\d{1,2})[:.](\d{2})/);
        if (singleTime) {
          startTimeStr = `${singleTime[1]}:${singleTime[2]}`;
          // Assuming 2 hour duration if no end time given
          let endHour = parseInt(singleTime[1]) + 2;
          endTimeStr = `${endHour.toString().padStart(2, '0')}:${singleTime[2]}`;
        } else {
          continue; // cannot parse time
        }
      }

      const eventDate = parseDateFromDutchString(event.date);
      if (!eventDate) continue;

      // Create start and end Date objects
      const [startHour, startMin] = startTimeStr.split(':').map(Number);
      const [endHour, endMin] = endTimeStr.split(':').map(Number);

      const startTime = new Date(eventDate);
      startTime.setHours(startHour, startMin, 0, 0);

      const endTime = new Date(eventDate);
      endTime.setHours(endHour, endMin, 0, 0);

      // Check if event is currently happening or starting within next hour
      const oneHourBefore = new Date(startTime.getTime() - 60 * 60 * 1000);

      if (now >= oneHourBefore && now <= endTime) {
        activeEvent = {
          title: event.title.split(':')[0].trim(), // Only the main title
          displayTime: event.time,
          isStartingSoon: now < startTime,
        };
        break; // Found the active event, no need to check others
      }
    }

    setTimeout(() => {
      setCurrentEvent(activeEvent);
    }, 0);
  }, [data]);

  // If no event is currently happening, show nothing to keep clean UI
  if (!currentEvent) {
    return (
      <div className="p-4 bg-[#F5F2EB] flex-1 flex flex-col justify-center min-h-0">
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#F5F2EB] flex-1 flex flex-col justify-center min-h-0">
      <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black mb-3 shrink-0">
        {currentEvent.isStartingSoon ? 'Starting Soon' : 'Current Event'}
      </h2>
      <div className="flex items-center gap-2 text-[#2C1E16] mb-4 border-2 border-[#2C1E16] p-3 shrink-0"
        style={{ backgroundColor: currentEvent.isStartingSoon ? '#FEF08A' : '#86EFAC' }}>
        <div className={`w-3 h-3 bg-[#2C1E16] shrink-0 ${!currentEvent.isStartingSoon ? 'animate-pulse' : ''}`} />
        <span className="font-black text-base uppercase tracking-tight break-all title-hyphenation">
          {currentEvent.title}
        </span>
      </div>
      <div className="mt-auto shrink-0">
        <p className="text-[#2C1E16] text-[10px] uppercase tracking-widest font-black mb-1">Time</p>
        <p className="text-[#2C1E16] font-black text-sm uppercase leading-tight">
          {currentEvent.displayTime}
        </p>
      </div>
    </div>
  );
}
