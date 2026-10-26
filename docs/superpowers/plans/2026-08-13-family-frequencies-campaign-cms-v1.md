# Family Frequencies Campaign CMS V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a usable campaign control room to the existing Family Frequencies admin that automatically generates versioned event campaigns, shows previews and a collision-aware shared calendar, supports lightweight ownership and approvals, and produces a complete manual/native publishing package without Railway, n8n, Postiz, or live social-account dependencies.

**Architecture:** Supabase remains the source of truth and existing admin-auth boundary. Focused browser modules implement deterministic generation, scheduling, readiness, rendering, and delivery contracts; additive SQL migrations provide admin-only tables and atomic RPCs for material changes/history. The first releasable checkpoint ends with the manual/native control room and a fake publishing adapter; read-only Meta insights and evidence-led pattern proposals are a later slice that cannot delay control-room acceptance.

**Tech Stack:** Existing vanilla HTML/CSS/ES modules, Supabase PostgreSQL/RLS/RPC, Supabase JS v2, Vercel serverless functions for secret-bearing read-only Meta calls, Node's built-in test runner, and JSON fixtures.

---

## Approved inputs and hard boundaries

- Design source: `docs/superpowers/specs/2026-08-13-family-frequencies-campaign-cms-v1-design.md`.
- Real proof event: Daylight Disco, Hide Mt Maunganui, Sunday 6 September 2026, 12–5pm, free/walk-in. Father's Day is a supporting angle only.
- The separate Claude Design import owns fidelity extraction. This plan uses stable manifest keys and missing-input placeholders until that work lands; it must not copy, regenerate, or overwrite the artwork.
- Railway/n8n are retired dependencies. No new code may call the old Railway URL.
- Postiz and the Linux NUC are outside this plan. Only a vendor-neutral package and fake adapter are implemented.
- No remote Supabase migration, deployment, social-account connection, post, paid action, Postiz installation, or NUC change is authorised by this plan.
- Editorial status is the prominent status in the UI. Delivery status is compact, secondary, and absent until relevant.
- Manual/native publishing is a complete route, not a temporary error state.

## Git/worktree preflight

This Codex worktree can write project files but currently cannot write shared Git metadata. On 13 August 2026:

- `git switch -c codex/ff-campaign-cms-v1-design` failed creating `refs/heads/...lock`.
- Exact-file `git add` failed creating `.git/worktrees/family-frequencies/index.lock`.

Before implementation, run:

```bash
git status --short --branch
git rev-parse --git-dir
test -w "$(git rev-parse --git-dir)" && echo writable || echo read-only
```

Expected: an isolated named `codex/` branch and `writable`. If Git metadata is still read-only, do not work in `main`, do not copy the plan into another active checkout, and do not use broad staging. Ask the primary task to provide a writable isolated worktree or to commit exact reviewed files. Every commit below must use the listed paths only; never use `git add -A`.

## Locked file map

### Core control room — create

- `supabase/migrations/20260813_campaign_cms_core.sql` — additive campaign/team/history schema, admin-only RLS, atomic creation/update/approval RPCs, and active pattern seed.
- `admin/campaign.contracts.js` — enums, input normalization, material-field detection, and stable item shape.
- `admin/campaign.pattern.js` — modular pattern expansion and optional-module decisions.
- `admin/campaign.scheduler.js` — deterministic anchors, flexible windows, collision resolution, late-entry compression, and protected-item rules.
- `admin/campaign.readiness.js` — missing inputs, approval eligibility, bulk-approval partitioning, and prominent/secondary display status.
- `admin/campaign.delivery.js` — neutral publishing package, checksum, manual adapter, and fake adapter.
- `admin/campaign.repository.js` — the only Supabase access layer used by the Campaign screen.
- `admin/campaign.view.js` — pure HTML renderers for header, item cards/detail, calendar, missing inputs, history, and delivery badge.
- `admin/campaign.js` — Campaign screen controller and event bindings.
- `admin/campaign.css` — Campaign-only layout, preview, calendar, responsive, focus, and state styles.
- `admin/campaign-manifests/daylight-disco-2026-09-06.placeholder.json` — stable keys, expected dimensions/roles, copy/brief seeds, and unresolved asset values.
- `admin/test/fixtures/campaign-events.fixture.json` — fictional multi-event fixtures used only by tests.
- `admin/*.test.mjs` matching each campaign module — Node unit/contract tests.
- `tests/campaign-migration.test.mjs` — static migration safety/RLS/RPC assertions.
- `tests/sql/campaign-core-prerequisite.sql` — disposable-database-only minimal `ff_events`/admin prerequisite for applying the new migration in isolation.
- `tests/campaign-admin-smoke.test.mjs` — Campaign shell and legacy-scheduler retirement assertions.

### Core control room — modify

- `admin/index.html` — add Campaign navigation and workspace; keep legacy Scheduling until the control-room checkpoint passes.
- `admin/admin.js` — initialize the Campaign controller, lazy-load it by tab, and trigger idempotent automatic campaign creation after a new event save.
- `admin/admin.css` — only shared navigation/responsive adjustments that cannot remain in `campaign.css`.
- `api/admin-config.js` — expose the non-secret `campaignCmsEnabled` flag.
- `.env.example` — document `FF_CAMPAIGN_CMS_ENABLED=false`; no real values.
- `package.json` — add focused test scripts while retaining `test:admin`.
- `README.md` — document the control-room boundary and safe local verification.

### Later insights/learning slice — create

- `supabase/migrations/20260813_campaign_cms_insights.sql` — snapshots, learnings, and pattern-proposal RPCs only.
- `lib/meta-insights.js` — provider request/normalization functions with no environment reads.
- `api/campaign-insights.js` — authenticated read-only Meta refresh endpoint.
- `tests/meta-insights.test.mjs` and `tests/campaign-insights-api.test.mjs` — provider and endpoint tests with mocked fetch.
- `admin/campaign.insights.js` and `admin/campaign.insights.test.mjs` — compatible-metric comparisons and evidence-linked review model.

### Later insights/learning slice — modify

- `admin/campaign.js`, `admin/campaign.view.js`, and `admin/campaign.css` — add the post-campaign review below the already usable control room.
- `.env.example` — add blank Meta server-only variables.
- `package.json` and `README.md` — add insight tests and connection caveats.

## Checkpoints

