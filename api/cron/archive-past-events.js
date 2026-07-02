// Runs daily via the vercel.json cron schedule (0 14 UTC = 2-3am NZ).
// Flips published events whose date has passed (NZ time) to status 'past'.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const todayNz = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });

  const response = await fetch(
    `${supabaseUrl}/rest/v1/ff_events?status=eq.published&event_date=lt.${todayNz}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ status: 'past', updated_at: new Date().toISOString() }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error('Archive cron error:', response.status, body);
    return res.status(502).json({ error: 'Could not archive events' });
  }

  const archived = await response.json();
  if (archived.length) {
    console.log('Archived events:', archived.map((e) => e.slug).join(', '));
  }
  return res.status(200).json({ archived: archived.length, date: todayNz });
}
