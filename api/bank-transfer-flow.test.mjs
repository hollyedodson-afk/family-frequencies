import assert from 'node:assert/strict';
import test from 'node:test';

import checkoutHandler from './checkout.js';
import publishHandler from './publish-event.js';
import updateTicketHandler from './update-ticket.js';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function jsonResponse(body, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
  };
}

function withEnv(values, fn) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    process.env[key] = values[key];
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(values)) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

test('checkout reserves a pending bank transfer ticket and returns payment instructions', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/rest/v1/ff_events')) {
      return jsonResponse([{
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'first-aid-course',
        status: 'published',
        is_ticketed: true,
        price_cents: 4500,
        capacity: 20,
        tickets_sold: 4,
        ticket_sale_opens: null,
      }]);
    }

    if (String(url).includes('/rest/v1/rpc/reserve_bank_transfer_ticket')) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.p_event_id, '123e4567-e89b-12d3-a456-426614174000');
      assert.equal(payload.p_buyer_name, 'Holly Read');
      assert.equal(payload.p_buyer_email, 'holly@example.com');
      assert.equal(payload.p_quantity, 2);
      assert.equal(payload.p_amount_due_cents, 9000);
      assert.match(payload.p_reference, /^FIRSTAID-[A-Z0-9]{6}$/);
      return jsonResponse('ticket-id-1');
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    await withEnv({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      BANK_TRANSFER_INSTRUCTIONS: 'Pay 12-3456-7890123-00',
    }, async () => {
      const res = createResponse();
      await checkoutHandler({
        method: 'POST',
        body: {
          event_id: '123e4567-e89b-12d3-a456-426614174000',
          buyer_name: 'Holly Read',
          buyer_email: 'HOLLY@example.com',
          quantity: 2,
        },
      }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.payment_method, 'bank_transfer');
      assert.equal(res.body.payment_status, 'pending');
      assert.equal(res.body.ticket_id, 'ticket-id-1');
      assert.match(res.body.payment_reference, /^FIRSTAID-[A-Z0-9]{6}$/);
      assert.equal(res.body.amount_due_cents, 9000);
      assert.match(res.body.instructions, /Pay 12-3456-7890123-00/);
      assert.match(res.body.instructions, /Use reference: FIRSTAID-[A-Z0-9]{6}/);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 2);
});

test('ticketed publish no longer requires Stripe configuration', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/auth/v1/user')) {
      return jsonResponse({ email: 'holly@example.com' });
    }
    if (String(url).includes('/rest/v1/ff_events') && options.method !== 'PATCH') {
      return jsonResponse([{
        id: '123e4567-e89b-12d3-a456-426614174000',
        is_ticketed: true,
        price_cents: 4500,
      }]);
    }
    if (String(url).includes('/rest/v1/ff_events') && options.method === 'PATCH') {
      const payload = JSON.parse(options.body);
      assert.equal(payload.status, 'published');
      return jsonResponse(null);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    await withEnv({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      FF_ADMIN_EMAILS: 'holly@example.com',
    }, async () => {
      const res = createResponse();
      await publishHandler({
        method: 'POST',
        headers: { authorization: 'Bearer admin-session' },
        body: { event_id: '123e4567-e89b-12d3-a456-426614174000' },
      }, res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { payment_method: 'bank_transfer' });
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.some((call) => call.url.includes('api.stripe.com')), false);
});

test('admin can mark a bank transfer ticket as paid', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) {
      return jsonResponse({ email: 'holly@example.com' });
    }
    if (String(url).includes('/rest/v1/rpc/set_ticket_payment_status')) {
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), {
        p_ticket_id: '550e8400-e29b-41d4-a716-446655440000',
        p_status: 'paid',
      });
      return jsonResponse(null);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    await withEnv({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      FF_ADMIN_EMAILS: 'holly@example.com',
    }, async () => {
      const res = createResponse();
      await updateTicketHandler({
        method: 'POST',
        headers: { authorization: 'Bearer admin-session' },
        body: {
          ticket_id: '550e8400-e29b-41d4-a716-446655440000',
          payment_status: 'paid',
        },
      }, res);

      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body, { ok: true });
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