1. **Contracts checkpoint:** core migration text, generator, scheduler, readiness, and fixture tests pass without any database or browser.
2. **Visible control-room checkpoint:** Campaign tab renders the September placeholder campaign plus fictional shared calendar; existing admin tests still pass.
3. **Usable V1 checkpoint:** ownership, approvals, material history, manual/native package, and fake adapter work end to end. Stop and review here before any insights work.
4. **Insights checkpoint:** on-demand mocked Meta refresh, manual fallback, evidence-linked learning, and proposed pattern version work without live credentials.
5. **Release checkpoint:** old Scheduling navigation is retired only after checkpoint 3 passes; the old files/workflow exports are preserved for rollback/reference.

---

### Task 1: Add campaign contracts and test scripts

**Files:**
- Create: `admin/campaign.contracts.js`
- Create: `admin/campaign.contracts.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing contract tests**

Test exact statuses, normalized arrays, material fields, and the rule that delivery is hidden while `not_sent`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EDITORIAL_STATUSES,
  DELIVERY_STATUSES,
  normalizeCampaignItem,
  isMaterialItemChange,
  deliveryBadge,
} from './campaign.contracts.js';

test('campaign status contracts stay small and explicit', () => {
  assert.deepEqual(EDITORIAL_STATUSES, ['planned', 'creating', 'review', 'approved', 'blocked']);
  assert.deepEqual(DELIVERY_STATUSES, ['not_sent', 'ready', 'queued', 'scheduled', 'published', 'failed']);
});

test('delivery stays secondary until relevant', () => {
  assert.equal(deliveryBadge({ delivery_status: 'not_sent' }), null);
  assert.deepEqual(deliveryBadge({ delivery_route: 'manual', delivery_status: 'ready' }), {
    tone: 'manual', label: 'Manual ready',
  });
});

test('copy asset and date edits are material but notes are not', () => {
  assert.equal(isMaterialItemChange({ notes: 'clarified' }), false);
  assert.equal(isMaterialItemChange({ copy: { instagram: 'New copy' } }), true);
  assert.equal(isMaterialItemChange({ planned_at: '2026-09-01T09:00:00+12:00' }), true);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test admin/campaign.contracts.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `campaign.contracts.js`.

- [ ] **Step 3: Implement the contract module**

Export frozen status arrays; validate enum membership; normalize `channels`, `required_inputs`, `missing_inputs`, `copy`, and `assets`; define `MATERIAL_ITEM_FIELDS`; return `null` for `not_sent` delivery and compact labels for the remaining delivery states. Reject an invalid value with a field-specific `TypeError`.

Core interface:

```js
export const EDITORIAL_STATUSES = Object.freeze(['planned', 'creating', 'review', 'approved', 'blocked']);
export const DELIVERY_STATUSES = Object.freeze(['not_sent', 'ready', 'queued', 'scheduled', 'published', 'failed']);
export const DELIVERY_ROUTES = Object.freeze(['manual', 'postiz']);
export const MATERIAL_ITEM_FIELDS = new Set([
  'copy', 'assets', 'channels', 'format', 'planned_at', 'delivery_route', 'native_requirements',
]);

export function isMaterialItemChange(patch) {
  return Object.keys(patch || {}).some((key) => MATERIAL_ITEM_FIELDS.has(key));
}
```

- [ ] **Step 4: Add focused scripts without changing the existing gate**

Set:

```json
{
  "scripts": {
    "test:admin": "node --test admin/admin.logic.test.mjs tests/admin-auth.test.mjs tests/bank-transfer-flow.test.mjs",
    "test:campaign": "node --test admin/campaign*.test.mjs tests/campaign-*.test.mjs",
    "test:all": "npm run test:admin && npm run test:campaign"
  }
}
```

- [ ] **Step 5: Verify and commit exact files**

Run: `npm run test:campaign`

Expected: PASS for all contract tests.

```bash
git add -- admin/campaign.contracts.js admin/campaign.contracts.test.mjs package.json
git commit --only admin/campaign.contracts.js admin/campaign.contracts.test.mjs package.json -m "feat: add campaign CMS contracts"
```

### Task 2: Add the additive core schema, RLS, and atomic RPCs

**Files:**
- Create: `supabase/migrations/20260813_campaign_cms_core.sql`
- Create: `tests/campaign-migration.test.mjs`
- Create: `tests/sql/campaign-core-prerequisite.sql`

- [ ] **Step 1: Write a failing migration contract test**

Read the SQL and assert it contains all six core tables, admin-only RLS policies, immutable pattern version uniqueness, optimistic `revision`, and three RPC names:

```js
const required = [
  'ff_campaign_patterns', 'ff_campaigns', 'ff_campaign_items',
  'ff_campaign_item_assets', 'ff_team_members', 'ff_campaign_history',
  'ff_create_campaign_from_plan', 'ff_update_campaign_item', 'ff_bulk_approve_campaign_items',
  "lower(coalesce(auth.jwt() ->> 'email', ''))",
  'USING (is_ff_admin())', 'WITH CHECK (is_ff_admin())',
];
```

Also assert the migration does not contain `DROP TABLE`, the Railway hostname, a public campaign-read policy, secrets, `p_actor`, `actor text`, or `actor_email text` in any browser RPC signature. Parse each RPC signature and assert only the documented business parameters are accepted. Assert every history insertion uses a local variable populated from the JWT-derived identity and every RPC rejects a blank identity before mutation.

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/campaign-migration.test.mjs`

Expected: FAIL because the migration file is missing.

- [ ] **Step 3: Create the migration with exact constraints**

Use additive `CREATE TABLE IF NOT EXISTS` statements with:

