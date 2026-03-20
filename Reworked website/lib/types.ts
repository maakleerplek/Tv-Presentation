/**
 * Shared type definitions for the screen-data API payload.
 * These mirror the shapes produced by data-fetcher/server.js.
 */

/** A calendar event enriched with detail-page data. Used for both workshops and recurringEvents. */
export type CalendarEvent = {
    title: string;
    /** Dutch short date string from the calendar list, e.g. "do 26 feb" */
    date: string;
    /** ISO date string "YYYY-MM-DD" derived from the parsed Dutch date */
    dateISO: string;
    /** Time range string, e.g. "19:00-22:00", or "" if not found */
    time: string;
    /** Location name from the event detail page, or "maakleerplek" as fallback */
    location: string;
    /** Absolute URL to the event detail page */
    link: string;
    /** og:description text, stripped of HTML and truncated to 400 chars */
    description: string;
    /** Absolute image URL from the event detail page, or "" */
    imageUrl: string;
    /** Price string, e.g. "€30", or "" if not found */
    price: string;
    /** Bucket type assigned by the server */
    type: 'workshop' | 'recurring';
};

/** A news article scraped from the maakleerplek.be homepage. */
export type NewsItem = {
    title: string;
    /** Absolute URL to the article */
    link: string;
    /** og:description text */
    description: string;
    /** Absolute image URL from og:image or article body */
    imageUrl: string;
    /** Formatted date string from article:modified_time, nl-BE locale */
    date: string;
    type: 'news';
    /** Optional database ID for custom injected news items */
    _id?: number;
};

/** A drink/snack item from the InvenTree inventory. */
export type DrinkItem = {
    name: string;
    /** Formatted price string, e.g. "€1.50", or "-" if unavailable */
    price: string;
    /** Aggregated stock quantity across all matching locations */
    stock: number;
    /** Next.js-relative proxy URL, e.g. "/api/proxy-image?url=...", or null */
    imageUrl: string | null;
};

/** Pricing information scraped from the wiki. */
export type PricingData = {
    memberships: { name: string; price: string }[];
    equipment: { name: string; price: string }[];
    materials: { name: string; price: string }[];
    workshops: { name: string; price: string }[];
};

/** The full payload returned by /api/screen-data. */
export type ScreenData = {
    workshops: CalendarEvent[];
    news: NewsItem[];
    recurringEvents: CalendarEvent[];
    drinks: DrinkItem[];
    pricing: PricingData;
    config: ScreenConfig;
};

/** Config values delivered from the data-fetcher alongside the data. */
export type ScreenConfig = {
    /** Seconds each carousel slide is shown before advancing */
    transitionTime: number;
    /** Seconds each tip is shown before advancing */
    tipsTransitionTime: number;
    /** Seconds the status block rotates between "Next Event" and "Next Workshop" */
    statusRotationTime: number;
    /** URL encoded into the payment QR code in the drinks panel */
    paymentQrUrl: string;
    /** URL encoded into the wiki QR code in the tips footer */
    wikiQrUrl: string;
    /** Ordered keyword list for event priority; earlier index = higher priority */
    eventPriority: string[];
    /** Custom tip strings shown in the footer */
    tips: string[];
    /** URL encoded into the QR code shown in the tips footer */
    websiteQrUrl: string;
};
