# 09 — UGC Monitor

Polls Instagram for **feed posts that tag @familyfrequencies** and pings Telegram so no UGC is missed. Compliant: it only *reads + notifies* — it does **not** auto-DM (Instagram forbids unsolicited DMs to taggers; you reply/repost manually with a Saved Reply).

## What it does
1. Every 30 min → `GET /{IG_USER_ID}/tags` (Graph API v21.0) using the existing `IG_ACCESS_TOKEN` / `IG_USER_ID` env.
2. Dedupes against previously-seen media ids (workflow static data).
3. For each new tagged post → Telegram summary (author, caption snippet, permalink) to chat `8770824903`.

## Activate
1. Import `09-ugc-monitor.json` into n8n.
2. Set the Telegram credential (same "Telegram Bot - FF Social" as the other workflows) — the import has a placeholder id.
3. Run once manually to test.
4. If it returns posts (or an empty `data` array) → set **active: true**.

## Scope caveat (may need a 5-min Meta fix)
The `/tags` edge needs the token to have **`instagram_manage_comments`** (in addition to the publishing scopes it already has), on an IG **Business/Creator** account linked to a Facebook Page.
- If the test run errors with a permissions/`#10`/`#100` message → open the Meta app, add `instagram_manage_comments`, regenerate the long-lived `IG_ACCESS_TOKEN`, update the env, retest.

## Known limits (v1)
- Catches **feed-post user tags**. Does **not** catch Story @mentions (ephemeral, needs the mentions webhook) or caption-only @mentions with no user tag — those are a v1.1 webhook add.
- Notify-only. Repost permission + saving to the UGC bank is manual (by design / IG rules).

## Zero-build safety net (do this regardless, covers today)
- Turn on tag/mention push notifications on the FF Instagram.
- Create an Instagram **Saved Reply**: *"Ahh we love this! 💛 Totally made our day. Ok if we share it to our story/feed and tag you? x"*
- Make a "UGC bank" folder (Drive/Photos) to drop approved clips into for Thursday features.
