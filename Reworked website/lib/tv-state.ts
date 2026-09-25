/**
 * Which inventory page the TV shows. The state lives in the TV's browser; the
 * Pi scanner next to it drives it with key presses (see hooks/useTvPage.ts).
 *
 * The state never needs the page count: the page number keeps growing and the
 * TV takes it modulo its own page count. While cycling, the page is derived
 * from the clock (basePage + whole cycles since baseAt), so nothing has to
 * tick. Every event that stops or moves the
 * cycling first folds the elapsed cycles into basePage, so the TV freezes on
 * the page people are actually looking at.
 *
 * A page reload just starts over at page 0.
 */

export const CYCLE_MS = 10_000;
/** A scan on the ◀ ▶ codes holds the page this long, even with an empty cart. */
export const MANUAL_HOLD_MS = 60_000;
/** A busy kiosk that stays silent this long counts as idle (Pi crashed or offline). */
export const KIOSK_STALE_MS = 120_000;

export interface TvState {
    basePage: number;
    baseAt: number;
    kioskBusy: boolean;
    kioskSeenAt: number;
    manualUntil: number;
}

export interface TvPageView {
    page: number;
    cycling: boolean;
    /** How far into the current page's cycle we are, so the TV can time the next swap. */
    msIntoPage: number;
}

export function initialState(now: number): TvState {
    return { basePage: 0, baseAt: now, kioskBusy: false, kioskSeenAt: 0, manualUntil: 0 };
}

function isBusy(s: TvState, now: number): boolean {
    return s.kioskBusy && now - s.kioskSeenAt < KIOSK_STALE_MS;
}

export function isCycling(s: TvState, now: number): boolean {
    return !isBusy(s, now) && now >= s.manualUntil;
}

/**
 * When the current stretch of cycling began: the latest of the last settle,
 * the end of a manual hold and the moment a silent busy kiosk went stale.
 * Without this the page would jump ahead by every cycle that passed while held.
 */
function cycleStart(s: TvState): number {
    const staleAt = s.kioskBusy ? s.kioskSeenAt + KIOSK_STALE_MS : 0;
    return Math.max(s.baseAt, s.manualUntil, staleAt);
}

/**
 * Fold the cycles so far into basePage. While cycling, baseAt moves to the
 * start of the current page (not to now), so the page keeps its remaining time.
 */
function settle(s: TvState, now: number): TvState {
    if (!isCycling(s, now)) return { ...s, baseAt: now };
    const from = cycleStart(s);
    const cycles = Math.floor((now - from) / CYCLE_MS);
    return { ...s, basePage: s.basePage + cycles, baseAt: from + cycles * CYCLE_MS };
}

export function view(s: TvState, now: number): TvPageView {
    if (!isCycling(s, now)) return { page: s.basePage, cycling: false, msIntoPage: 0 };
    const elapsed = now - cycleStart(s);
    return {
        page: s.basePage + Math.floor(elapsed / CYCLE_MS),
        cycling: true,
        msIntoPage: elapsed % CYCLE_MS,
    };
}

export function navigate(s: TvState, step: 1 | -1, now: number): TvState {
    const settled = settle(s, now);
    return { ...settled, basePage: settled.basePage + step, manualUntil: now + MANUAL_HOLD_MS };
}

export function reportKiosk(s: TvState, busy: boolean, now: number): TvState {
    // A heartbeat that changes nothing only proves the kiosk is alive.
    if (busy === isBusy(s, now)) return { ...s, kioskBusy: busy, kioskSeenAt: now };
    // Settle before the busy flag flips, so the freeze keeps the page on screen
    // and a resume starts a fresh full cycle on it.
    const settled = settle(s, now);
    return { ...settled, kioskBusy: busy, kioskSeenAt: now };
}
