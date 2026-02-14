# RK Explore Web (React Migration)

React + TypeScript migration shell for RoomingKos Explores.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in Supabase values.
3. Install dependencies and run dev server.

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` - start Vite dev server
- `npm run lint` - run ESLint (no warnings allowed)
- `npm run typecheck` - run TypeScript project checks
- `npm run build` - production build
- `npm run check` - lint + typecheck + build
- `npm run format` - apply Prettier formatting
- `npm run format:check` - verify formatting

## Migration Notes

- App shell and routing are enabled in `src/app`.
- Server state baseline is wired with TanStack Query provider.
- Supabase client is centralized in `src/services/supabase/client.ts`.
- Admin route is lazy loaded and gated by hardcoded email `swanston@roomingkos.com`.
