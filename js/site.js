document.querySelectorAll('[data-signup-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const note = form.parentElement.querySelector('[data-signup-note]');
    note.textContent = 'Thanks - sign-up will be live soon.';
  });
});
