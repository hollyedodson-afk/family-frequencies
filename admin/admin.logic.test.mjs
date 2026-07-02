import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEventPayload,
  csvEscape,
  formatMoney,
  remainingSpots,
  serializeAttendeesCsv,
  slugify,
} from './admin.logic.js';

test('slugify creates URL-safe event slugs', () => {
  assert.equal(slugify('First Aid Course: Mount Maunganui!'), 'first-aid-course-mount-maunganui');
});

test('buildEventPayload converts admin form fields into Supabase event data', () => {
  const payload = buildEventPayload({
    title: 'First Aid Course',
    slug: 'first-aid-course',
    event_date: '2026-08-01',
    time_start: '10:00',
    time_end: '',
    venue: 'Hide',
    description: 'Practical first aid for families',
    image_url: '',
    detail_url: '',
    chips: 'Ticketed, All ages',
    sponsor_logos: 'https://res.cloudinary.com/demo/logo-a.png\nnot-a-url\nhttps://res.cloudinary.com/demo/logo-b.png',
    status: 'draft',
    is_ticketed: true,
    price_nzd: '45.00',
    capacity: '20',
    ticket_sale_opens: '',
  }, '2026-06-30T00:00:00.000Z');

  assert.deepEqual(payload, {
    title: 'First Aid Course',
    slug: 'first-aid-course',
    event_date: '2026-08-01',
    time_start: '10:00',
    time_end: null,
    venue: 'Hide',
    description: 'Practical first aid for families',
    image_url: null,
    detail_url: null,
    chips: ['Ticketed', 'All ages'],
    sponsor_logos: ['https://res.cloudinary.com/demo/logo-a.png', 'https://res.cloudinary.com/demo/logo-b.png'],
    status: 'draft',
    is_ticketed: true,
    price_cents: 4500,
    capacity: 20,
    ticket_sale_opens: null,
    updated_at: '2026-06-30T00:00:00.000Z',
  });
});

test('buildEventPayload clears ticketing fields for free events', () => {
  const payload = buildEventPayload({
    title: 'Daylight Disco',
    slug: 'daylight-disco',
    event_date: '2026-07-04',
    time_start: '',
    time_end: '',
    venue: 'Hide',
    description: '',
    image_url: '',
    detail_url: 'daylight-disco',
    chips: 'Free entry',
    status: 'published',
    is_ticketed: false,
    price_nzd: '45.00',
    capacity: '20',
    ticket_sale_opens: '2026-07-01T09:00',
  }, '2026-06-30T00:00:00.000Z');

  assert.equal(payload.is_ticketed, false);
  assert.equal(payload.price_cents, null);
  assert.equal(payload.capacity, null);
  assert.equal(payload.ticket_sale_opens, null);
});

test('remainingSpots handles finite and unlimited capacity', () => {
  assert.equal(remainingSpots({ capacity: 20, tickets_sold: 8 }), 12);
  assert.equal(remainingSpots({ capacity: null, tickets_sold: 8 }), null);
  assert.equal(remainingSpots({ capacity: 10, tickets_sold: 12 }), 0);
});

test('formatMoney renders cents as NZD dollars', () => {
  assert.equal(formatMoney(4500), '$45');
  assert.equal(formatMoney(4550), '$45.50');
});

test('csvEscape quotes commas and quotes', () => {
  assert.equal(csvEscape('Read, Holly "FF"'), '"Read, Holly ""FF"""');
});

test('serializeAttendeesCsv exports attendee rows', () => {
  const csv = serializeAttendeesCsv([
    {
      buyer_name: 'Holly Read',
      buyer_email: 'holly@example.com',
      quantity: 2,
      ticket_type: 'general',
      payment_method: 'bank_transfer',
      payment_status: 'pending',
      payment_reference: 'FIRSTAID-ABC123',
      amount_paid_cents: 9000,
      created_at: '2026-07-01T10:00:00.000Z',
    },
  ]);

  assert.equal(
    csv,
    'name,email,quantity,ticket_type,payment_method,payment_status,payment_reference,amount_due,purchased_at\nHolly Read,holly@example.com,2,general,bank_transfer,pending,FIRSTAID-ABC123,$90,2026-07-01T10:00:00.000Z'
  );
});