```sql
CREATE TABLE IF NOT EXISTS ff_campaign_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  parent_pattern_id uuid REFERENCES ff_campaign_patterns(id),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pattern_key, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS ff_campaign_patterns_one_active
  ON ff_campaign_patterns(pattern_key) WHERE is_active;

CREATE TABLE IF NOT EXISTS ff_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES ff_events(id) ON DELETE CASCADE,
  pattern_id uuid NOT NULL REFERENCES ff_campaign_patterns(id),
  phase text NOT NULL DEFAULT 'announce' CHECK (phase IN ('announce','build','event_week','event_day','afterglow','complete')),
  modules text[] NOT NULL DEFAULT '{}',
  supporting_angles text[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS ff_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ff_campaign_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES ff_campaigns(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  title text NOT NULL,
  phase text NOT NULL,
  objective text NOT NULL,
  brief text NOT NULL,
  channels text[] NOT NULL,
  format text NOT NULL CHECK (format IN ('feed','story','reel','carousel','poster','manual_task')),
  priority integer NOT NULL CHECK (priority BETWEEN 1 AND 100),
  schedule_kind text NOT NULL CHECK (schedule_kind IN ('anchor','flexible')),
  preferred_at timestamptz NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  planned_at timestamptz,
  due_at timestamptz,
  owner_id uuid REFERENCES ff_team_members(id),
  editorial_status text NOT NULL DEFAULT 'planned' CHECK (editorial_status IN ('planned','creating','review','approved','blocked')),
  delivery_route text NOT NULL DEFAULT 'manual' CHECK (delivery_route IN ('manual','postiz')),
  delivery_status text NOT NULL DEFAULT 'not_sent' CHECK (delivery_status IN ('not_sent','ready','queued','scheduled','published','failed')),
  copy jsonb NOT NULL DEFAULT '{}'::jsonb,
  native_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_inputs text[] NOT NULL DEFAULT '{}',
  missing_inputs text[] NOT NULL DEFAULT '{}',
  generator_decision text NOT NULL,
  generated_baseline jsonb NOT NULL,
  approved_by text,
  approved_at timestamptz,
  external_id text,
  permalink text,
  handoff_version integer NOT NULL DEFAULT 0,
  handoff_checksum text,
  last_delivery_error text,
  last_synced_at timestamptz,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, item_key),
  CHECK (window_start <= window_end)
);

CREATE TABLE IF NOT EXISTS ff_campaign_item_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES ff_campaign_items(id) ON DELETE CASCADE,
  asset_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  role text NOT NULL,
  source text NOT NULL CHECK (source IN ('claude_design','content_factory','manual_upload','existing')),
  durable_url text,
  preview_url text,
  aspect text NOT NULL,
  availability text NOT NULL DEFAULT 'missing' CHECK (availability IN ('missing','available','broken')),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (item_id, asset_key)
);

CREATE TABLE IF NOT EXISTS ff_campaign_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES ff_campaigns(id) ON DELETE CASCADE,
  item_id uuid REFERENCES ff_campaign_items(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_email text NOT NULL,
  reason text,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Enable RLS on every table. Add `FOR ALL USING (is_ff_admin()) WITH CHECK (is_ff_admin())` policies, relying on the existing locked `is_ff_admin()` function; do not add public-read policies.

Define the authenticated identity rule once inside each browser RPC:

```sql
v_actor_email := lower(coalesce(auth.jwt() ->> 'email', ''));
IF v_actor_email = '' OR NOT is_ff_admin() THEN
  RAISE EXCEPTION 'insufficient_privilege';
END IF;
```

Do not accept actor, actor email, user ID, or audit identity as a client parameter. Define:

- `ff_create_campaign_from_plan(p_event_id uuid, p_pattern_id uuid, p_plan jsonb)` to return the existing campaign on retry, otherwise insert campaign/items/assets and one `generated` history entry using `v_actor_email` in one transaction.
- `ff_update_campaign_item(p_item_id uuid, p_expected_revision integer, p_patch jsonb, p_reason text)` to reject stale revisions, allow only the approved patch key set, invalidate approval for material changes, increment revision, and write one material diff using `v_actor_email`.
- `ff_bulk_approve_campaign_items(p_campaign_id uuid, p_item_ids uuid[])` to approve only items whose `missing_inputs` is empty, owner/planned time exist, and status is `review`; set `approved_by` from `v_actor_email`, write approval history with the same identity, and return `approved_ids` plus excluded `{id, reasons}`.

Declare these browser RPCs `SECURITY INVOKER` with an explicit safe `search_path`, revoke them from `PUBLIC`, grant execute to `authenticated`, and keep them on the authenticated browser path. Do not add a service-role attribution override or `SECURITY DEFINER` shortcut. If a future trusted service genuinely needs to create history, design a separate, reviewed service-only function rather than weakening these RPCs.

Seed one active `ff-standard-event` version 1 definition and an “Unassigned” member. The definition must contain the six core items and optional module rules from the spec, not fixture dates or September-specific artwork. Set the seed row's `created_by` to the fixed provenance label `migration:20260813_campaign_cms_core`; this value comes from trusted migration text, not browser input. All later browser-created pattern versions must derive `created_by` from the JWT rule.

- [ ] **Step 4: Run static and disposable-database verification**

Run: `node --test tests/campaign-migration.test.mjs`

Expected: PASS.

Do not use `supabase db reset` as this migration's gate: the checked-in migration chain does not contain the original `ff_events` creation, so a clean reset is already incomplete before this feature. Add `tests/sql/campaign-core-prerequisite.sql` containing only `pgcrypto`, a minimal `ff_events(id uuid primary key)`, a minimal `ff_admins(email text primary key)`, a stub `auth.jwt()` in a local `auth` schema, and the repository's `is_ff_admin()` definition. It is test support, not a production migration.

If a disposable local PostgreSQL server is available, run exactly:

```bash
createdb ff_campaign_cms_test
psql -v ON_ERROR_STOP=1 -d ff_campaign_cms_test -f tests/sql/campaign-core-prerequisite.sql
psql -v ON_ERROR_STOP=1 -d ff_campaign_cms_test -f supabase/migrations/20260813_campaign_cms_core.sql
dropdb ff_campaign_cms_test
```

Expected: both `psql` commands complete without error and the disposable database is removed. Never point `psql` at the linked Supabase host.

Do not run `supabase db push`, `supabase migration up --linked`, or any remote SQL command. Repairing the historical baseline migration chain is a separate repository-maintenance decision, not Campaign CMS scope.

- [ ] **Step 5: Commit the exact migration and test**

```bash
git add -- supabase/migrations/20260813_campaign_cms_core.sql tests/campaign-migration.test.mjs tests/sql/campaign-core-prerequisite.sql
git commit --only supabase/migrations/20260813_campaign_cms_core.sql tests/campaign-migration.test.mjs tests/sql/campaign-core-prerequisite.sql -m "feat: add campaign CMS schema"
```

Rollback: before remote rollout, rollback is “do not apply.” After a separately authorised rollout, disable the UI flag first. The migration is additive; table removal requires a separately reviewed down migration after data export and is not part of V1 implementation.

### Task 3: Implement deterministic pattern expansion

**Files:**
- Create: `admin/campaign.pattern.js`
- Create: `admin/campaign.pattern.test.mjs`
- Create: `admin/test/fixtures/campaign-events.fixture.json`

- [ ] **Step 1: Add fictional fixtures and failing tests**

The fixture file must contain exactly these clearly labelled non-production events:

```json
[
  {"fixture":true,"title":"Fixture Family Workshop","slug":"fixture-family-workshop","event_date":"2026-09-15","time_start":"10:00","time_end":"12:00","venue":"Fixture Venue","is_ticketed":false,"created_on":"2026-09-05"},
  {"fixture":true,"title":"Fixture First Aid Course","slug":"fixture-first-aid","event_date":"2026-09-19","time_start":"09:00","time_end":"12:00","venue":"Fixture Venue","is_ticketed":true,"created_on":"2026-08-29"},
  {"fixture":true,"title":"Fixture Family Gig","slug":"fixture-family-gig","event_date":"2026-09-20","time_start":"14:00","time_end":"17:00","venue":"Fixture Venue","is_ticketed":true,"created_on":"2026-09-06"},
  {"fixture":true,"title":"Fixture Daylight Disco","slug":"fixture-daylight-disco","event_date":"2026-10-03","time_start":"12:00","time_end":"17:00","venue":"Fixture Venue","is_ticketed":false,"created_on":"2026-09-05"},
  {"fixture":true,"title":"Fixture Nutrition Talk","slug":"fixture-nutrition-talk","event_date":"2026-10-08","time_start":"18:00","time_end":"19:30","venue":"Fixture Venue","is_ticketed":false,"created_on":"2026-10-02"}
]
```

Tests must assert core items always expand, ticket launch appears only for ticketed events, sponsor/countdown/seasonal modules require explicit facts, and late creation returns omissions rather than past planned items.

- [ ] **Step 2: Verify failure**

Run: `node --test admin/campaign.pattern.test.mjs`

Expected: FAIL because `campaign.pattern.js` is missing.

- [ ] **Step 3: Implement pure expansion**

Export `chooseModules(event)` returning stable module keys from event facts only, and `expandPattern({ event, pattern, now })` returning `{items, omitted, modules}`. Use `Pacific/Auckland` event-date offsets expressed as integer days in the pattern definition. Preserve stable `item_key`, `phase`, `priority`, `schedule_kind`, `preferred_at`, `window_start`, `window_end`, `required_inputs`, and an initial `generator_decision`. Never call a model, random source, network, or clock internally; `now` is required input.

- [ ] **Step 4: Verify deterministic output**

Run twice with the same event/pattern/now and assert deep equality. Run: `node --test admin/campaign.pattern.test.mjs`.

Expected: PASS, including the six-day nutrition fixture omitting past low-priority items.

- [ ] **Step 5: Commit exact files**

```bash
git add -- admin/campaign.pattern.js admin/campaign.pattern.test.mjs admin/test/fixtures/campaign-events.fixture.json
git commit --only admin/campaign.pattern.js admin/campaign.pattern.test.mjs admin/test/fixtures/campaign-events.fixture.json -m "feat: generate modular event campaigns"
```

### Task 4: Implement shared collision-aware scheduling

**Files:**
- Create: `admin/campaign.scheduler.js`
- Create: `admin/campaign.scheduler.test.mjs`

- [ ] **Step 1: Write failing scheduling tests**

Cover:

- anchored items keep their preferred time;
- flexible feed items never share a local calendar day;
- story countdown frames may share the allowed event-week sequence;
- the closest valid position wins with deterministic earlier-before-later tie-breaking;
- moved items record `Moved one day earlier to avoid <item_key>`;
- no valid slot yields `editorial_status: blocked` and a collision reason;
- approved or delivery-sent items remain untouched.

- [ ] **Step 2: Verify failure**

Run: `node --test admin/campaign.scheduler.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement the scheduler**

