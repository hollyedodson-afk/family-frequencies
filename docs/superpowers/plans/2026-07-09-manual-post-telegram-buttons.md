# Manual Post Telegram Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Family Frequencies schedule manual social posts, send Holly a Telegram packet when they are due, and update the Sheet to `posted` when Holly taps a Telegram `Posted` button.

**Architecture:** Add a `manual_post` field to scheduler payloads and Sheet rows. WF02 detects due manual posts before auto-posting, sends a Telegram message with copy-ready media/caption/details plus an inline `Posted` button, then marks the row `manual_sent`. WF08 accepts Telegram callback queries and updates the row status to `posted`.

**Tech Stack:** n8n workflow JSON exports, Google Sheets node, Telegram node/trigger, vanilla scheduler UI, Node-based workflow structure tests.

---

### Task 1: Add Workflow Regression Coverage

**Files:**
- Modify: `projects/family-frequencies/social-scheduler/workflows/02-scheduler.test.mjs`
- Create: `projects/family-frequencies/social-scheduler/workflows/08-telegram-reply.test.mjs`

- [ ] **Step 1: Extend the WF02 test**

Add assertions that WF02 includes `Is Manual Post?`, `Telegram - Manual Post`, and `Mark manual_sent`, and that the manual branch runs before `Needs Music?`.

- [ ] **Step 2: Add the WF08 test**

Create a test that requires `Telegram Trigger` to listen for `callback_query`, checks `Extract Callback` parses `manual_posted:<id>`, and verifies callback posts update the Sheet row by `id` to `status=posted` with `posted_at`.

- [ ] **Step 3: Run tests and verify they fail**

Run the two `.mjs` tests. WF02 should fail because manual nodes do not exist. WF08 should fail because callbacks are not handled yet.

### Task 2: Patch WF02 Manual Notification Path

**Files:**
- Modify: `projects/family-frequencies/social-scheduler/workflows/02-scheduler.json`

- [ ] **Step 1: Add `Is Manual Post?` after `Has Caption?`**

Normalize with `String($json.manual_post).toLowerCase() === "true"` so boolean and string values both work.

- [ ] **Step 2: Add Telegram manual notification**

Send a Telegram message containing type, scheduled time, media URL, caption, notes, and row id. Include inline keyboard button text `Posted` with callback data `manual_posted:<id>`.

- [ ] **Step 3: Mark row `manual_sent`**

Update the Sheet by `id`, setting `status=manual_sent`, preserving the returned `telegram_msg_id`, and leaving the row ready for WF08 callback completion.

### Task 3: Patch WF08 Posted Button Handler

**Files:**
- Modify: `projects/family-frequencies/social-scheduler/workflows/08-telegram-reply.json`

- [ ] **Step 1: Enable callback updates**

Change the Telegram trigger to listen to both `message` and `callback_query`.

- [ ] **Step 2: Route callback updates first**

Add a callback branch that detects `callback_query.data` starting with `manual_posted:`.

- [ ] **Step 3: Mark manual post posted**

Extract the row id from callback data, update the Sheet by `id` to `status=posted` and `posted_at=$now.toISO()`, then send a confirmation message back to the Telegram chat.

### Task 4: Add Scheduler UI Field

**Files:**
- Modify: `projects/family-frequencies/social-scheduler/ui/index.html`

- [ ] **Step 1: Normalize `manual_post`**

Read boolean/string `manual_post` values into post state.

- [ ] **Step 2: Add manual-post checkboxes**

Add a checkbox to the inspector and new-post drawer labelled `Manual post reminder`.

- [ ] **Step 3: Include manual flag in submit/update payloads**

Send `manual_post` through WF01 and WF06. Add a small visible cue in the inspector/queue so manual posts are identifiable.

### Task 5: Patch Submit/Update Workflow Mappings

**Files:**
- Modify: `projects/family-frequencies/social-scheduler/workflows/01-submit-post.json`
- Modify: `projects/family-frequencies/social-scheduler/workflows/06-update-post.json`

- [ ] **Step 1: Add `manual_post` to new rows**

Prepare row should set `manual_post` from webhook body as `"true"` or `"false"`.

- [ ] **Step 2: Add `manual_post` to updates**

WF06 update should write the incoming `manual_post` value back to the Sheet.

### Task 6: Verify and Deploy

**Files:**
- Modify: `projects/family-frequencies/social-scheduler/workflows/update-live-wf02.mjs`
- Create: `projects/family-frequencies/social-scheduler/workflows/update-live-wf08.mjs`

- [ ] **Step 1: Verify local workflow tests pass**

Run WF02/WF08 tests from Node.

- [ ] **Step 2: Push WF02 and WF08 live**

Run updater scripts from Holly's normal Terminal so Railway DNS resolves.

- [ ] **Step 3: Smoke test**

Create a scheduled manual post due now, confirm Telegram sends a copy-ready packet with `Posted`, tap `Posted`, and confirm the Sheet status changes to `posted`.
