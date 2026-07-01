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
  external_payment_id text      UNIQUE,
  payment_reference text        UNIQUE NOT NULL,
  payment_method    text        NOT NULL DEFAULT 'bank_transfer',
  payment_status    text        NOT NULL DEFAULT 'pending',
  buyer_name        text        NOT NULL,
  buyer_email       text        NOT NULL,
  quantity          integer     NOT NULL DEFAULT 1,
  ticket_type       text        NOT NULL DEFAULT 'general',
  amount_paid_cents integer     NOT NULL,
  created_at        timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ff_tickets'
      AND column_name = 'stripe_session_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ff_tickets'
      AND column_name = 'external_payment_id'
  ) THEN
    ALTER TABLE ff_tickets RENAME COLUMN stripe_session_id TO external_payment_id;
  END IF;
END $$;

ALTER TABLE ff_tickets
  ADD COLUMN IF NOT EXISTS external_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_reference   text,
  ADD COLUMN IF NOT EXISTS payment_method      text NOT NULL DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS payment_status      text NOT NULL DEFAULT 'pending';

ALTER TABLE ff_tickets
  ALTER COLUMN external_payment_id DROP NOT NULL;

UPDATE ff_tickets
  SET payment_reference = COALESCE(payment_reference, external_payment_id, id::text)
  WHERE payment_reference IS NULL;

ALTER TABLE ff_tickets
  ALTER COLUMN payment_reference SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ff_tickets_payment_reference_key
  ON ff_tickets(payment_reference);

CREATE UNIQUE INDEX IF NOT EXISTS ff_tickets_external_payment_id_key
  ON ff_tickets(external_payment_id)
  WHERE external_payment_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ff_tickets_payment_method_check'
  ) THEN
    ALTER TABLE ff_tickets ADD CONSTRAINT ff_tickets_payment_method_check
      CHECK (payment_method IN ('bank_transfer', 'stripe'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ff_tickets_payment_status_check'
  ) THEN
    ALTER TABLE ff_tickets ADD CONSTRAINT ff_tickets_payment_status_check
      CHECK (payment_status IN ('pending', 'paid', 'cancelled', 'refunded'));
  END IF;
END $$;

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

  IF EXISTS (SELECT 1 FROM ff_tickets WHERE external_payment_id = p_session_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_sold FROM ff_tickets WHERE event_id = p_event_id;

  IF v_capacity IS NOT NULL AND (v_sold + p_quantity) > v_capacity THEN
    RAISE EXCEPTION 'sold_out';
  END IF;

  INSERT INTO ff_tickets (
    event_id, external_payment_id, payment_reference, payment_method, payment_status,
    buyer_name, buyer_email, quantity, amount_paid_cents
  ) VALUES (
    p_event_id, p_session_id, p_session_id, 'stripe', 'paid',
    p_buyer_name, p_buyer_email, p_quantity, p_amount_paid_cents
  ) ON CONFLICT (external_payment_id) DO NOTHING;

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

CREATE OR REPLACE FUNCTION reserve_bank_transfer_ticket(
  p_event_id          uuid,
  p_buyer_name        text,
  p_buyer_email       text,
  p_quantity          integer,
  p_amount_due_cents  integer,
  p_reference         text
) RETURNS uuid AS $$
DECLARE
  v_capacity integer;
  v_sold     integer;
  v_ticket_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  IF p_reference IS NULL OR length(trim(p_reference)) < 4 THEN
    RAISE EXCEPTION 'invalid_reference';
  END IF;

  SELECT capacity INTO v_capacity FROM ff_events WHERE id = p_event_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_sold
    FROM ff_tickets
    WHERE event_id = p_event_id
      AND payment_status <> 'cancelled';

  IF v_capacity IS NOT NULL AND (v_sold + p_quantity) > v_capacity THEN
    RAISE EXCEPTION 'sold_out';
  END IF;

  INSERT INTO ff_tickets (
    event_id, payment_reference, payment_method, payment_status,
    buyer_name, buyer_email, quantity, amount_paid_cents
  ) VALUES (
    p_event_id, p_reference, 'bank_transfer', 'pending',
    p_buyer_name, p_buyer_email, p_quantity, p_amount_due_cents
  )
  RETURNING id INTO v_ticket_id;

  UPDATE ff_events
    SET tickets_sold = tickets_sold + p_quantity,
        updated_at   = now()
    WHERE id = p_event_id;

  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION reserve_bank_transfer_ticket(uuid, text, text, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_bank_transfer_ticket(uuid, text, text, integer, integer, text)
  TO service_role;