Export:

```js
export function scheduleCampaigns({ items, timezone = 'Pacific/Auckland' }) {
  // returns { scheduled, conflicts, decisions }
}
```

Sort anchors first, then flexible items by descending priority, preferred time, campaign ID, and item key. Treat `approved` or any delivery status other than `not_sent` as protected. Check channel collision policy using local date strings, never the runtime machine timezone.

- [ ] **Step 4: Verify the real-plus-fixture calendar contract**

Combine a September proof event object with all five fictional fixtures, expand, schedule, and assert every item is either validly placed, explicitly omitted, protected, or visibly blocked.

Run: `node --test admin/campaign.pattern.test.mjs admin/campaign.scheduler.test.mjs`

Expected: PASS with no silent duplicate feed day.

- [ ] **Step 5: Commit exact files**

```bash
git add -- admin/campaign.scheduler.js admin/campaign.scheduler.test.mjs
git commit --only admin/campaign.scheduler.js admin/campaign.scheduler.test.mjs -m "feat: resolve campaign calendar collisions"
```

### Task 5: Implement readiness and approval partitioning

**Files:**
- Create: `admin/campaign.readiness.js`
- Create: `admin/campaign.readiness.test.mjs`

- [ ] **Step 1: Write failing readiness tests**

Assert an item is not ready without owner, planned time, required copy, required available assets, or route. Assert a native Story requiring music remains approval-ready when the manual requirement is present. Assert bulk partition returns ready IDs and exact exclusion reasons.

- [ ] **Step 2: Verify failure**

Run: `node --test admin/campaign.readiness.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement pure readiness functions**

Export `missingInputs(item)` as a sorted stable string-key list, `approvalReadiness(item)` as `{ready, reasons}`, `partitionBulkApproval(items)` as `{readyIds, excluded}`, and `displayStatus(item)` as a prominent editorial result with an optional compact delivery result. The main status always comes from `editorial_status`; delivery is returned only through the optional `secondary` field.

- [ ] **Step 4: Verify and commit**

Run: `node --test admin/campaign.readiness.test.mjs`

Expected: PASS.

```bash
git add -- admin/campaign.readiness.js admin/campaign.readiness.test.mjs
git commit --only admin/campaign.readiness.js admin/campaign.readiness.test.mjs -m "feat: calculate campaign readiness"
```

**Checkpoint 1:** Run `npm run test:campaign`. Review generated plans for the September event plus five fictional fixtures. Do not start UI work until every unexplained movement or overdue item is fixed in the pure modules.

### Task 6: Add the Supabase repository and idempotent campaign creation

**Files:**
- Create: `admin/campaign.repository.js`
- Create: `admin/campaign.repository.test.mjs`

- [ ] **Step 1: Write repository tests with a fake Supabase client**

Cover active-pattern loading, existing-campaign return, `ff_create_campaign_from_plan` call shape, campaign graph query, `ff_update_campaign_item`, and `ff_bulk_approve_campaign_items`. For all three RPCs, assert the fake Supabase client receives only business parameters and never receives `actor`, `actor_email`, `approved_by`, `created_by`, or a session email. Assert no Railway URL or Google Sheet call occurs.

Use exact expected RPC payloads:

```js
assert.deepEqual(rpcCalls.find((call) => call.name === 'ff_create_campaign_from_plan').args, {
  p_event_id: event.id,
  p_pattern_id: pattern.id,
  p_plan: plan,
});
assert.deepEqual(rpcCalls.find((call) => call.name === 'ff_update_campaign_item').args, {
  p_item_id: item.id,
  p_expected_revision: 3,
  p_patch: { owner_id: owner.id },
  p_reason: 'Assign production owner',
});
assert.deepEqual(rpcCalls.find((call) => call.name === 'ff_bulk_approve_campaign_items').args, {
  p_campaign_id: campaign.id,
  p_item_ids: readyIds,
});
for (const call of rpcCalls) {
  assert.equal('actor' in call.args, false);
  assert.equal('actor_email' in call.args, false);
  assert.equal('approved_by' in call.args, false);
}
```

- [ ] **Step 2: Verify failure**

Run: `node --test admin/campaign.repository.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement the repository interface**

