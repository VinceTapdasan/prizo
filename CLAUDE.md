# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Prizo** — A loyalty/gacha system for bars and restaurants. Customers scan a QR code after purchasing, enter their phone number, and get a daily gacha spin to win rewards (free drink, discount, bonus points, etc.). Every scan earns base loyalty points regardless of spin outcome.

- **Package Manager:** pnpm (use `pnpm` for all commands)
- **Monorepo:** pnpm workspace with two packages: `frontend` and `backend`

### User Types

- **Customers** — mobile web only (no app), identified by phone number
- **Business owners** — email/password auth, manage venue/rewards/analytics via dashboard

### Core Mechanics

**Daily Spin**
- 1 spin per customer per business per day
- "Day" resets at a configurable time (default 5:00 AM local). No rollover — unused spins are lost.

**RNG Reward Pool**
- 5 tiers: Miss, Common (bonus points), Uncommon (small discount), Rare (free side), Epic (free drink/entrée)
- Each business configures weighted probabilities that must sum to 100%
- Each reward can have an optional stock/inventory limit

**Pity System**
- Tracks consecutive Miss results per customer per business
- At a configurable threshold (e.g., 7), next spin is a guaranteed win at a configured minimum tier
- Pity counter resets on any win (including before hitting threshold)
- Customers can see progress: "3 more spins until guaranteed reward"

**Loyalty Points**
- Earned every scan regardless of RNG outcome
- Business configures points per scan and milestone rewards (e.g., 100 pts = free drink)
- Points never expire (MVP)

**QR Code**
- Each business gets one static QR: `prizo.app/b/{business_slug}`
- Regeneratable (invalidates old slug) as an abuse escape hatch
- No technical approval flow — staff controls physical QR display

**Reward Redemption**
- Won rewards are "unclaimed" until redeemed
- Customer shows phone → visual confirmation screen → staff confirms → marked "redeemed"
- Configurable expiry per reward (e.g., 7 days)
- No staff-side app in MVP — confirmation happens on customer's device

## Commands

### Root (from project root)

```bash
pnpm dev              # Start frontend dev server
pnpm backend          # Start backend dev server (watch mode)
pnpm build            # Build frontend
pnpm build:backend    # Build backend
pnpm lint             # Lint frontend
```

### Frontend (`/frontend`)

```bash
pnpm dev              # Next.js dev server on http://localhost:3000
pnpm build            # Production build
pnpm lint             # ESLint
```

### Backend (`/backend`)

```bash
pnpm start:dev        # NestJS with watch mode on port 3001
pnpm build            # Compile TypeScript
pnpm lint             # ESLint with auto-fix
pnpm test             # Jest unit tests
pnpm test:watch       # Jest watch mode
pnpm test:cov         # Coverage report
pnpm test:e2e         # E2E tests
```

## Architecture

### Monorepo Structure

```
prizo/
├── frontend/          # Next.js 16 + React 19 + Tailwind CSS v4
│   └── app/           # App Router: layout.tsx, page.tsx, globals.css
├── backend/           # NestJS 11
│   └── src/           # main.ts, app.module.ts
└── pnpm-workspace.yaml
```

### Frontend

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4 with semantic design tokens (oklch color system, light/dark mode via CSS variables in `globals.css`)
- **Fonts:** Geist (sans), Geist Mono, Lora (heading) — loaded via `next/font/google`
- **Path alias:** `@/*` maps to `./` (project root of frontend)

### Backend

- **Framework:** NestJS 11
- **Port:** 3001
- **CORS:** Configured for `http://localhost:3000` (via `CORS_ORIGIN` env var)
- **External service:** Supabase (via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)

### Environment Variables

Frontend (`.env.local`):
- `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Backend (`.env`):
- `PORT=3001`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGIN=http://localhost:3000`

## Code Style

- **Backend:** Prettier with single quotes and trailing commas (see `backend/.prettierrc`)
- **TypeScript:** Strict mode enabled in both packages
