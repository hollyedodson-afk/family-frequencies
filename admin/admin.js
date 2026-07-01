import {
  buildEventPayload,
  formatMoney,
  remainingSpots,
  serializeAttendeesCsv,
  slugify,
  soldRatio,
} from './admin.logic.js';

const state = {
  sb: null,
  session: null,
  events: [],
  tickets: [],
  selectedEventId: null,
  statsLoaded: false,
};

const els = {
  loginView: document.getElementById('view-login'),
  dashboardView: document.getElementById('view-dashboard'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  logout: document.getElementById('btn-logout'),
  eventList: document.getElementById('event-list-admin'),
  eventCount: document.getElementById('event-count'),
  addEvent: document.getElementById('btn-add-event'),
  eventFormWrap: document.getElementById('event-form-wrap'),
  eventForm: document.getElementById('event-form'),
  eventFormTitle: document.getElementById('event-form-title'),
  closeForm: document.getElementById('btn-close-form'),
  saveEvent: document.getElementById('btn-save-event'),
  publishEvent: document.getElementById('btn-publish-event'),
  deleteEvent: document.getElementById('btn-delete-event'),
  ticketFields: document.getElementById('ticket-fields'),
  paymentStatus: document.getElementById('payment-status'),
  formError: document.getElementById('form-error'),
  formSuccess: document.getElementById('form-success'),
  attendeeEventList: document.getElementById('attendee-event-list'),
  attendeesDetail: document.getElementById('attendees-detail'),
  exportCsv: document.getElementById('btn-export-csv'),
  statsContent: document.getElementById('stats-content'),
};

init().catch((err) => {
  console.error(err);
  els.loginError.textContent = 'Admin failed to start. Check backend configuration.';
});

async function init() {
  const config = await loadConfig();
  const { createClient } = window.supabase;
  state.sb = createClient(config.supabaseUrl, config.supabaseAnonKey);

  const { data: { session } } = await state.sb.auth.getSession();
  state.session = session;
  bindEvents();
  session ? await showDashboard() : showLogin();

  state.sb.auth.onAuthStateChange(async (_event, sessionUpdate) => {
    state.session = sessionUpdate;
    sessionUpdate ? await showDashboard() : showLogin();
  });
}

async function loadConfig() {
  const response = await fetch('/api/admin-config');
  if (!response.ok) {
    throw new Error('Could not load admin config');
  }
  return response.json();
}

function bindEvents() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.logout.addEventListener('click', () => state.sb.auth.signOut());
  els.addEvent.addEventListener('click', () => openForm(null));
  els.closeForm.addEventListener('click', closeForm);
  els.eventForm.addEventListener('submit', handleSaveEvent);
  els.deleteEvent.addEventListener('click', handleDeleteEvent);
  els.publishEvent.addEventListener('click', handlePublishEvent);
  els.eventForm.elements.title.addEventListener('input', handleTitleInput);
  els.eventForm.elements.is_ticketed.addEventListener('change', updateTicketingVisibility);
  els.exportCsv.addEventListener('click', exportAttendeesCsv);

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });
}

async function handleLogin(event) {
  event.preventDefault();
  els.loginError.textContent = '';
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const { error } = await state.sb.auth.signInWithPassword({ email, password });
  if (error) {
    els.loginError.textContent = error.message;
  }
}

function showLogin() {
  els.loginView.hidden = false;
  els.dashboardView.hidden = true;
}

async function showDashboard() {
  els.loginView.hidden = true;
  els.dashboardView.hidden = false;
  await loadEvents();
  const initialTab = tabFromHash();
  if (initialTab !== 'events') {
    await activateTab(initialTab);
  }
}

async function activateTab(tabName) {
  const target = document.getElementById(`tab-${tabName}`) ? tabName : 'events';
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === target);
  });
  document.querySelectorAll('.workspace').forEach((panel) => {
    panel.hidden = panel.id !== `tab-${target}`;
  });

  if (target === 'attendees') {
    renderAttendeeEventList();
  }
  if (target === 'stats' && !state.statsLoaded) {
    await loadStats();
  }

  if (window.location.hash.slice(1) !== target) {
    window.history.replaceState(null, '', `#${target}`);
  }
}