```js
export function createCampaignRepository(sb) {
  return {
    loadActivePattern,
    ensureCampaign,
    loadCampaignGraph,
    loadAllCalendarItems,
    updateItem,
    bulkApprove,
    loadTeam,
  };
}
```

All database calls live here. `ensureCampaign(event, now)` expands/schedules using Tasks 3–4, then calls the idempotent RPC with event ID, pattern ID, and plan only. Return `{campaign, created, warnings}`. The authenticated database request derives audit identity from `auth.jwt()`; neither the repository nor controller reads or sends audit actor text. The controller introduced in Task 7 will call this method; Task 6 does not touch `admin.js`.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test admin/campaign.repository.test.mjs`

Expected: repository tests PASS.

```bash
git add -- admin/campaign.repository.js admin/campaign.repository.test.mjs
git commit --only admin/campaign.repository.js admin/campaign.repository.test.mjs -m "feat: add campaign data repository"
```

### Task 7: Add the Campaign screen shell and pure renderers

**Files:**
- Create: `admin/campaign.view.js`
- Create: `admin/campaign.view.test.mjs`
- Create: `admin/campaign.js`
- Create: `admin/campaign.css`
- Create: `tests/campaign-admin-smoke.test.mjs`
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`

- [ ] **Step 1: Write failing renderer and smoke tests**

Assert renderer output contains an event header, readiness counts, prominent editorial pill, missing-input text, preview aspect class, and no delivery badge for `not_sent`. The smoke test must require `data-tab="campaign"`, `tab-campaign`, `campaign-calendar`, `campaign-item-list`, `campaign-detail`, and the Campaign stylesheet/module.

- [ ] **Step 2: Verify failure**

Run: `node --test admin/campaign.view.test.mjs tests/campaign-admin-smoke.test.mjs`

Expected: FAIL for missing files/markup.

- [ ] **Step 3: Add the Campaign workspace while preserving legacy Scheduling**

Add a Campaign navigation button before Scheduling and a workspace with:

```html
<section id="tab-campaign" class="workspace campaign-workspace" hidden>
  <header id="campaign-header" class="campaign-header"></header>
  <div id="campaign-alert" class="campaign-alert" role="status" aria-live="polite"></div>
  <div class="campaign-layout">
    <section class="panel campaign-calendar-panel" aria-labelledby="campaign-calendar-title">
      <div class="panel-head"><h3 id="campaign-calendar-title">Marketing calendar</h3></div>
      <div id="campaign-calendar"></div>
    </section>
    <section class="panel campaign-items-panel" aria-labelledby="campaign-items-title">
      <div class="panel-head"><h3 id="campaign-items-title">Campaign items</h3></div>
      <div id="campaign-item-list"></div>
    </section>
    <aside id="campaign-detail" class="panel campaign-detail" aria-live="polite"></aside>
  </div>
</section>
```

Keep the old Scheduling tab and iframe unchanged at this checkpoint, relabelled “Legacy scheduling” only if needed to avoid confusion.

- [ ] **Step 4: Implement pure escaped renderers and controller lifecycle**

`campaign.view.js` exports header/card/detail/calendar/history renderers and escapes every user/provider field. `campaign.js` exports `createCampaignController({sb, sessionProvider})` with `load`, `ensureForEvent`, `selectCampaign`, `selectItem`, and `destroy`. Lazy-load only on Campaign tab activation.

- [ ] **Step 5: Wire new-event creation without making event save fragile**

In `handleSaveEvent`, after a successful new event insert and before the success message, call:

```js
const campaignResult = await campaignController.ensureForEvent(result.data);
els.formSuccess.textContent = campaignResult.ok
  ? 'Saved with a campaign of planned drafts.'
  : 'Event saved. Its campaign needs a retry from Campaign.';
```

The event remains saved if campaign generation fails. Never retry automatically in a loop. Older events use the Campaign screen's backfill action.

- [ ] **Step 6: Style one-workflow hierarchy**

Use the existing admin tokens. Editorial pills must have stronger size/contrast than `.delivery-badge`; `.delivery-badge` is not rendered for `not_sent`. Add phone layout, 44px action targets, `:focus-visible`, reduced-motion support, empty/loading/error states, and correct `aspect-ratio` classes for 4:5, 9:16, carousel, and A3.

- [ ] **Step 7: Verify and commit**

Run: `node --test admin/campaign.view.test.mjs tests/campaign-admin-smoke.test.mjs && npm run test:admin`

Expected: PASS.

```bash
git add -- admin/campaign.view.js admin/campaign.view.test.mjs admin/campaign.js admin/campaign.css admin/index.html admin/admin.js admin/admin.css tests/campaign-admin-smoke.test.mjs
git commit --only admin/campaign.view.js admin/campaign.view.test.mjs admin/campaign.js admin/campaign.css admin/index.html admin/admin.js admin/admin.css tests/campaign-admin-smoke.test.mjs -m "feat: add campaign control room shell"
```

### Task 8: Add the September placeholder manifest and preview states

**Files:**
- Create: `admin/campaign-manifests/daylight-disco-2026-09-06.placeholder.json`
- Create: `admin/campaign.manifest.js`
- Create: `admin/campaign.manifest.test.mjs`
- Modify: `admin/campaign.js`
- Modify: `admin/campaign.view.js`

- [ ] **Step 1: Write failing manifest tests**

Assert the manifest identifies the real event facts, marks itself `placeholder: true`, contains stable entries for six feed posts, one five-slide carousel, seven story frames, sponsor thanks, four post-event assets, A3 poster, and reusable cutouts/export provenance. Assert every unresolved entry has `durable_url: null`, `availability: "missing"`, source `claude_design`, and an explicit expected aspect/role.

