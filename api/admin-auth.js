export function parseAdminEmails(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email, adminEmails) {
  return adminEmails.includes(String(email || '').toLowerCase());
}

export async function requireAdmin(req, { supabaseUrl, serviceKey, adminEmails }) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  if (!supabaseUrl || !serviceKey || !adminEmails?.length) {
    return { ok: false, status: 500, error: 'Server configuration error' };
  }

  const jwt = authHeader.slice(7);
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!userResponse.ok) {
    return { ok: false, status: 401, error: 'Invalid session' };
  }

  const user = await userResponse.json();
  if (!isAdminEmail(user.email, adminEmails)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, user };
}
