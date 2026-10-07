# Admin dashboard — database setup

The admin dashboard and customer portal code is complete and running, but the
database side has not been applied yet. Everything below needs credentials that
are not in this repository.

Until these steps are done, `/admin` loads but every panel reports
**"The admin tables do not exist yet."** That message is expected — it is not a
bug in the application code.

## What has to happen

### 1. Apply the migration

Run [`migrations/20260922100000_admin_inquiries_documents.sql`](migrations/20260922100000_admin_inquiries_documents.sql)
against the Supabase project `lsotrvgvddsbmbshxguw`.

It creates: `user_roles`, `customers`, `inquiries`, `inquiry_documents`,
`inquiry_notes`, `inquiry_status_history`, the `has_role()` / `is_staff()`
helper functions, the private `inquiry-docs` storage bucket, and the row-level
security policies for all of them.

Pick whichever route you have access to:

**Supabase Dashboard** — SQL Editor → paste the file → Run.

**Supabase CLI** — needs a personal access token and the database password:

```sh
bun add -d supabase
bunx supabase link --project-ref lsotrvgvddsbmbshxguw
bunx supabase db push
```

**Lovable** — this project is connected to Lovable Cloud, which manages the
Supabase project. Applying the SQL from the Lovable editor works without
separate Supabase dashboard credentials.

> One caveat for the CLI route: `supabase/migrations/` does **not** contain the
> DDL for the existing `vehicles`, `vehicle_images`, `vehicle_features` and
> `vehicle_pricing` tables — those were created outside the migration folder.
> A `supabase db reset` would therefore not rebuild the current schema. Use
> `db push`, not `reset`.

### 2. Add the service role key

The dashboard performs its writes server-side with the service role key. It is
not in `.env` yet, and nothing in the admin panel can write without it.

Supabase → Settings → API → `service_role`, then add to `.env`:

```
SUPABASE_SERVICE_ROLE_KEY=<the service_role key>
```

This key bypasses row-level security. It is read only by server code
(`src/lib/auth.server.ts`), never shipped to the browser, and must not be
committed or given a `VITE_` prefix — anything prefixed `VITE_` is inlined into
the client bundle.

Restart the dev server after editing `.env`.

### 3. Grant yourself the admin role

Signing in is not enough; the dashboard checks `user_roles`. Create the account
first (via `/login`, or Supabase → Authentication → Users), then run:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'you@example.com'
on conflict do nothing;
```

Use `'staff'` instead of `'admin'` for colleagues who should handle inquiries
but not manage roles.

## Verifying it worked

1. Submit the form at `/inquiry` — it should return a reference like `INQ-2026-0001`.
2. Sign in at `/login` and open `/admin` — the new inquiry should be listed.
3. Open it, upload a file, and press **Share** so the customer can see it.
4. Sign in as that customer and open `/account/inquiries` — the shared file
   should be downloadable, and anything left hidden should not appear.

## Notes on how access is enforced

- Roles live in their own `user_roles` table rather than as a column on a
  user-editable profile row, so a customer cannot promote themselves by editing
  their own record.
- `has_role()` and `is_staff()` are `SECURITY DEFINER` with a fixed
  `search_path`, which is what stops the policies on `user_roles` from recursing
  into themselves.
- The `inquiry-docs` bucket is private. Downloads are short-lived signed URLs
  issued per request, and a document is only reachable by the customer once a
  staff member sets `visible_to_customer`.
- Anonymous visitors can INSERT into `inquiries` but deliberately cannot SELECT
  from it, so the public form works while the lead list stays unreadable from
  the browser.