- [ ] **Step 2: Verify failure**

Run: `node --test admin/campaign.manifest.test.mjs`

Expected: FAIL because the manifest and loader are missing.

- [ ] **Step 3: Add stable keys without inventing artwork**

Use keys:

```text
dd-2026-09-feed-01..06
dd-2026-09-carousel-01-slide-01..05
dd-2026-09-story-01..07
dd-2026-09-sponsor-thanks
dd-2026-09-post-event-01..04
dd-2026-09-poster-a3
dd-2026-09-cutouts
```

Include only known event facts, asset purpose, expected dimensions/aspect, campaign item link, provenance label, and missing state. Do not point at ignored local export paths as delivery URLs.

- [ ] **Step 4: Render useful placeholders**

Cards show the intended aspect, asset role, stable key, source “Claude Design import pending,” and exactly what is missing. The carousel detail preserves slide order. A later real manifest with matching stable keys can resolve URLs without changing item identity.

- [ ] **Step 5: Verify and commit**

Run: `node --test admin/campaign.manifest.test.mjs admin/campaign.view.test.mjs`

Expected: PASS.

```bash
git add -- admin/campaign-manifests/daylight-disco-2026-09-06.placeholder.json admin/campaign.manifest.js admin/campaign.manifest.test.mjs admin/campaign.js admin/campaign.view.js
git commit --only admin/campaign-manifests/daylight-disco-2026-09-06.placeholder.json admin/campaign.manifest.js admin/campaign.manifest.test.mjs admin/campaign.js admin/campaign.view.js -m "feat: map September campaign asset placeholders"
```

### Task 9: Complete the shared calendar and collision evidence UI

**Files:**
- Modify: `admin/campaign.js`
- Modify: `admin/campaign.view.js`
- Modify: `admin/campaign.css`
- Create: `admin/campaign.calendar.test.mjs`

- [ ] **Step 1: Write failing calendar view tests**

Assert event filtering, local date grouping, phase labels, anchor/flexible distinction, protected markers, move reasons, blocked conflicts, and omitted-late explanations. Assert fictional fixtures are labelled `Fixture` and cannot be mistaken for production data.

- [ ] **Step 2: Implement the simplest useful calendar**

Use an accessible date-grouped grid/list built from pure renderers; do not add FullCalendar or another dependency. Desktop may show weeks in columns; phone layout becomes chronological groups. Selecting an item opens the same detail panel.

- [ ] **Step 3: Add explicit fixture-preview mode for local verification only**

Fixture data is imported only by tests or a `?campaignFixtures=1` local preview path guarded by `location.hostname === 'localhost'`. It must never be inserted into Supabase.

- [ ] **Step 4: Verify and commit**

Run: `node --test admin/campaign.calendar.test.mjs admin/campaign.scheduler.test.mjs`

Expected: PASS.

```bash
git add -- admin/campaign.js admin/campaign.view.js admin/campaign.css admin/campaign.calendar.test.mjs
git commit --only admin/campaign.js admin/campaign.view.js admin/campaign.css admin/campaign.calendar.test.mjs -m "feat: show shared campaign calendar"
```

### Task 10: Add ownership, editing, approvals, and material history

**Files:**
- Modify: `admin/campaign.js`
- Modify: `admin/campaign.view.js`
- Modify: `admin/campaign.css`
- Modify: `admin/campaign.repository.js`
- Create: `admin/campaign.actions.test.mjs`

- [ ] **Step 1: Write failing action tests**

Cover owner assignment, due date, copy edit, asset selection, request-changes reason, block/unblock, single approval, partial bulk approval, stale revision, and approval invalidation after material edit. Assert note-only edits retain approval and do not create a material history row. Assert the detail form has no actor/approver input and every repository mutation omits actor attribution; returned history displays the server-recorded `actor_email` as read-only evidence.

- [ ] **Step 2: Add one detail form, not a workflow builder**

Render only approved fields: copy variants, owner, due/planned time, delivery route, native requirements, missing-input checklist, request reason, and actions. Do not add custom statuses, arbitrary workflow steps, role editing, or a generic asset browser.

- [ ] **Step 3: Call atomic RPCs with optimistic revision**

Every mutation sends `expected_revision`. A stale response renders “This item changed elsewhere. Refresh to compare before saving.” On success, reload the item and concise history. Bulk approval shows approved count plus each excluded item/reason.

- [ ] **Step 4: Verify keyboard and status hierarchy manually**

Start a local static/Vercel server. Verify tab order, focus return after save, `aria-live` outcomes, prominent editorial status, hidden `not_sent` delivery, and mobile-width usability. Record screenshots only in the task evidence area, not in production assets.

- [ ] **Step 5: Run tests and commit**

Run: `node --test admin/campaign.actions.test.mjs admin/campaign.readiness.test.mjs && npm run test:admin`

Expected: PASS.

```bash
git add -- admin/campaign.js admin/campaign.view.js admin/campaign.css admin/campaign.repository.js admin/campaign.actions.test.mjs
git commit --only admin/campaign.js admin/campaign.view.js admin/campaign.css admin/campaign.repository.js admin/campaign.actions.test.mjs -m "feat: add campaign approvals and history"
```

### Task 11: Add the neutral package, manual/native route, and fake adapter

**Files:**
- Create: `admin/campaign.delivery.js`
- Create: `admin/campaign.delivery.test.mjs`
- Modify: `admin/campaign.js`
- Modify: `admin/campaign.view.js`
- Modify: `admin/campaign.repository.js`

- [ ] **Step 1: Write failing delivery tests**

Assert package shape, ordered assets, `Pacific/Auckland`, stable correlation ID, deterministic checksum, manual checklist output, fake adapter state sequence, missing durable-asset rejection, and that no Postiz/Railway network URL exists.

- [ ] **Step 2: Implement the vendor-neutral package**

```js
export function buildPublishingPackage(item) {
  return {
    schema_version: 1,
    item_id: item.id,
    content_version: item.revision,
    correlation_id: `${item.id}:${item.revision}`,
    channels: item.channels,
    format: item.format,
    copy: item.copy,
    assets: [...item.assets].sort((a, b) => a.sort_order - b.sort_order),
    scheduled_at: item.planned_at,
    timezone: 'Pacific/Auckland',
    native_requirements: item.native_requirements,
  };
}
```

Compute checksum with Web Crypto over canonical JSON. Refuse packages for unapproved items or missing durable assets.

- [ ] **Step 3: Implement manual and fake adapters**

