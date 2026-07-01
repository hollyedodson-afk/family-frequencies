-- Lock admin access down to a named allowlist instead of "any authenticated user".
--
-- Before this migration, RLS granted full ff_events write access and ff_tickets
-- read access to auth.role() = 'authenticated'. Supabase projects allow public
-- signups by default, so any stranger who created an account could edit events
-- and read buyer names/emails. This migration replaces both policies with an
-- ff_admins allowlist check.
--
-- After applying:
--   1. INSERT INTO ff_admins (email) VALUES ('holly@...'), ('toby@...');
--   2. Also disable public signups in Supabase Dashboard → Authentication →
--      Sign In / Up, as defence in depth.

CREATE TABLE IF NOT EXISTS ff_admins (
  email      text        PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ff_admins ENABLE ROW LEVEL SECURITY;
-- No policies on ff_admins: only service_role can read or change the allowlist.

CREATE OR REPLACE FUNCTION is_ff_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM ff_admins
    WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION is_ff_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_ff_admin() TO authenticated, anon, service_role;

-- ff_events: public reads stay as-is; writes require the allowlist.
DROP POLICY IF EXISTS "auth_full_access" ON ff_events;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ff_events'
      AND policyname = 'admin_full_access'
  ) THEN
    CREATE POLICY "admin_full_access" ON ff_events
      FOR ALL
      USING (is_ff_admin())
      WITH CHECK (is_ff_admin());
  END IF;
END $$;

-- ff_tickets: buyer PII is only visible to admins.
DROP POLICY IF EXISTS "auth_read_tickets" ON ff_tickets;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ff_tickets'
      AND policyname = 'admin_read_tickets'
  ) THEN
    CREATE POLICY "admin_read_tickets" ON ff_tickets
      FOR SELECT USING (is_ff_admin());
  END IF;
END $$;

-- Atomic ticket status change that keeps ff_events.tickets_sold honest.
--
-- reserve_bank_transfer_ticket increments tickets_sold at reservation time and
-- its capacity check ignores cancelled tickets, but a plain UPDATE of
-- payment_status never decremented the counter — cancelled tickets permanently
-- inflated tickets_sold on the event (and the public sold-out display).
CREATE OR REPLACE FUNCTION set_ticket_payment_status(
  p_ticket_id uuid,
  p_status    text
) RETURNS void AS $$
DECLARE
  v_old_status text;
  v_event_id   uuid;
  v_quantity   integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF p_status NOT IN ('pending', 'paid', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT payment_status, event_id, quantity
    INTO v_old_status, v_event_id, v_quantity
    FROM ff_tickets WHERE id = p_ticket_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found';
  END IF;

  IF v_old_status = p_status THEN
    RETURN;
  END IF;

  -- Lock the event row so counter math can't race with reservations.
  PERFORM 1 FROM ff_events WHERE id = v_event_id FOR UPDATE;

  UPDATE ff_tickets SET payment_status = p_status WHERE id = p_ticket_id;

  -- Only 'cancelled' releases capacity (matching reserve_bank_transfer_ticket's
  -- capacity check, which excludes cancelled tickets only).
  IF p_status = 'cancelled' AND v_old_status <> 'cancelled' THEN
    UPDATE ff_events
      SET tickets_sold = greatest(0, tickets_sold - v_quantity),
          updated_at   = now()
      WHERE id = v_event_id;
  ELSIF v_old_status = 'cancelled' AND p_status <> 'cancelled' THEN
    UPDATE ff_events
      SET tickets_sold = tickets_sold + v_quantity,
          updated_at   = now()
      WHERE id = v_event_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION set_ticket_payment_status(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_ticket_payment_status(uuid, text)
  TO service_role;
