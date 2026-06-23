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
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const note = form.parentElement.querySelector('[data-signup-note]');
    note.textContent = 'Thanks - sign-up will be live soon.';
  });
});