`manualAdapter.prepare(package)` returns an assigned checklist and moves delivery to `ready`. “Mark published” requires either external ID or permalink and records `published`. `fakeAdapter.send(package)` returns deterministic `queued`, `scheduled`, and `published` fixtures for contract tests only; it performs no fetch.

- [ ] **Step 4: Add compact delivery UI**

After approval, show “Prepare manual post,” copy buttons, ordered downloads/links, native checklist, intended time, and “Mark published.” Delivery errors offer retry unchanged or switch to manual. Before approval, render no delivery section.

- [ ] **Step 5: Verify and commit**

Run: `node --test admin/campaign.delivery.test.mjs admin/campaign.actions.test.mjs`

Expected: PASS with zero external calls.

```bash
git add -- admin/campaign.delivery.js admin/campaign.delivery.test.mjs admin/campaign.js admin/campaign.view.js admin/campaign.repository.js
git commit --only admin/campaign.delivery.js admin/campaign.delivery.test.mjs admin/campaign.js admin/campaign.view.js admin/campaign.repository.js -m "feat: add manual campaign delivery package"
```

### Task 12: Gate and accept the usable control room

**Files:**
- Modify: `api/admin-config.js`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `tests/campaign-admin-smoke.test.mjs`

- [ ] **Step 1: Add a non-secret rollout flag test**

Test `campaignCmsEnabled` is false unless `FF_CAMPAIGN_CMS_ENABLED=true`; never expose Meta or service-role secrets.

- [ ] **Step 2: Implement and document the flag**

Return:

```js
{
  supabaseUrl,
  supabaseAnonKey,
  campaignCmsEnabled: process.env.FF_CAMPAIGN_CMS_ENABLED === 'true'
}
```

Add `FF_CAMPAIGN_CMS_ENABLED=false` to `.env.example`. Document that enabling/deploying/applying migrations is a separate authorised operation.

- [ ] **Step 3: Run the complete control-room gate**

Run:

```bash
npm run test:all
rg -n "n8n-production-4a398|railway.app" admin api supabase/migrations/20260813_campaign_cms_core.sql
git diff --check
```

Expected: all tests PASS; search returns no matches in new Campaign code; diff check is clean.

- [ ] **Step 4: Perform local acceptance without external systems**

Using fixtures and a fake Supabase/repository harness, verify:

- September campaign shows all precise artwork placeholders and supporting Father's Day angle without renaming the campaign.
- Any three to five fictional events produce an understandable shared calendar.
- Late entry omits overdue work.
- Bulk approval excludes incomplete items with reasons.
- Approved item completes manual package and fake-adapter round trip.
- No Railway, Postiz, NUC, Meta, or live Supabase dependency is required.

- [ ] **Step 5: Review checkpoint and commit**

Stop for product/engineering review. Fix control-room findings before Task 13. Then:

```bash
git add -- api/admin-config.js .env.example README.md tests/campaign-admin-smoke.test.mjs
git commit --only api/admin-config.js .env.example README.md tests/campaign-admin-smoke.test.mjs -m "docs: gate campaign control room rollout"
```

**Checkpoint 3 — usable V1:** This is the first shippable product slice. Meta insights and the learning review must not begin until Holly/primary task accepts this checkpoint. If later tasks slip, this control room remains useful with manual/native publishing.

### Task 13: Retire the dead Scheduling navigation after acceptance

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`
- Modify: `tests/campaign-admin-smoke.test.mjs`

- [ ] **Step 1: Change the smoke test first**

Require the Campaign tab and forbid `data-tab="scheduling"`, `scheduler-frame`, and the Railway hostname. Do not require deletion of `social-scheduler/` or workflow exports.

- [ ] **Step 2: Verify failure**

Run: `node --test tests/campaign-admin-smoke.test.mjs`

Expected: FAIL because legacy navigation remains.

- [ ] **Step 3: Remove only the iframe/navigation wiring**

Delete the Scheduling button/workspace and unused iframe CSS. Preserve `social-scheduler/`, workflow exports, and content factory. Confirm no other tab changes.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/campaign-admin-smoke.test.mjs && npm run test:admin`

Expected: PASS.

```bash
git add -- admin/index.html admin/admin.js admin/admin.css tests/campaign-admin-smoke.test.mjs
git commit --only admin/index.html admin/admin.js admin/admin.css tests/campaign-admin-smoke.test.mjs -m "refactor: replace legacy scheduler with campaigns"
```

Rollback: restore this one commit to bring the iframe navigation back while leaving all additive campaign data untouched.

---

## Later slice: insights and learning — must not delay usable V1

### Task 14: Add snapshot/learning schema and provider contracts

**Files:**
- Create: `supabase/migrations/20260813_campaign_cms_insights.sql`
- Create: `lib/meta-insights.js`
- Create: `tests/meta-insights.test.mjs`
- Modify: `tests/campaign-migration.test.mjs`

- [ ] **Step 1: Write failing normalization tests**

Use fixed Instagram post, Reel, Story, and Facebook Page fixtures. Assert provider-native metrics remain intact; normalize only reach, views/plays, reactions/likes, comments, shares, and saves when present; missing metrics remain absent rather than zero.

- [ ] **Step 2: Implement pure provider mapping**

Export `buildMetaInsightsUrl`, `normalizeMetaInsights`, and `compatibleMetricKey`. Pass token into the request builder; never read environment variables in the library or log token-bearing URLs.

- [ ] **Step 3: Add the additive insights migration**

Create admin-only `ff_metric_snapshots` and `ff_campaign_learnings`, with unique snapshot identity `(item_id, provider, collected_at)`, raw/normalized JSON, availability warning, evidence item/snapshot IDs, decision state, and proposed pattern ID. Add `ff_propose_pattern_version(p_pattern_id uuid, p_rule_change jsonb, p_learning_ids uuid[])` to clone the active definition with one explicit approved rule change; it must not activate the proposal or mutate prior patterns. Like the core browser RPCs, it accepts no actor parameter, derives `v_actor_email` from `lower(coalesce(auth.jwt() ->> 'email', ''))`, rejects blank/non-admin identity, and uses that value for `created_by` and learning-decision history.

Extend the static migration test to parse this signature, forbid client actor parameters, and assert JWT-derived attribution before mutation.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/meta-insights.test.mjs tests/campaign-migration.test.mjs`

Expected: PASS.

```bash
git add -- supabase/migrations/20260813_campaign_cms_insights.sql lib/meta-insights.js tests/meta-insights.test.mjs tests/campaign-migration.test.mjs
git commit --only supabase/migrations/20260813_campaign_cms_insights.sql lib/meta-insights.js tests/meta-insights.test.mjs tests/campaign-migration.test.mjs -m "feat: add campaign insight contracts"
```

### Task 15: Add authenticated on-demand Meta refresh with manual fallback

**Files:**
- Create: `api/campaign-insights.js`
- Create: `tests/campaign-insights-api.test.mjs`
- Modify: `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Write endpoint tests with mocked fetch**

