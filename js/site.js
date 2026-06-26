// Fill ticker with enough copies so the track is always ≥ 2× viewport width,
// preventing blank gaps during the -50% loop. Adjusts speed to keep px/s constant.
(function fillTicker() {
  const track = document.querySelector('.ticker__track');
  if (!track) return;
  const original = track.querySelector('.ticker__set');
  if (!original) return;

  const setWidth = original.getBoundingClientRect().width;
  if (!setWidth) return;

  const needed = Math.max(2, Math.ceil((window.innerWidth * 2) / setWidth) + 2);
  const current = track.querySelectorAll('.ticker__set').length;

  for (let i = current; i < needed; i++) {
    const clone = original.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  // Keep visual speed (px/s) constant: original 24s traverses 1 set width.
  // With N sets, -50% traverses N/2 sets, so duration = (N/2) × 24s.
  const finalCount = track.querySelectorAll('.ticker__set').length;
  track.closest('.ticker').style.setProperty('--ticker-speed', `${(finalCount / 2) * 24}s`);
})();

document.querySelectorAll('[data-signup-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const note = form.parentElement.querySelector('[data-signup-note]');
    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"]');

    note.textContent = '';
    button.disabled = true;
    button.textContent = 'Sending…';

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.value }),
      });
      const data = await res.json();
      if (res.ok) {
        note.textContent = 'You\'re on the list! We\'ll be in touch.';
        form.reset();
      } else {
        note.textContent = data.error || 'Something went wrong — please try again.';
      }
    } catch {
      note.textContent = 'Something went wrong — please try again.';
    } finally {
      button.disabled = false;
      button.textContent = 'Keep me posted';
    }
  });
});
