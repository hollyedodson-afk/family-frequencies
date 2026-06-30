import { parseAdminEmails, requireAdmin } from './admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.KIT_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmails = parseAdminEmails(process.env.FF_ADMIN_EMAILS);

  if (!apiKey || !supabaseUrl || !serviceKey || adminEmails.length === 0) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const admin = await requireAdmin(req, { supabaseUrl, serviceKey, adminEmails });
  if (!admin.ok) {
    return res.status(admin.status).json({ error: admin.error });
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Kit-Api-Key': apiKey,
  };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const [totalResponse, recentResponse] = await Promise.all([
      fetch('https://api.kit.com/v4/subscribers?page[size]=1', { headers }),
      fetch(`https://api.kit.com/v4/subscribers?page[size]=1&created_after=${thirtyDaysAgo}`, { headers }),
    ]);

    if (!totalResponse.ok) {
      const body = await totalResponse.text();
      console.error('Kit subscriber total error:', totalResponse.status, body);
      return res.status(502).json({ error: 'Kit API error' });
    }

    const totalData = await totalResponse.json();
    const recentData = recentResponse.ok ? await recentResponse.json() : {};

    return res.status(200).json({
      totalSubscribers: totalData.pagination?.total_count ?? 0,
      newLast30Days: recentData.pagination?.total_count ?? 0,
    });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