Cover method/auth validation, missing external ID, missing server config, successful read-only GET, provider error redaction, and snapshot write. Assert the endpoint never issues a POST/PATCH/DELETE to Meta.

- [ ] **Step 2: Implement the endpoint following existing admin-auth patterns**

Use `parseAdminEmails`/`requireAdmin`, service-role writes only for the snapshot, and server-only `META_GRAPH_ACCESS_TOKEN`. Request one item by ID, require `published` plus external ID/provider, call Meta GET, normalize, insert snapshot, and return the sanitized snapshot. On failure retain prior snapshots and return an actionable error.

- [ ] **Step 3: Document blank server-only settings**

Add:

```dotenv
META_GRAPH_ACCESS_TOKEN=
FF_INSTAGRAM_ACCOUNT_ID=
FF_FACEBOOK_PAGE_ID=
```

State that adding real values/account permission is a separately authorised connection step. Manual entry remains supported when values are blank.

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/campaign-insights-api.test.mjs tests/meta-insights.test.mjs`

Expected: PASS with mocked fetch only.

```bash
git add -- api/campaign-insights.js tests/campaign-insights-api.test.mjs .env.example package.json
git commit --only api/campaign-insights.js tests/campaign-insights-api.test.mjs .env.example package.json -m "feat: refresh campaign insights on demand"
```

### Task 16: Add the compact post-campaign review and explicit pattern proposal

**Files:**
- Create: `admin/campaign.insights.js`
- Create: `admin/campaign.insights.test.mjs`
- Modify: `admin/campaign.js`
- Modify: `admin/campaign.view.js`
- Modify: `admin/campaign.css`
- Modify: `admin/campaign.repository.js`

- [ ] **Step 1: Write failing comparison/learning tests**

Assert comparisons stay within compatible provider/channel/format/metric groups; observations cite item and snapshot IDs; only two or three accepted learnings render; `repeat|change|stop` are the only actions; proposal creates version N+1 inactive and leaves version N/past campaigns unchanged. Assert the proposal RPC payload contains only pattern ID, rule change, and learning IDs—never actor, creator, approver, or session-email fields.

- [ ] **Step 2: Implement a small review model**

Export `groupCompatibleResults`, `candidateObservations`, and `validateLearning`. No predictive scoring, attribution model, AI-generated certainty, or cross-platform metric blending.

- [ ] **Step 3: Add the review beneath the control room**

Show latest snapshot time, supported comparisons, manual-entry action, refresh action, error/permission note, and 2–3 learning forms. Every observation links back to its item/snapshot evidence. “Use this in future” previews the exact rule diff and creates an inactive proposal only after confirmation.

- [ ] **Step 4: Verify and commit**

Run: `node --test admin/campaign.insights.test.mjs tests/campaign-insights-api.test.mjs && npm run test:all`

Expected: PASS.

```bash
git add -- admin/campaign.insights.js admin/campaign.insights.test.mjs admin/campaign.js admin/campaign.view.js admin/campaign.css admin/campaign.repository.js
git commit --only admin/campaign.insights.js admin/campaign.insights.test.mjs admin/campaign.js admin/campaign.view.js admin/campaign.css admin/campaign.repository.js -m "feat: add post-campaign learning review"
```

---

### Task 17: Final local verification and handoff

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/handovers/2026-08-13-family-frequencies-campaign-cms-v1.md`

- [ ] **Step 1: Run every local gate**

```bash
npm run test:all
git diff --check
rg -n "n8n-production-4a398|railway.app" admin api/campaign-insights.js lib/meta-insights.js supabase/migrations/20260813_campaign_cms_*.sql
git status --short --branch
```

Expected: tests PASS, clean diff check, no retired-runtime references in new code, and only intended files changed.

- [ ] **Step 2: Verify failure and accessibility states locally**

Exercise empty campaign, September missing assets, collision, late plan, stale edit, partial approval, delivery failure, manual publish, Meta unavailable, and manual metrics. Verify phone and desktop widths, keyboard use, focus visibility, reduced motion, and editorial/delivery hierarchy.

- [ ] **Step 3: Write a factual handoff**

Record what is local, committed, pushed, PR-based, migrated, deployed, account-connected, and live. The expected result for this implementation task is local/committed only unless Holly separately authorises more. Include exact migrations not applied, rollout flag default false, Claude manifest keys awaiting import, and the Git-metadata status.

- [ ] **Step 4: Commit exact documentation**

```bash
git add -- README.md docs/superpowers/handovers/2026-08-13-family-frequencies-campaign-cms-v1.md
git commit --only README.md docs/superpowers/handovers/2026-08-13-family-frequencies-campaign-cms-v1.md -m "docs: hand off campaign CMS V1"
```

- [ ] **Step 5: Stop before external rollout**

Do not apply migrations remotely, enable the flag, deploy, connect Meta, install Postiz, touch the NUC, or publish content. Present verification evidence and request a separate rollout decision.

## Plan self-review checklist

- **Spec coverage:** Tasks 1–13 cover the usable control room, September placeholders, shared calendar, ownership/readiness/approvals/history, manual/native route, and fake adapter. Tasks 14–16 cover later read-only insights and explicit learning promotion. Task 17 covers acceptance and factual handoff.
- **No duplication:** content factory remains a candidate producer; Claude import remains separate; Postiz remains future delivery; old scheduler code is preserved as reference but removed from navigation only after acceptance.
- **No unsafe external action:** all implementation verification is local/mocked. Remote migrations, deploys, credentials, posts, NUC, Postiz, and spending are explicit stop gates.
- **Rollback:** rollout flag defaults off; migrations are additive; legacy Scheduling remains until usable-V1 acceptance and can be restored with one commit; no old workflow files are deleted.
- **Git safety:** all commits use exact paths; the current read-only Git metadata blocker must be resolved with a new isolated writable worktree or primary-task assistance before implementation.
- **Audit identity:** every authenticated browser RPC derives the actor from `auth.jwt()` inside PostgreSQL, rejects blank/non-admin identity, and accepts no client-supplied attribution. The only fixed author is the trusted migration seed label; any future service-role attribution path requires separate review.
- **Scope control:** no generic workflow builder, roles engine, asset library, analytics warehouse, cron insights, paid ads, auto pattern mutation, or imagined Postiz API.
