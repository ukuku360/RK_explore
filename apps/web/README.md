# RK Explore Web (React Migration)

React + TypeScript migration shell for RoomingKos Explores.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill in Supabase values.
3. (Optional) Turn on signup allowlist enforcement.
4. Install dependencies and run dev server.

```bash
npm install
npm run dev
```

When enabling signup allowlist:

```bash
VITE_SIGNUP_ALLOWLIST_ENABLED=true
VITE_SIGNUP_ALLOWLIST_PATH=/signup-allowlist.txt
```

`public/signup-allowlist.txt` supports:
- plain emails (`resident@example.com`)
- sha256 hashes (`sha256:<64-hex>`)

For safer deployment, store raw emails outside `public/` and generate hashes:

```bash
npm run allowlist:build -- tools/allowlist/signup-allowlist.raw.txt public/signup-allowlist.txt
```

## Scripts

- `npm run dev` - start Vite dev server
- `npm run lint` - run ESLint (no warnings allowed)
- `npm run typecheck` - run TypeScript project checks
- `npm run build` - production build
- `npm run check` - lint + typecheck + build
- `npm run allowlist:build` - build hashed signup allowlist from raw email file
- `npm run format` - apply Prettier formatting
- `npm run format:check` - verify formatting

## Migration Notes

- App shell and routing are enabled in `src/app`.
- Server state baseline is wired with TanStack Query provider.
- Supabase client is centralized in `src/services/supabase/client.ts`.
- Admin route is lazy loaded and gated by hardcoded email `swanston@roomingkos.com`.
