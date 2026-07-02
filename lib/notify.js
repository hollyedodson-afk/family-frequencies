// Buyer notifications. Both helpers are no-ops until their env keys exist,
// so reservations never fail because email/mailing-list plumbing is missing.

// Adds a ticket buyer to the Kit mailing list (they're told in the privacy
// policy + confirmation email; unsubscribe is one click in Kit).
export async function addToMailingList(email) {
  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) return;

  try {
    const response = await fetch('https://api.kit.com/v4/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': apiKey,
      },
      body: JSON.stringify({ email_address: email }),
    });
    if (!response.ok) {
      console.error('Kit subscribe (ticket buyer) failed:', response.status, await response.text());
    }
  } catch (err) {
    console.error('Kit subscribe (ticket buyer) error:', err);
  }
}

// Sends a plain-text email via Resend. Requires RESEND_API_KEY and a
// verified sending domain; EMAIL_FROM overrides the default sender.
export async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Family Frequencies <hello@familyfrequencies.com>',
        to,
        subject,
        text,
      }),
    });
    if (!response.ok) {
      console.error('Resend email failed:', response.status, await response.text());
    }
  } catch (err) {
    console.error('Resend email error:', err);
  }
}

export function formatNzd(cents) {
  const amount = Number(cents || 0) / 100;
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}