function tabFromHash() {
  const value = window.location.hash.slice(1);
  return document.getElementById(`tab-${value}`) ? value : 'events';
}

async function loadEvents() {
  els.eventList.innerHTML = '<p class="empty-state">Loading events...</p>';
  const { data, error } = await state.sb.from('ff_events').select('*').order('event_date', { ascending: true });

  if (error) {
    els.eventList.innerHTML = '<p class="empty-state">Could not load events.</p>';
    console.error(error);
    return;
  }

  state.events = data || [];
  els.eventCount.textContent = String(state.events.length);
  renderEvents();
  renderAttendeeEventList();
}

function renderEvents() {
  if (!state.events.length) {
    els.eventList.innerHTML = '<p class="empty-state">No events yet.</p>';
    return;
  }

  els.eventList.innerHTML = state.events.map((event) => `
    <article class="event-row">
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        <p class="event-meta">${escapeHtml(event.event_date)} · ${escapeHtml(event.venue || '')}</p>
        <span class="pill pill-${event.status}">${escapeHtml(event.status)}</span>
        ${event.is_ticketed ? `<span class="pill pill-ticketed">${formatMoney(event.price_cents)} · ${spotsLabel(event)}</span>` : ''}
      </div>
      <div class="event-actions">
        <button class="mini-btn" type="button" data-action="edit" data-id="${event.id}">Edit</button>
        ${event.is_ticketed ? `<button class="mini-btn" type="button" data-action="attendees" data-id="${event.id}">Attendees</button>` : ''}
      </div>
    </article>
  `).join('');

  els.eventList.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => openForm(findEvent(button.dataset.id)));
  });
  els.eventList.querySelectorAll('[data-action="attendees"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await activateTab('attendees');
      await selectAttendeeEvent(button.dataset.id);
    });
  });
}

function openForm(event) {
  clearFormMessages();
  els.eventForm.reset();
  els.eventForm.elements.id.value = event?.id || '';
  els.eventFormTitle.textContent = event ? 'Edit event' : 'New event';
  els.deleteEvent.hidden = !event;
  els.publishEvent.hidden = !event;

  if (event) {
    els.eventForm.elements.title.value = event.title || '';
    els.eventForm.elements.slug.value = event.slug || '';
    els.eventForm.elements.event_date.value = event.event_date || '';
    els.eventForm.elements.time_start.value = event.time_start || '';
    els.eventForm.elements.time_end.value = event.time_end || '';
    els.eventForm.elements.venue.value = event.venue || '';
    els.eventForm.elements.status.value = event.status || 'draft';
    els.eventForm.elements.description.value = event.description || '';
    els.eventForm.elements.image_url.value = event.image_url || '';
    els.eventForm.elements.detail_url.value = event.detail_url || '';
    els.eventForm.elements.chips.value = (event.chips || []).join(', ');
    els.eventForm.elements.is_ticketed.checked = Boolean(event.is_ticketed);
    els.eventForm.elements.price_nzd.value = event.price_cents ? String(event.price_cents / 100) : '';
    els.eventForm.elements.capacity.value = event.capacity || '';
    els.eventForm.elements.ticket_sale_opens.value = toDatetimeLocal(event.ticket_sale_opens);
    els.paymentStatus.textContent = event.is_ticketed ? 'Manual bank transfer reservations are active when published.' : '';
  } else {
    els.eventForm.elements.status.value = 'draft';
    els.paymentStatus.textContent = '';
  }

  updateTicketingVisibility();
  els.eventFormWrap.hidden = false;
}

function closeForm() {
  els.eventFormWrap.hidden = true;
  clearFormMessages();
}

function handleTitleInput(event) {
  if (!els.eventForm.elements.id.value) {
    els.eventForm.elements.slug.value = slugify(event.target.value);
  }
}

function updateTicketingVisibility() {
  els.ticketFields.hidden = !els.eventForm.elements.is_ticketed.checked;
}

