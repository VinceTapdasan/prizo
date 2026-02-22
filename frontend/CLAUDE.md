# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server (port 3000)
pnpm build        # production build
pnpm lint         # eslint
```

Package manager is **pnpm**. Never use npm or bun.

## UI Components — shadcn/ui (REQUIRED)

**Always use shadcn/ui components for ALL UI elements. Never use native HTML form elements directly.**

```ts
// CORRECT
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

// WRONG — never do this
<input className="..." />
<button className="..." />
<select className="..." />
<label className="..." />
```

When a needed shadcn component is not yet installed:
```bash
pnpm dlx shadcn@latest add [component-name]
```

Available installed components: `input`, `button`, `label`, `select`

### shadcn Select vs native select

shadcn Select uses `onValueChange` (not `onChange`) and requires the full compound pattern:
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="foo">Foo</SelectItem>
  </SelectContent>
</Select>
```

## Architecture

- **Next.js 16** App Router, React 19, Tailwind v4, TypeScript
- **Auth**: Supabase (Google SSO for business owners, phone OTP for customers)
- **Middleware**: `proxy.ts` (not `middleware.ts`) — exported function must be named `proxy`
- **API calls**: `lib/api.ts` — attaches Supabase JWT to all NestJS backend requests
- **State**: TanStack Query v5 for all server state, hooks in `hooks/` by domain

## Route Structure

```
/login                  → Business owner Google SSO
/onboarding             → First-time setup (standalone, no sidebar)
/auth/callback          → OAuth code exchange
/dashboard/*            → Business owner dashboard (sidebar layout)
/b/[slug]/*             → Customer-facing pages (mobile)
```

## Middleware Guards (proxy.ts)

Order matters:
1. Unauthenticated → `/dashboard/*` or `/onboarding` → redirect `/login`
2. Authenticated → `/login` → redirect `/dashboard`
3. Authenticated + no business → `/dashboard/*` → redirect `/onboarding`
4. Authenticated + has business → `/onboarding` → redirect `/dashboard`

## Data & Forms

- Use `lib/sanitize.ts` for all free-text user inputs before DB submission
  - `sanitizeName(str)` — trim + title case (venue names, addresses)
  - `sanitizeOptional(str)` — same but returns `undefined` if blank
- Use `lib/cebu-locations.ts` for city/postal code lookups (MVP: Cebu only)
- SQL injection: handled by Drizzle ORM (parameterized queries)
- XSS: handled by React JSX escaping

## Styling

- CSS variables defined in `app/globals.css` — already shadcn-compatible
- Dark mode via `next-themes` — class-based (`.dark`)

### cn() — REQUIRED for conditional/merged classes

Always use `cn()` from `@/lib/utils` for any conditional or composed Tailwind classes. Never use template literals or string concatenation.

```ts
// CORRECT
import { cn } from '@/lib/utils';

<div className={cn('rounded-md px-3 py-2', isActive && 'bg-primary text-primary-foreground')} />
<button className={cn(baseStyles, variant === 'ghost' && 'bg-transparent', disabled && 'opacity-50')} />

// WRONG — never do this
<div className={`rounded-md px-3 py-2 ${isActive ? 'bg-primary' : ''}`} />
<div className={'rounded-md ' + (isActive ? 'bg-primary' : '')} />
```
