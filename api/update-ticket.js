import { parseAdminEmails, requireAdmin } from './admin-auth.js';

const ALLOWED_STATUSES = new Set(['pending', 'paid', 'cancelled', 'refunded']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmails = parseAdminEmails(process.env.FF_ADMIN_EMAILS);

  if (!supabaseUrl || !serviceKey || adminEmails.length === 0) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const admin = await requireAdmin(req, { supabaseUrl, serviceKey, adminEmails });
  if (!admin.ok) {
    return res.status(admin.status).json({ error: admin.error });
  }

  const { ticket_id, payment_status } = req.body || {};
  if (!ticket_id || typeof ticket_id !== 'string' || !isUuid(ticket_id)) {
    return res.status(400).json({ error: 'valid ticket_id required' });
  }
  if (!ALLOWED_STATUSES.has(payment_status)) {
    return res.status(400).json({ error: 'valid payment_status required' });
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/set_ticket_payment_status`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_ticket_id: ticket_id, p_status: payment_status }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (body.includes('ticket_not_found')) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    console.error('Ticket update error:', response.status, body);
    return res.status(502).json({ error: 'Could not update ticket' });
  }

  return res.status(200).json({ ok: true });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
