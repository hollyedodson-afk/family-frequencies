import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseStripeSignature(signatureHeader) {
  return signatureHeader.split(',').reduce((acc, part) => {
    const index = part.indexOf('=');
    const key = part.slice(0, index);
    const value = part.slice(index + 1);
    if (key === 'v1') {
      acc.signatures.push(value);
    } else if (key === 't') {
      acc.timestamp = value;
    }
    return acc;
  }, { timestamp: null, signatures: [] });
}

export function verifyStripeSignature(rawBody, signatureHeader, secret) {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (Number.isNaN(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  return signatures.some((signature) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const signatureHeader = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!signatureHeader || !secret || !supabaseUrl || !serviceKey) {
    console.error('Missing Stripe webhook or Supabase server configuration');
    return res.status(400).json({ error: 'Invalid request' });
  }

  const bodyText = rawBody.toString('utf8');
  if (!verifyStripeSignature(bodyText, signatureHeader, secret)) {
    console.error('Stripe webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(bodyText);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).end();
  }

  const session = event.data?.object;
  if (!session || session.payment_status !== 'paid') {
    return res.status(200).end();
  }

  const eventId = session.metadata?.event_id;
  const quantity = Number.parseInt(session.metadata?.quantity || '1', 10);
  const buyerName = session.customer_details?.name || 'Unknown';
  const buyerEmail = session.customer_details?.email || '';
  const amountPaid = session.amount_total || 0;

  if (!eventId) {
    console.error('No event_id in webhook metadata. Session:', session.id);
    return res.status(200).end();
  }

  try {
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/record_ticket`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_event_id: eventId,
        p_session_id: session.id,
        p_buyer_name: buyerName,
        p_buyer_email: buyerEmail,
        p_quantity: Number.isNaN(quantity) ? 1 : quantity,
        p_amount_paid_cents: amountPaid,
      }),
    });

    if (!rpcResponse.ok) {
      const body = await rpcResponse.text();
      if (body.includes('sold_out')) {
        console.error('SOLD OUT AFTER PAYMENT - manual refund needed. Session:', session.id, 'Event:', eventId);
      } else {
        console.error('record_ticket RPC error:', rpcResponse.status, body);
        return res.status(500).end();
      }
    }
  } catch (err) {
    console.error('Webhook handler DB error:', err);
    return res.status(500).end();
  }

  return res.status(200).end();
}
