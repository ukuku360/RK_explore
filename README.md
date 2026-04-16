# RK Explore

Community and marketplace web app built with React, TypeScript, and Supabase.

## Project Summary

RK Explore is a product-style web app for a residential community. It combines:

- a social feed for tenant updates and lightweight community activity
- member directory and profile surfaces
- marketplace flows for listings, bids, and chat
- admin tooling for moderation and analytics

This repo contains the current React migration work and supporting migration notes, schema snapshots, and QA artifacts.

## What Is In This Repo

- `apps/web`: the Vite + React application
- `docs/migration`: rollout notes, SQL changes, screenshots, and regression documents
- `supabase_schema.sql`: schema snapshot used during migration work
- `tools`: local support files for snapshots and QA helpers

## App Capabilities

### Feed

- post creation and feed rendering
- votes, RSVPs, and personalization logic
- query invalidation and realtime sync hooks

### Community

- community-specific discovery and content flows
- moderation-aware policy handling

### Marketplace

- listing and bidding flows
- marketplace chat and asset handling

### Members and Profiles

- member directory
- profile detail and image flows

### Admin

- gated admin workspace
- reporting and analytics helpers

## Architecture

The current app is organized around a thin application shell and feature-oriented modules.

- Router and shell live under `apps/web/src/app`
- feature modules live under `apps/web/src/features`
- Supabase service boundaries live under `apps/web/src/services`
- shared guards, env helpers, logging, and query utilities live under `apps/web/src/lib`

Key implementation choices:

- React 19 with React Router
- TanStack Query for server-state coordination
- centralized Supabase client and service modules
- lazy-loaded heavy routes for admin, community, and marketplace

## Environment and Local Setup

From `apps/web`:

```bash
npm ci
cp .env.example .env
npm run dev
```

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional allowlist configuration:

```bash
VITE_SIGNUP_ALLOWLIST_ENABLED=true
VITE_SIGNUP_ALLOWLIST_PATH=/signup-allowlist.txt
```

To build a hashed allowlist:

```bash
npm run allowlist:build -- tools/allowlist/signup-allowlist.raw.txt public/signup-allowlist.txt
```

## Quality Checks

From `apps/web`:

```bash
npm run build
npm run lint
npm run test:run
```

The current branch passes all three checks. Build output still reports a large shared bundle, which is a known follow-up optimization rather than a release blocker for this pass.

## Deployment Notes

- Frontend deployment is configured for Vercel.
- Supabase is the source of truth for auth, profiles, posts, comments, marketplace data, and moderation state.
- Migration and cutover notes live in `docs/migration` and were kept in-repo to make rollout decisions auditable.

## Status

This is an active application codebase, not a static mockup. The strongest signals in the repo today are:

- a feature-based frontend structure
- explicit migration documentation
- passing automated tests around guards, discovery, feed logic, and admin metrics
