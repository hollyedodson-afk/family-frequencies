export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event_id, quantity = 1 } = req.body || {};

  if (!event_id || typeof event_id !== 'string' || !isUuid(event_id)) {
    return res.status(400).json({ error: 'valid event_id required' });
  }

  const qty = Number.parseInt(quantity, 10);
  if (Number.isNaN(qty) || qty < 1 || qty > 10) {
    return res.status(400).json({ error: 'quantity must be between 1 and 10' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = getSiteUrl();

  if (!supabaseUrl || !supabaseKey || !stripeKey || !siteUrl) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let event;
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/ff_events?id=eq.${encodeURIComponent(event_id)}&select=*&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('Checkout event fetch error:', response.status, body);
      return res.status(502).json({ error: 'Could not load event' });
    }

    const rows = await response.json();
    event = rows[0];
  } catch (err) {
    console.error('Checkout event fetch error:', err);
    return res.status(500).json({ error: 'Could not load event' });
  }

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (event.status !== 'published') {
    return res.status(400).json({ error: 'Event not available' });
  }
  if (!event.is_ticketed) {
    return res.status(400).json({ error: 'Event is not ticketed' });
  }
  if (!event.stripe_price_id) {
    return res.status(400).json({ error: 'Tickets not yet configured' });
  }

  if (event.ticket_sale_opens && new Date(event.ticket_sale_opens) > new Date()) {
    return res.status(400).json({ error: 'Ticket sales are not open yet' });
  }

  if (event.capacity !== null && event.capacity !== undefined && (event.tickets_sold + qty) > event.capacity) {
    return res.status(400).json({ error: 'Not enough spots remaining' });
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        mode: 'payment',
        'line_items[0][price]': event.stripe_price_id,
        'line_items[0][quantity]': String(qty),
        success_url: `${siteUrl}/event/${event.slug}?success=1`,
        cancel_url: `${siteUrl}/event/${event.slug}`,
        customer_creation: 'always',
        'metadata[event_id]': event.id,
        'metadata[event_slug]': event.slug,
        'metadata[quantity]': String(qty),
        'payment_intent_data[metadata][event_id]': event.id,
      }).toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Stripe session create error:', response.status, body);
      return res.status(502).json({ error: 'Could not create checkout session' });
    }

    const session = await response.json();
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getSiteUrl() {
  return (process.env.SITE_URL || 'https://familyfrequencies.com').replace(/\/$/, '');
}