async function handleSaveEvent(event) {
  event.preventDefault();
  clearFormMessages();
  setBusy(els.saveEvent, true, 'Saving...');

  const id = els.eventForm.elements.id.value;
  const payload = buildEventPayload(Object.fromEntries(new FormData(els.eventForm)), new Date().toISOString());
  payload.is_ticketed = els.eventForm.elements.is_ticketed.checked;
  if (!payload.is_ticketed) {
    payload.price_cents = null;
    payload.capacity = null;
    payload.ticket_sale_opens = null;
  }

  let result;
  if (id) {
    result = await state.sb.from('ff_events').update(payload).eq('id', id);
  } else {
    result = await state.sb.from('ff_events').insert(payload).select().single();
  }

  setBusy(els.saveEvent, false, 'Save event');

  if (result.error) {
    els.formError.textContent = result.error.message;
    return;
  }

  await loadEvents();
  if (!id && result.data) {
    openForm(findEvent(result.data.id));
    els.formSuccess.textContent = 'Saved as draft. Publish when ready.';
  } else {
    els.formSuccess.textContent = 'Saved.';
  }
}

async function handleDeleteEvent() {
  const id = els.eventForm.elements.id.value;
  if (!id || !confirm('Delete this event?')) {
    return;
  }

  clearFormMessages();
  const { error } = await state.sb.from('ff_events').delete().eq('id', id);
  if (error) {
    els.formError.textContent = error.message;
    return;
  }
  closeForm();
  await loadEvents();
}

async function handlePublishEvent() {
  const id = els.eventForm.elements.id.value;
  if (!id) {
    return;
  }

  clearFormMessages();
  setBusy(els.publishEvent, true, 'Publishing...');

  try {
    await saveCurrentForm(id);
    await loadEvents();
    const event = findEvent(id);
    if (!event) {
      throw new Error('Event not found after save');
    }

    if (!event.is_ticketed) {
      const { error } = await state.sb.from('ff_events').update({
        status: 'published',
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    } else {
      const response = await fetch('/api/publish-event', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_id: id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Publish failed');
      }
    }

    els.formSuccess.textContent = 'Published.';
    await loadEvents();
    openForm(findEvent(id));
  } catch (err) {
    els.formError.textContent = err.message || 'Publish failed';
  } finally {
    setBusy(els.publishEvent, false, 'Publish');
  }
}

async function saveCurrentForm(id) {
  const payload = buildEventPayload(Object.fromEntries(new FormData(els.eventForm)), new Date().toISOString());
  payload.is_ticketed = els.eventForm.elements.is_ticketed.checked;
  if (!payload.is_ticketed) {
    payload.price_cents = null;
    payload.capacity = null;
    payload.ticket_sale_opens = null;
  }

  const { error } = await state.sb.from('ff_events').update(payload).eq('id', id);
  if (error) {
    throw error;
  }
}

function renderAttendeeEventList() {
  const ticketed = state.events.filter((event) => event.is_ticketed);
  if (!ticketed.length) {
    els.attendeeEventList.innerHTML = '<p class="empty-state">No ticketed events yet.</p>';
    return;
  }

  els.attendeeEventList.innerHTML = ticketed.map((event) => `
    <article class="event-row">
      <div>
        <strong>${escapeHtml(event.title)}</strong>
        <p class="event-meta">${escapeHtml(spotsLabel(event))}</p>
      </div>
      <div class="event-actions">
        <button class="mini-btn" type="button" data-id="${event.id}">View</button>
      </div>
    </article>
  `).join('');

  els.attendeeEventList.querySelectorAll('button[data-id]').forEach((button) => {
    button.addEventListener('click', () => selectAttendeeEvent(button.dataset.id));
  });
}

async function selectAttendeeEvent(eventId) {
  state.selectedEventId = eventId;
  const event = findEvent(eventId);
  if (!event) return;

  els.attendeesDetail.innerHTML = '<p class="empty-state">Loading attendees...</p>';
  els.exportCsv.disabled = true;

  const { data, error } = await state.sb
    .from('ff_tickets')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    els.attendeesDetail.innerHTML = '<p class="empty-state">Could not load attendees.</p>';
    console.error(error);
    return;
  }

  state.tickets = data || [];
  els.exportCsv.disabled = state.tickets.length === 0;
  renderAttendees(event, state.tickets);
}

function renderAttendees(event, tickets) {
  const ratio = soldRatio(event);
  const rows = tickets.map((ticket) => `
    <tr>
      <td>${escapeHtml(ticket.buyer_name)}</td>
      <td>${escapeHtml(ticket.buyer_email)}</td>
      <td>${ticket.quantity}</td>
      <td>${escapeHtml(ticket.payment_reference || '')}</td>
      <td>${formatMoney(ticket.amount_paid_cents)}</td>
      <td><span class="pill pill-${escapeHtml(ticket.payment_status || 'pending')}">${escapeHtml(ticket.payment_status || 'pending')}</span></td>
      <td>${formatDateTime(ticket.created_at)}</td>
      <td>
        ${ticket.payment_status === 'pending' ? `<button class="mini-btn" type="button" data-ticket-paid="${ticket.id}">Mark paid</button>` : ''}
        ${['pending', 'paid'].includes(ticket.payment_status) ? `<button class="mini-btn mini-btn-danger" type="button" data-ticket-cancel="${ticket.id}">Cancel</button>` : ''}
      </td>
    </tr>
  `).join('');

  els.attendeesDetail.innerHTML = `
    <div class="panel-head">
      <div>
        <h3>${escapeHtml(event.title)}</h3>
        <p class="event-meta">${escapeHtml(spotsLabel(event))}</p>
      </div>
    </div>
    <div class="event-list">
      <div class="capacity">
        <div class="capacity-track"><div class="capacity-fill" style="width:${ratio}%"></div></div>
      </div>
      ${tickets.length ? `
        <table class="attendee-table">
          <thead><tr><th>Name</th><th>Email</th><th>Qty</th><th>Reference</th><th>Due</th><th>Status</th><th>Reserved</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      ` : '<p class="empty-state">No attendees yet.</p>'}
    </div>
  `;

  els.attendeesDetail.querySelectorAll('[data-ticket-paid]').forEach((button) => {
    button.addEventListener('click', () => updateTicketPaymentStatus(button.dataset.ticketPaid, 'paid'));
  });
  els.attendeesDetail.querySelectorAll('[data-ticket-cancel]').forEach((button) => {
    button.addEventListener('click', () => {
      if (confirm('Cancel this ticket? Their spot goes back on sale.')) {
        updateTicketPaymentStatus(button.dataset.ticketCancel, 'cancelled');
      }
    });
  });
}

async function updateTicketPaymentStatus(ticketId, paymentStatus) {
  const response = await fetch('/api/update-ticket', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ticket_id: ticketId, payment_status: paymentStatus }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    alert(body.error || 'Could not update ticket');
    return;
  }

  await selectAttendeeEvent(state.selectedEventId);
  await loadEvents();
}

