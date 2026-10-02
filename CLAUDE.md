@AGENTS.md

## Stack

- **Framework**: Next.js 16 App Router (params are `Promise<{}>`, must be awaited)
- **Database**: Supabase (Postgres + Auth + RLS) — project region: **eu-west-2 (London)**
- **Styling**: Tailwind CSS v4 with CSS custom properties — theme vars are in `src/app/globals.css`
- **Email**: Resend via `src/lib/email.ts` — API key in `RESEND_API_KEY` env var
- **Push notifications**: Web Push (VAPID) via `src/lib/push.ts`, subscriptions in `push_subscriptions` table
- **Theme**: `next-themes` with `attribute="class"` — dark mode adds `.dark` to `<html>`
- **Language**: Norwegian (nb) throughout the UI
- **Deployment**: Vercel, region `arn1` (Stockholm) — co-located close to Supabase London and Norwegian users

## Key conventions

- All server actions are in `actions.ts` files colocated with the page
- RLS policies use SECURITY DEFINER functions to avoid circular references
- Supabase types are hand-maintained in `src/types/index.ts` (no generated types file)
- Mobile: bottom tab nav for core pages; profile/admin/theme toggle in hamburger menu (top right avatar)
- Desktop: left sidebar always dark, main content area respects light/dark theme
- **Auth in pages**: use `supabase.auth.getSession()` (reads cookie locally, no network call) — the middleware (`src/proxy.ts`) already calls `getUser()` on every request to validate/refresh tokens
- **Auth in actions**: use `supabase.auth.getUser()` — server actions are called directly and need full token validation
- **Parallel fetching**: run `getSession()` and data queries that don't need `user.id` together in `Promise.all`

## Git remote

`https://github.com/robfosse/moldhaugen-portal.git` (repo moved from `Moldhaugen/moldhaugen-portal`)

## Env vars

### Local (`.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `CRON_SECRET` — shared secret for the hourly reminder cron endpoint

### Vercel (must also be set there)
All of the above, plus confirm `NEXT_PUBLIC_SITE_URL` points to the live deployment URL.

## Cron job

`/api/cron/reminders` runs hourly (`0 * * * *`), secured with `Authorization: Bearer $CRON_SECRET`.
- **18:00 Oslo**: sends day-before reminder for assignments due tomorrow
- **At scheduled hour (or 09:00 if no time set)**: sends on-day reminder for assignments due today
- Tracks sends via `reminder_day_before_sent_at` / `reminder_on_day_sent_at` columns on `maintenance_assignments`

## Realtime updates (polling + broadcast pattern)

Pages that need live cross-user updates use a two-layer approach in the client list component:

```tsx
useEffect(() => {
  const supabase = createClient()                          // browser client
  const channel = supabase
    .channel("channel-name")
    .on("broadcast", { event: "refresh" }, () => router.refresh())
    .subscribe()
  const poll = setInterval(() => router.refresh(), 5_000) // 5-second fallback
  return () => { supabase.removeChannel(channel); clearInterval(poll) }
}, [router])
```

Server actions call `broadcastToolUpdate()` (or equivalent) after every mutation — uses `supabase.channel().send()` on the service client. The broadcast reaches clients near-instantly when Supabase delivers it; polling covers the rest within 5 seconds.

**Critical gotcha — stale useState from props**: client components that derive state from server-fetched props (`useState(prop)`) will NOT re-render when polling refreshes the server component, because React's `useState` only reads the initial value. Fixes:
- For arrays used only for display: read `prop` directly (drop the local state).
- For optimistic-only state (e.g. deleted IDs): keep a separate `Set` of IDs and filter `prop` against it.
- For derived boolean state: sync with `useEffect(() => { setX(!!activeItem) }, [activeItem])`.

**Critical gotcha — RLS blocks server action reads**: Supabase RLS policies that restrict SELECT to `auth.uid()` rows will silently return `null` even in server actions. Pattern:
- Auth check: use regular client (`createClient()`) — it has the user's session.
- Writes that need cross-user access: use service client (`createServiceClient()`).
- Reads that need cross-user access (e.g. finding an approved request regardless of who owns it): use service client.
- Never rely on RLS-filtered reads for authorization logic — query explicitly by `user.id`.

**Critical gotcha — missing UPDATE policy silently drops edits**: If a table has RLS enabled but no `FOR UPDATE` policy, Supabase returns no error — it just updates 0 rows. This caused `info_entries` edits to silently vanish. When adding a new table, always define all four policies: `SELECT`, `INSERT`, `UPDATE`, `DELETE`. The UPDATE policy needs both `USING` (which rows are visible for update) and `WITH CHECK` (which values are allowed after update).

**Force-dynamic**: add `export const dynamic = "force-dynamic"` to pages with polling so `router.refresh()` always hits Supabase fresh instead of a cached response.

**Supabase Realtime broadcast via REST**: the `channel.send()` approach from the service client works (returns `ok`) but delivery to subscribed clients is unreliable — use polling as the guaranteed fallback, not as a last resort.

## PWA / Install as app

The app is configured as a PWA so users can install it to their home screen (iOS Safari: Share → Add to Home Screen; Android Chrome: browser menu → Install app).

Key files:
- `src/app/manifest.ts` (or `public/manifest.json`) — app name, icons, `display: "standalone"`, `start_url`
- Icons in `public/` — at minimum 192×192 and 512×512 PNG
- `<link rel="manifest">` in the root layout (Next.js adds this automatically from `manifest.ts`)
- iOS splash/icon meta tags in root layout `<head>` if needed for full iOS support

The `beforeinstallprompt` event (seen in browser logs as "Banner not shown: beforeinstallpromptEvent.preventDefault() called") means the PWA install criteria are met but the prompt was suppressed — this is normal if no custom install button is wired up.

## Realtime coverage

Pages with live updates (polling + broadcast, `force-dynamic`):
- `/verktoy` — channel `"verktoy"`; mutations also notify `"calendar"` channel since borrow approval creates calendar events
- `/calendar` — channel `"calendar"`

Pages without live updates (manual refresh only):
- `/info`, `/maintenance`, `/oppslagstavle`, `/beboere`, `/admin`

## Styret (board members) — `/info` page

`board_members` table (requires manual SQL migration — see below). Shown as a card at the top of the Nyttig info page.
- Admin can add (resident dropdown + free-text role), edit role inline (pencil → input → Enter/Escape), and remove members
- Non-admins see name, role, phone, email (read-only)
- Actions: `addBoardMember`, `updateBoardMember`, `removeBoardMember` in `src/app/(dashboard)/info/actions.ts`
- Component: `src/components/info/styret-card.tsx`

### SQL to run in Supabase SQL editor

```sql
-- board_members
CREATE TABLE IF NOT EXISTS board_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users can view board members"
  ON board_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true));
CREATE POLICY "Admins can manage board members"
  ON board_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
```

## TODOs

- [ ] **Run `supabase/migration_reminders.sql`** in Supabase SQL editor to add `scheduled_time`, `reminder_day_before_sent_at`, `reminder_on_day_sent_at` columns to `maintenance_assignments`.
- [ ] **Run board_members SQL** above if not already done.
- [ ] **Run `supabase/migration_info_update_policy.sql`** in Supabase SQL editor to add the missing UPDATE policy on `info_entries` (fixes edits being silently dropped).
