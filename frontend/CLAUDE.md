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

---

## Service Layer Pattern

All API calls go through `lib/api.ts` which wraps `apiFetch` (auto-attaches Supabase JWT).
Add new endpoints to the `api` object — never call `fetch()` directly in components or hooks.

```typescript
// lib/api.ts — add new domain group here
export const api = {
  myDomain: {
    list: (id: string) => apiFetch<MyType[]>(`/my-domain/${id}`),
    create: (body: CreateDto) =>
      apiFetch<MyType>('/my-domain', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<CreateDto>) =>
      apiFetch<MyType>(`/my-domain/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch<void>(`/my-domain/${id}`, { method: 'DELETE' }),
  },
};
```

Types are hand-written in `lib/types.ts`. Always type both the service call and the hook return.

---

## React Query Hook Pattern

**File**: `hooks/use-[domain].ts`

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MyType } from '@/lib/types';

// Constant key — used for invalidation and cache targeting
const MY_DOMAIN_KEY = 'my-domain';

// List query
export function useMyDomainList(parentId: string | undefined) {
  return useQuery<MyType[]>({
    queryKey: [MY_DOMAIN_KEY, parentId],
    queryFn: () => api.myDomain.list(parentId!),
    enabled: !!parentId,
  });
}

// Single item query
export function useMyDomainItem(id: string | undefined) {
  return useQuery<MyType>({
    queryKey: [MY_DOMAIN_KEY, 'detail', id],
    queryFn: () => api.myDomain.getById(id!),
    enabled: !!id,
  });
}

// Create mutation
export function useCreateMyDomain(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDto) => api.myDomain.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MY_DOMAIN_KEY, parentId] }),
  });
}

// Update mutation
export function useUpdateMyDomain(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<CreateDto>) =>
      api.myDomain.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MY_DOMAIN_KEY, parentId] }),
  });
}

// Delete/deactivate mutation
export function useDeleteMyDomain(parentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.myDomain.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MY_DOMAIN_KEY, parentId] }),
  });
}
```

**Key patterns:**
- Query keys as module-level constants (`const MY_DOMAIN_KEY = 'my-domain'`)
- `enabled: !!id` — never fire with undefined params
- `staleTime` for infrequently changing data (e.g., `staleTime: 60_000` for analytics)
- Always invalidate the affected query key in `onSuccess`
- Optional `onSuccess` callback param for side effects (close modal, redirect)

---

## Component Pattern

```tsx
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

interface MyComponentProps extends ComponentProps<'div'> {
  title: string;
  variant?: 'default' | 'primary';
  isLoading?: boolean;
}

export function MyComponent({
  title,
  variant = 'default',
  isLoading = false,
  className,
  children,
  ...props
}: MyComponentProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border p-4',
        variant === 'primary' && 'bg-primary text-primary-foreground',
        isLoading && 'pointer-events-none opacity-50',
        className,
      )}
      {...props}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}
```

- Extend `ComponentProps<'element'>` to inherit native HTML attributes
- Default values in destructuring, not inside the function body
- Named exports only — no `export default function` inside component files (pages are the exception)
- Props spread with `...props` for flexibility

---

## Form Handling

When forms are needed, install and use:
```bash
pnpm add react-hook-form @hookform/resolvers zod
```

Pattern:
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  type: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function MyForm({ onSubmit }: { onSubmit: (data: FormData) => Promise<void> }) {
  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Use shadcn Form components when installed */}
    </form>
  );
}
```

- Zod schema → `z.infer<typeof schema>` for the type
- `zodResolver` connects schema to react-hook-form
- Use shadcn `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage` wrapping shadcn inputs

---

## Error Handling

No toast library installed. When toasts are needed:
```bash
pnpm add sonner
```

Then add `<Toaster />` to root layout and use:
```typescript
import { toast } from 'sonner';

toast.success('Saved');
toast.error('Something went wrong');
```

Error extraction utility — add to `lib/utils.ts` if needed:
```typescript
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}
```

---

## Data & Forms

- Use `lib/sanitize.ts` for all free-text user inputs before DB submission
  - `sanitizeName(str)` — trim + title case (venue names, addresses)
  - `sanitizeOptional(str)` — same but returns `undefined` if blank
- Use `lib/cebu-locations.ts` for city/postal code lookups (MVP: Cebu only)
- SQL injection: handled by Drizzle ORM (parameterized queries)
- XSS: handled by React JSX escaping

---

## Styling

- CSS variables defined in `app/globals.css` — already shadcn-compatible
- Dark mode via `next-themes` — class-based (`.dark`)

### cn() — REQUIRED for conditional/merged classes

Always use `cn()` from `@/lib/utils` for any conditional or composed Tailwind classes. Never use template literals or string concatenation.

```ts
// CORRECT
import { cn } from '@/lib/utils';

<div className={cn('rounded-md px-3 py-2', isActive && 'bg-primary text-primary-foreground')} />

// WRONG — never do this
<div className={`rounded-md px-3 py-2 ${isActive ? 'bg-primary' : ''}`} />
<div className={'rounded-md ' + (isActive ? 'bg-primary' : '')} />
```

---

## Anti-Patterns

- Never call `fetch()` directly — always use `api.*` from `lib/api.ts`
- Never store server state in `useState` — use TanStack Query
- Never use `any` types
- Never hardcode values that should come from `lib/types.ts`
- Never skip `enabled` guard on queries that depend on a param that could be undefined
