-- Family Frequencies ticketing schema.
-- Apply after the admin backend migration has created ff_events.

ALTER TABLE ff_events
  ADD COLUMN IF NOT EXISTS is_ticketed         boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capacity            integer,
  ADD COLUMN IF NOT EXISTS price_cents         integer,
  ADD COLUMN IF NOT EXISTS tickets_sold        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_sale_opens   timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_product_id   text,
  ADD COLUMN IF NOT EXISTS stripe_price_id     text;

CREATE TABLE IF NOT EXISTS ff_tickets (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid        NOT NULL REFERENCES ff_events(id),
  stripe_session_id text        UNIQUE NOT NULL,
  buyer_name        text        NOT NULL,
  buyer_email       text        NOT NULL,
  quantity          integer     NOT NULL DEFAULT 1,
  ticket_type       text        NOT NULL DEFAULT 'general',
  amount_paid_cents integer     NOT NULL,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE ff_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ff_tickets'
      AND policyname = 'auth_read_tickets'
  ) THEN
    CREATE POLICY "auth_read_tickets" ON ff_tickets
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION record_ticket(
  p_event_id          uuid,
  p_session_id        text,
  p_buyer_name        text,
  p_buyer_email       text,
  p_quantity          integer,
  p_amount_paid_cents integer
) RETURNS void AS $$
DECLARE
  v_capacity integer;
  v_sold     integer;
  v_inserted integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  SELECT capacity INTO v_capacity FROM ff_events WHERE id = p_event_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM ff_tickets WHERE stripe_session_id = p_session_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_sold FROM ff_tickets WHERE event_id = p_event_id;

  IF v_capacity IS NOT NULL AND (v_sold + p_quantity) > v_capacity THEN
    RAISE EXCEPTION 'sold_out';
  END IF;

  INSERT INTO ff_tickets (
    event_id, stripe_session_id, buyer_name, buyer_email,
    quantity, amount_paid_cents
  ) VALUES (
    p_event_id, p_session_id, p_buyer_name, p_buyer_email,
    p_quantity, p_amount_paid_cents
  ) ON CONFLICT (stripe_session_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    UPDATE ff_events
      SET tickets_sold = tickets_sold + p_quantity,
          updated_at   = now()
      WHERE id = p_event_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION record_ticket(uuid, text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_ticket(uuid, text, text, text, integer, integer)
  TO service_role;
