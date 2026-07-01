# Family Frequencies

Static website for Family Frequencies, a family-friendly daytime-events brand in Mt Maunganui and the Bay of Plenty.

## Pages

- `index.html` - Family Frequencies hub and programme
- `daylight-disco.html` - Daylight Disco event details

Both pages share `css/site.css` and `js/site.js`. Open them through a local static server; no build step is required.

## Backend Configuration

Backend work is Vercel serverless functions under `api/`, with database schema changes captured in `supabase/migrations/`.

Required environment variables are listed in `.env.example`. Keep real values in `.env` locally and in Vercel environment variables, never in committed files.

## Internal Admin

The internal dashboard lives at `admin/index.html`. It is for co-organiser operations only: Supabase login, event CRUD, ticketing fields, publish action, attendee list, payment-status checks, CSV export, and Kit subscriber stats.

The admin dashboard reads public Supabase config from `/api/admin-config` and uses Supabase Auth for the session. Ticketed publish actions still go through `/api/publish-event`, which checks `FF_ADMIN_EMAILS` server-side.

### Admin access lockdown (required before launch)

RLS now checks the `ff_admins` allowlist (`supabase/migrations/20260702_admin_lockdown.sql`) instead of trusting any authenticated user. After applying the migration:

1. `INSERT INTO ff_admins (email) VALUES ('holly@...'), ('toby@...');` (lowercase, must match Supabase Auth emails and `FF_ADMIN_EMAILS`)
2. Disable public signups: Supabase Dashboard -> Authentication -> Sign In / Up -> disable "Allow new users to sign up"

Without step 1 the admin dashboard cannot write events or read attendees.

## Ticket Payments

Ticketing currently uses manual bank transfer reservations. `/api/checkout` reserves capacity, creates a pending ticket, and returns a payment reference plus `BANK_TRANSFER_INSTRUCTIONS`. Admins confirm the transfer manually from the Attendees tab by marking the ticket as paid.

Stripe keys remain optional for a later card-payment phase.

## Still To Connect

- Mailing-list provider and form endpoint
- Confirmed Instagram URL
- Vercel project and public domain
