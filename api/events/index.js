// Public list of events for the website (events.html and the homepage card).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const fields = [
    'id', 'title', 'slug', 'event_date', 'time_start', 'time_end', 'venue',
    'image_url', 'chips', 'status', 'detail_url', 'is_ticketed', 'price_cents',
    'capacity', 'tickets_sold',
  ].join(',');

  try {
    const response = await fetch(
      `${url}/rest/v1/ff_events?status=in.(published,past)&select=${fields}&order=event_date.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('Events list error:', response.status, body);
      return res.status(502).json({ error: 'Could not load events' });
    }

    const events = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(events);
  } catch (err) {
    console.error('Events list fetch error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
