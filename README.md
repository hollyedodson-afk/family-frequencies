# Family Frequencies

Static website for Family Frequencies, a family-friendly daytime-events brand in Mt Maunganui and the Bay of Plenty.

## Pages

- `index.html` - Family Frequencies hub and programme
- `daylight-disco.html` - Daylight Disco event details

Both pages share `css/site.css` and `js/site.js`. Open them through a local static server; no build step is required.

## Backend Configuration

Backend work is Vercel serverless functions under `api/`, with database schema changes captured in `supabase/migrations/`.

Required environment variables are listed in `.env.example`. Keep real values in `.env` locally and in Vercel environment variables, never in committed files.

## Still To Connect

- Mailing-list provider and form endpoint
- Confirmed Instagram URL
- Vercel project and public domain
