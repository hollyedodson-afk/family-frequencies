export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildEventPayload(fields, now = new Date().toISOString()) {
  const isTicketed = Boolean(fields.is_ticketed);

  return {
    title: cleanRequired(fields.title),
    slug: slugify(fields.slug),
    event_date: cleanRequired(fields.event_date),
    time_start: cleanOptional(fields.time_start),
    time_end: cleanOptional(fields.time_end),
    venue: cleanRequired(fields.venue),
    description: cleanOptional(fields.description),
    image_url: cleanOptional(fields.image_url),
    detail_url: cleanOptional(fields.detail_url),
    chips: parseChips(fields.chips),
    status: fields.status || 'draft',
    is_ticketed: isTicketed,
    price_cents: isTicketed ? parsePriceCents(fields.price_nzd) : null,
    capacity: isTicketed ? parseCapacity(fields.capacity) : null,
    ticket_sale_opens: isTicketed ? cleanOptional(fields.ticket_sale_opens) : null,
    updated_at: now,
  };
}

export function remainingSpots(event) {
  if (event.capacity === null || event.capacity === undefined) {
    return null;
  }

  return Math.max(0, Number(event.capacity || 0) - Number(event.tickets_sold || 0));
}

export function soldRatio(event) {
  if (!event.capacity) {
    return 0;
  }

  return Math.min(100, Math.round((Number(event.tickets_sold || 0) / Number(event.capacity)) * 100));
}

export function formatMoney(cents) {
  const amount = Number(cents || 0) / 100;
  return amount % 1 === 0 ? `$${amount.toFixed(0)}` : `$${amount.toFixed(2)}`;
}

export function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function serializeAttendeesCsv(tickets) {
  const rows = tickets.map((ticket) => [
    ticket.buyer_name,
    ticket.buyer_email,
    ticket.quantity,
    ticket.ticket_type,
    formatMoney(ticket.amount_paid_cents),
    ticket.created_at,
  ].map(csvEscape).join(','));

  return ['name,email,quantity,ticket_type,amount_paid,purchased_at', ...rows].join('\n');
}

function cleanRequired(value) {
  return String(value || '').trim();
}

function cleanOptional(value) {
  const text = String(value || '').trim();
  return text || null;
}

function parseChips(value) {
  return String(value || '')
    .split(',')
    .map((chip) => chip.trim())
    .filter(Boolean);
}

function parsePriceCents(value) {
  const amount = Number.parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Math.round(amount * 100);
}

function parseCapacity(value) {
  const capacity = Number.parseInt(value, 10);
  if (!Number.isFinite(capacity) || capacity < 1) {
    return null;
  }
  return capacity;
}
