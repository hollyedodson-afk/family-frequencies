export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/ff_events?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('Supabase event slug error:', response.status, body);
      return res.status(502).json({ error: 'Could not load event' });
    }

    const events = await response.json();
    if (!events.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = events[0];
    if (!['published', 'past'].includes(event.status)) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const { stripe_product_id, stripe_price_id, ...safeEvent } = event;

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json(safeEvent);
  } catch (err) {
    console.error('Event slug fetch error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
