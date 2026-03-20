# Gemini CLI — Project Context & Rules

## SSR & Caching Strategy
- **SSR by Default:** Always prefer Server Components for data fetching. Pass `initialData` to Client Components to avoid "Loading..." flashes on the Raspberry Pi.
- **Server-Side Caching:** Use `fetch` with `next: { revalidate: 300 }` (5 minutes) for all external and internal data-fetcher requests. Centralize this logic in `lib/data.ts`.
- **Client-Side Polling:** Client components should still poll for updates in the background (via `useScreenData`) to keep the display fresh without a full page reload.

## Component Patterns
- All interactive components (Clock, Carousel, etc.) must support an `initialData` prop.
- Use the shared `useScreenData` hook for consistent data management.

## Performance
- The target hardware is a Raspberry Pi. Keep client-side JS execution minimal. Prefer CSS animations over heavy JS animation libraries where possible.
