export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const jwt = authHeader.slice(7);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const adminEmails = parseAdminEmails(process.env.FF_ADMIN_EMAILS);

  if (!supabaseUrl || !serviceKey || !stripeKey || adminEmails.length === 0) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!userResponse.ok) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  const user = await userResponse.json();
  if (!adminEmails.includes(String(user.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { event_id } = req.body || {};
  if (!event_id || typeof event_id !== 'string' || !isUuid(event_id)) {
    return res.status(400).json({ error: 'valid event_id required' });
  }

  const eventResponse = await fetch(
    `${supabaseUrl}/rest/v1/ff_events?id=eq.${encodeURIComponent(event_id)}&select=*&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!eventResponse.ok) {
    const body = await eventResponse.text();
    console.error('Publish event fetch error:', eventResponse.status, body);
    return res.status(502).json({ error: 'Could not load event' });
  }

  const [event] = await eventResponse.json();
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  if (!event.is_ticketed) {
    return res.status(400).json({ error: 'Event is not ticketed' });
  }

  if (event.stripe_price_id) {
    const patched = await updateEvent(supabaseUrl, serviceKey, event_id, {
      status: 'published',
      updated_at: new Date().toISOString(),
    });

    if (!patched.ok) {
      return res.status(502).json({ error: 'Could not publish event' });
    }

    return res.status(200).json({ stripe_price_id: event.stripe_price_id });
  }

  if (!event.price_cents) {
    return res.status(400).json({ error: 'price_cents required to publish ticketed event' });
  }

  try {
    const product = await createStripeProduct(stripeKey, event);
    const price = await createStripePrice(stripeKey, product.id, event.price_cents, event.id);
    const patched = await updateEvent(supabaseUrl, serviceKey, event_id, {
      status: 'published',
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      updated_at: new Date().toISOString(),
    });

    if (!patched.ok) {
      return res.status(502).json({ error: 'Could not save Stripe product details' });
    }

    return res.status(200).json({
      stripe_product_id: product.id,
      stripe_price_id: price.id,
    });
  } catch (err) {
    console.error('Publish event error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

async function createStripeProduct(stripeKey, event) {
  const response = await fetch('https://api.stripe.com/v1/products', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `ff-product-${event.id}`,
    },
    body: new URLSearchParams({
      name: event.title,
      description: event.description || event.title,
      'metadata[event_id]': event.id,
      'metadata[slug]': event.slug,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Stripe product create failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function createStripePrice(stripeKey, productId, amountCents, eventId) {
  const response = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `ff-price-${eventId}`,
    },
    body: new URLSearchParams({
      currency: 'nzd',
      unit_amount: String(amountCents),
      product: productId,
      'metadata[event_id]': eventId,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Stripe price create failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function updateEvent(supabaseUrl, serviceKey, eventId, payload) {
  return fetch(`${supabaseUrl}/rest/v1/ff_events?id=eq.${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
}

function parseAdminEmails(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
