'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useScreenData } from '@/hooks/useScreenData';
import { resolveEvent } from '@/components/status';
import type { ScreenData } from '@/lib/types';

const WARNING_MINUTES = 30;

/** Reconstruct event end as a Date from startTime + endLabel ("HH:MM"). */
function getEndTime(event: ReturnType<typeof resolveEvent>): Date | null {
  if (!event?.endLabel || !event.isNow) return null;
  const [h, m] = event.endLabel.split(':').map(Number);
  const d = new Date(event.startTime);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Minutes remaining until endTime (negative when past). */
function minutesLeft(endTime: Date, now: Date): number {
  return Math.floor((endTime.getTime() - now.getTime()) / 60_000);
}

export function Clock({ initialData }: { initialData?: ScreenData }) {
  const { data } = useScreenData(initialData);
  const [now, setNow] = useState<Date | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  // Key identifying the warning so we only flash once per event-end
  const flashedForRef = useRef<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeEvent = useMemo(() => resolveEvent(data, now ?? undefined), [data, now]);
  const endTime = useMemo(() => getEndTime(activeEvent), [activeEvent]);

  const minsLeft = useMemo(
    () => (endTime && now ? minutesLeft(endTime, now) : null),
    [endTime, now],
  );

  const warningActive = minsLeft !== null && minsLeft >= 0 && minsLeft <= WARNING_MINUTES;

  // Trigger the full-screen flash once when the threshold is first crossed
  useEffect(() => {
    if (!warningActive || !activeEvent || !endTime) return;
    const key = `${activeEvent.title}:${endTime.getTime()}`;
    if (flashedForRef.current === key) return;
    flashedForRef.current = key;
    setShowFlash(true);
    const t = setTimeout(() => setShowFlash(false), 4000);
    return () => clearTimeout(t);
  }, [warningActive, activeEvent, endTime]);

  const timeStr = now
    ? now.toLocaleTimeString('nl-BE', { hour12: false, hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const dateStr = now
    ? now.toLocaleDateString('nl-BE', { weekday: 'short', month: 'short', day: 'numeric' })
    : '---';

  return (
    <>
      {/* Full-screen closing flash */}
      {showFlash && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none"
          style={{ animation: 'closing-flash 4s ease-in-out forwards' }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes closing-flash {
              0%   { background: rgba(239,68,68,0); }
              10%  { background: rgba(239,68,68,0.92); }
              75%  { background: rgba(239,68,68,0.88); }
              100% { background: rgba(239,68,68,0); }
            }
            @keyframes flash-text-in {
              0%   { opacity: 0; transform: scale(0.85); }
              15%  { opacity: 1; transform: scale(1.04); }
              25%  { transform: scale(1); }
              80%  { opacity: 1; }
              100% { opacity: 0; }
            }
          `}} />
          <div style={{ animation: 'flash-text-in 4s ease-in-out forwards' }} className="text-center px-8">
            <AlertTriangle className="w-24 h-24 text-white mx-auto mb-6 drop-shadow-lg" />
            <p className="text-white font-black uppercase tracking-widest text-5xl leading-tight drop-shadow-lg">
              {activeEvent?.title ?? 'Evenement'}
            </p>
            <p className="text-white font-black uppercase tracking-widest text-3xl mt-4 drop-shadow-lg opacity-90">
              Eindigt over {minsLeft} min — {endTime?.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      )}

      {/* Clock panel */}
      <div className="border-b-2 border-[#2C1E16] p-4 flex flex-col items-center justify-center bg-[#F5F2EB] h-48 shrink-0 relative">
        <div className="text-6xl font-black tracking-tighter text-[#2C1E16]">
          {timeStr}
        </div>
        <div className="text-[#2C1E16] mt-2 font-black uppercase tracking-widest text-sm text-center">
          {dateStr}
        </div>

        {/* Persistent small warning badge */}
        {warningActive && !showFlash && minsLeft !== null && endTime && (
          <div className="mt-2 flex items-center gap-1.5 bg-red-500 text-white px-2.5 py-1 border-2 border-[#2C1E16]">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="font-black uppercase text-[10px] tracking-widest leading-none">
              Sluit {minsLeft <= 1 ? 'nu' : `over ${minsLeft} min`} — {endTime.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
