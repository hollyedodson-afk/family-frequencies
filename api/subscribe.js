export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;

  if (!apiKey || !formId) {
    console.error('Missing KIT_API_KEY or KIT_FORM_ID env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const response = await fetch('https://api.kit.com/v4/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': apiKey,
      },
      body: JSON.stringify({ email_address: email, form_id: Number(formId) }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error('Kit API error:', response.status, body);
      return res.status(502).json({ error: 'Could not subscribe — please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe fetch error:', err);
    return res.status(500).json({ error: 'Something went wrong — please try again.' });
  }
}
