import { addToMailingList, formatNzd, sendEmail } from '../lib/notify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event_id, quantity = 1, buyer_name, buyer_email } = req.body || {};

  if (!event_id || typeof event_id !== 'string' || !isUuid(event_id)) {
    return res.status(400).json({ error: 'valid event_id required' });
  }

  const qty = Number.parseInt(quantity, 10);
  if (Number.isNaN(qty) || qty < 1 || qty > 10) {
    return res.status(400).json({ error: 'quantity must be between 1 and 10' });
  }

  const buyerName = String(buyer_name || '').trim();
  const buyerEmail = String(buyer_email || '').trim().toLowerCase();
  if (!buyerName) {
    return res.status(400).json({ error: 'buyer_name required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return res.status(400).json({ error: 'valid buyer_email required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let event;
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/ff_events?id=eq.${encodeURIComponent(event_id)}&select=*&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
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
  if (event.ticket_sale_opens && new Date(event.ticket_sale_opens) > new Date()) {
    return res.status(400).json({ error: 'Ticket sales are not open yet' });
  }

  if (event.capacity !== null && event.capacity !== undefined && (event.tickets_sold + qty) > event.capacity) {
    return res.status(400).json({ error: 'Not enough spots remaining' });
  }

  try {
    const reference = makePaymentReference(event.slug);
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_bank_transfer_ticket`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_event_id: event.id,
        p_buyer_name: buyerName,
        p_buyer_email: buyerEmail,
        p_quantity: qty,
        p_amount_due_cents: Number(event.price_cents || 0) * qty,
        p_reference: reference,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (body.includes('sold_out')) {
        return res.status(400).json({ error: 'Not enough spots remaining' });
      }
      console.error('Bank transfer reservation error:', response.status, body);
      return res.status(502).json({ error: 'Could not reserve ticket' });
    }

    const ticketId = await response.json();
    const amountDueCents = Number(event.price_cents || 0) * qty;
    const instructions = buildBankTransferInstructions(reference);

    // Both are no-ops without their env keys and never fail the reservation.
    await Promise.allSettled([
      addToMailingList(buyerEmail),
      sendEmail({
        to: buyerEmail,
        subject: `Spot reserved — ${event.title}`,
        text: [
          `Kia ora ${buyerName},`,
          '',
          `Your spot at ${event.title} is reserved (${qty} ${qty === 1 ? 'spot' : 'spots'}).`,
          '',
          `To confirm, pay ${formatNzd(amountDueCents)} by bank transfer:`,
          instructions,
          '',
          `Payment reference: ${reference}`,
          '',
          "We'll email you again once your payment is matched. If anything changes, reply to this email or contact hello@familyfrequencies.com.",
          '',
          'Family Frequencies',
          'https://familyfrequencies.com',
        ].join('\n'),
      }),
    ]);

    return res.status(200).json({
      payment_method: 'bank_transfer',
      payment_status: 'pending',
      ticket_id: ticketId,
      payment_reference: reference,
      amount_due_cents: amountDueCents,
      instructions,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function makePaymentReference(slug) {
  const prefix = String(slug || 'ff')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toUpperCase() || 'FF';
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

function buildBankTransferInstructions(reference) {
  const instructions = String(process.env.BANK_TRANSFER_INSTRUCTIONS || '').trim();
  if (instructions) {
    return `${instructions}\nUse reference: ${reference}`;
  }
  return `Please pay by bank transfer and use reference: ${reference}`;
}