function exportAttendeesCsv() {
  if (!state.tickets.length) return;
  const csv = serializeAttendeesCsv(state.tickets);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const event = findEvent(state.selectedEventId);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(event?.title || 'attendees')}-attendees.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadStats() {
  els.statsContent.innerHTML = '<p class="empty-state">Loading stats...</p>';
  try {
    const response = await fetch('/api/stats', {
      headers: {
        Authorization: `Bearer ${state.session.access_token}`,
      },
    });
    if (!response.ok) throw new Error('Stats unavailable');
    const stats = await response.json();
    state.statsLoaded = true;
    els.statsContent.innerHTML = `
      <article class="stat-card"><span class="stat-value">${stats.totalSubscribers}</span><span class="stat-label">Total subscribers</span></article>
      <article class="stat-card"><span class="stat-value">${stats.newLast30Days}</span><span class="stat-label">New in last 30 days</span></article>
    `;
  } catch (err) {
    els.statsContent.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
  }
}

function findEvent(id) {
  return state.events.find((event) => event.id === id);
}

function spotsLabel(event) {
  const remaining = remainingSpots(event);
  if (remaining === null) {
    return `${Number(event.tickets_sold || 0)} sold · unlimited`;
  }
  return `${Number(event.tickets_sold || 0)} / ${event.capacity} sold · ${remaining} remaining`;
}

function clearFormMessages() {
  els.formError.textContent = '';
  els.formSuccess.textContent = '';
}

function setBusy(button, busy, text) {
  button.disabled = busy;
  button.textContent = text;
}

function toDatetimeLocal(value) {
  if (!value) return '';
  return String(value).slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-NZ', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
