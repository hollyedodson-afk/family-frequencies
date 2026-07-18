// FF Scheduler watchdog — checks that n8n can actually reach its database
// (the /api/v1 endpoint requires a live DB, unlike /healthz) AND that the
// WF02 scheduler's latest execution succeeded (a dead Google credential
// leaves the API healthy while every run errors — 9 days silent, 2026-07-18).
// Alerts Holly's Telegram when either goes down or recovers.
const N8N_URL = process.env.N8N_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const WF02_ID = process.env.WF02_ID || "kvzflHAPKj6y9EJo";
const CHECK_MS = 60_000;
const FAILS_BEFORE_ALERT = 3;
const REALERT_MS = 30 * 60_000;

let fails = 0;
let downSince = null;
let lastAlert = 0;

async function tg(text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text }),
    });
  } catch (e) {
    console.error("telegram send failed:", e.message);
  }
}

async function check() {
  let ok = false, detail = "";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(`${N8N_URL}/api/v1/workflows?limit=1`, {
      headers: { "X-N8N-API-KEY": N8N_API_KEY },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    detail = `HTTP ${res.status}`;
    ok = res.status === 200;
  } catch (e) {
    detail = e.name === "AbortError" ? "timeout after 20s" : e.message;
  }

  // API is up — but is the scheduler actually succeeding? Best-effort check:
  // never turns a healthy API into a failure on its own errors.
  if (ok) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20_000);
      const res = await fetch(
        `${N8N_URL}/api/v1/executions?workflowId=${WF02_ID}&limit=1`,
        { headers: { "X-N8N-API-KEY": N8N_API_KEY }, signal: ctrl.signal }
      );
      clearTimeout(t);
      if (res.status === 200) {
        const latest = (await res.json())?.data?.[0];
        if (latest?.status === "error") {
          ok = false;
          detail = `WF02 latest execution ERRORED (${latest.startedAt}) — n8n is up but posts are failing; likely a credential (open n8n → Credentials → reconnect Google)`;
        }
      }
    } catch {}
  }

  if (ok) {
    if (downSince) {
      const mins = Math.round((Date.now() - downSince) / 60_000);
      await tg(`✅ FF Scheduler is BACK UP (was down ~${mins} min). Missed posts will auto-post on the next 15-min tick.`);
    }
    fails = 0;
    downSince = null;
    return;
  }

  fails++;
  console.log(`check failed (${fails}): ${detail}`);
  if (fails < FAILS_BEFORE_ALERT) return;
  if (!downSince) downSince = Date.now();
  if (Date.now() - lastAlert < REALERT_MS) return;
  lastAlert = Date.now();
  const mins = Math.round((Date.now() - downSince) / 60_000);
  await tg(
    `🚨 FF Scheduler is DOWN (${detail}, ~${mins} min).\n` +
    `Posts will NOT go out until it's fixed.\n\n` +
    `Fix from the family-frequencies folder:\n` +
    `railway redeploy --service Postgres -y\n` +
    `railway redeploy --service n8n -y\n\n` +
    `(or ask Claude to fix it — it has the playbook)`
  );
}

console.log("FF watchdog started, checking every", CHECK_MS / 1000, "s");
setInterval(check, CHECK_MS);
check();
