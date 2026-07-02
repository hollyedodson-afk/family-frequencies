-- Sponsor logos shown on public event pages ("Supported by" strip).
-- URLs are pasted or uploaded to Cloudinary from the admin event form.

ALTER TABLE ff_events
  ADD COLUMN IF NOT EXISTS sponsor_logos text[] NOT NULL DEFAULT '{}';
