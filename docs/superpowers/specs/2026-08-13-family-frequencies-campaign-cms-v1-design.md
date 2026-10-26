---
title: Family Frequencies Campaign CMS V1 — design spec
date: 2026-08-13
status: approved design, awaiting written-spec review
owner: Holly
scope: Existing Family Frequencies admin and Supabase
---

# Family Frequencies Campaign CMS V1

## 1. Outcome

Add one **Campaign** control room to the existing Family Frequencies admin. Saving a new event automatically generates a useful, editable marketing campaign of planned drafts from the active versioned pattern; the team does not choose a campaign size or add every item manually. The team can then see the event timeline, real artwork previews, copy and briefs, missing inputs, owner, editorial progress, approvals, publishing state, results, and material history in one place.

The first proof campaign is **Daylight Disco at Hide, Mt Maunganui, Sunday 6 September 2026, 12–5pm, free and walk-in**. Father's Day is an optional supporting angle, not the campaign identity.

V1 succeeds when that campaign is usable and when adding three to six events produces a realistic shared marketing calendar without rebuilding each plan from scratch.

## 2. Product boundaries

### V1 owns

- Event-to-campaign generation from a deterministic, modular, versioned pattern.
- A shared collision-aware marketing calendar across events.
- Campaign-item briefs, copy, ordered asset references, owners, due dates, missing inputs, editorial status, approvals, and material history.
- A simple manual/native publishing route that is fully usable without another service.
- A vendor-neutral publishing package that a future Postiz adapter can consume.
- Read-only Meta insight snapshots, with manual entry as a fallback.
- A short post-campaign review and explicit proposals to improve future pattern versions.

### V1 does not own

- A generic multi-brand CMS, workflow builder, role system, or standalone asset library.
- A replacement for Postiz's commodity scheduling and multi-network publishing.
- Postiz installation, NUC setup, social-account connection, or an imagined Postiz API.
- Railway or n8n recovery. Railway deployments are removed and V1 has no Railway dependency.
- Artwork creation or the fidelity import from Claude Design. That remains a separate active task.
- Paid-ad analytics, an analytics warehouse, automatic audience attribution, or automatic campaign-pattern mutation.
- Deployment, account connection, posting, spending, or any other external change during implementation.

## 3. Existing-system fit

The current Supabase-backed admin remains the product shell and authentication boundary. Existing Events, Attendees, and Stats areas remain intact. The current Scheduling area is an iframe around a Google Sheet/n8n scheduler whose write actions point at the removed Railway runtime; V1 replaces that dead coordination surface with the Campaign screen after the new screen is verified.

The useful existing systems keep clear responsibilities:

- **Events admin:** supplies event facts and the trigger for campaign generation.
- **Campaign CMS:** owns planning, readiness, ownership, approvals, evidence, history, and learning.
- **Content factory:** receives a campaign-item brief and returns asset or copy candidates. Candidates never overwrite approved work silently.
- **Claude Design import:** supplies the finished September artwork and provenance after the separate fidelity-import task lands.
- **Manual/native publishing:** provides the complete V1 delivery fallback.
- **Postiz:** later receives approved publishing packages and owns delivery after handoff.
- **Meta:** supplies read-only Instagram and Facebook performance results when authorised.

This is a relational evidence graph, not a new graph database:

`event → campaign → generated item → pattern version → asset → publication → metric snapshot → learning → proposed pattern version`

Those links make every recommendation traceable while keeping the implementation small.

## 4. Campaign screen

The Campaign screen is the only new primary screen.

### 4.1 Event and campaign header

- Event switcher plus an “All campaigns” view.
- Event title, date, venue, time, free/ticketed state, and campaign phase.
- Pattern name and version used to generate the campaign.
- Readiness summary: ready for review, blocked, missing inputs, and approved counts.
- A “Create campaign” action for an event without one.
- An explicit “Review event changes” action when event facts change after generation. It previews the proposed reflow rather than silently moving work.

### 4.2 Shared calendar and timeline

- Calendar view across all events, with feed, story, reel, carousel, poster, and manual-task items.
- Event phase bands: announce, build, event week, event day, and afterglow.
- Anchored items visibly distinguished from flexible items.
- Every generator adjustment carries a short explanation such as “Moved one day earlier to avoid another feed post.”
- Unresolved collisions and late omissions are visible; they are never hidden as successful scheduling.

### 4.3 Campaign item cards

Each card shows:

- Real visual preview, or a precise missing-asset placeholder.
- Item name, channel, format, planned date, owner, and due date.
- **Editorial status as the prominent status:** planned, creating, review, approved, or blocked.
- Missing inputs such as artwork, final copy, sponsor logo, post-event photo, owner, or publishing route.
- A compact delivery badge only when relevant, for example “Manual ready,” “Postiz scheduled,” “Published,” or “Delivery failed.”

The UI must feel like one workflow. Holly does not manage parallel editorial and delivery workflows even though the data keeps them separate for correctness.

### 4.4 Item detail

Selecting an item opens its detail without leaving the campaign:

- Full preview at the intended aspect ratio; carousels show ordered slides.
- Campaign objective, creative brief, intended audience, supporting angle, and call to action.
- Editable channel-specific copy and manual/native requirements such as music, stickers, collaboration tags, or Facebook Group posting.
- Owner, due date, flexible publishing window, chosen publishing time, and collision explanation.
- Missing-input checklist.
- Approve, request changes, and block/unblock actions.
- Compact delivery section, shown only after approval or when a delivery problem exists.
- Material history with actor, time, reason, and a concise before/after summary.

### 4.5 Post-campaign review

The same screen exposes a short review after the event:

- Per-item Meta result snapshots and collection time.
- Comparisons only between compatible channels, formats, and metrics.
- Best-supported observations, with direct links to the items and snapshots behind them.
- Two or three human-approved learnings: repeat, change, or stop.
- “Use this in future campaigns” creates a proposed new pattern version. It never changes past campaigns or the active pattern automatically.

## 5. Minimal data model

The exact SQL belongs in the implementation plan. The V1 model has these responsibilities:

### `ff_campaign_patterns`

- Stable pattern identity, integer version, active state, and parent version.
- Core item definitions and optional module definitions.
- For each definition: stable key, phase, channels, format, priority, anchor or flexible window, required inputs, and collision policy.
- Creation actor, time, and evidence or learning that motivated a new version.

### `ff_campaigns`

- Link to `ff_events` and the exact pattern version used.
- Generated time, current phase, campaign review state, and close time.
- Campaign-level supporting angles and enabled optional modules.

### `ff_campaign_items`

- Stable generated item key and campaign link.
- Objective, brief, channels, format, priority, anchor/window, planned publishing time, owner, and due date.
- Editorial status: `planned | creating | review | approved | blocked`.
- Copy variants, required inputs, missing inputs, and approval actor/time.
- Delivery route: `manual | postiz`.
- Delivery status: `not_sent | ready | queued | scheduled | published | failed`.
- External ID, permalink, handoff version/checksum, last delivery error, and last sync time.
- Generator decision and the original generated baseline so deviations remain explainable.

### `ff_campaign_item_assets`

- Ordered assets per item, including carousel slide order.
- Durable URL or application path, preview URL, aspect/role, provenance, source candidate, and last-known availability.
- This is item evidence, not a generic asset-management product.

### `ff_team_members`

- The four editable team members plus “Unassigned,” with active/inactive state.
- Ownership does not create new permission roles; existing admin access remains the permission boundary.

### `ff_campaign_history`

- Material transitions and concise diffs only: generation, date move, owner change, copy or asset change, approval, request changes, handoff, delivery failure/retry, insight refresh, learning decision, and pattern-version proposal.
- Routine reads, previews, and autosaves do not create audit noise.

### `ff_metric_snapshots` and `ff_campaign_learnings`

- Raw provider metrics plus a small normalized set, media type, source, collection time, external ID, and any availability warning.
- Learning statement, action (`repeat | change | stop`), supporting item/snapshot links, decision state, and resulting proposed pattern version when promoted.

Row-level access follows the existing `ff_admins` boundary. Public event reads gain no access to campaign, history, metric, or team data.

## 6. Event-to-campaign generation

### 6.1 Modular core pattern

Every event starts with a small core:

1. Announcement or save-the-date.
2. Practical details or “what to expect.”
3. Final reminder.
4. Event-day item or manual native task.
5. Thanks, wrap-up, or recap.
6. Post-campaign review task.

Saving a new event runs this generation once automatically. “Create campaign” exists only to backfill older events that do not already have one. Regeneration is never a destructive reset.

Optional modules are enabled only when event facts require them:

- Short or full countdown sequence.
- Sponsor acknowledgement.
- Carousel explainer.
- Ticket launch or availability update for a ticketed event.
- Seasonal supporting angle, including Father's Day.
- Collaboration or Facebook Group task.
- Post-event photo, UGC, or testimonial sequence.

The September campaign can link its six feed posts, five carousel slides, seven story frames, sponsor assets, four post-event assets, A3 poster, and reusable cutouts/export provenance after the separate Claude Design import provides the final manifest. V1 does not recreate those assets.

### 6.2 Deterministic scheduling

- Anchors such as event day, final reminder, and immediate wrap-up stay fixed.
- Flexible items carry an allowed date window, channel, priority, and minimum separation rule.
- The generator processes fixed anchors first, then flexible items by priority and proximity to their preferred date.
- V1 prevents two Family Frequencies feed items from being silently assigned to the same day. Stories may cluster when the pattern explicitly allows an event-week sequence.
- When a flexible item conflicts, it moves to the nearest valid position inside its window and records the reason.
- If no valid position exists, the item is marked blocked with a visible collision. The generator does not invent a valid result.
- Approved or handed-off items are never moved by regeneration.

### 6.3 Late-created events

Late event entry must not produce an overdue backlog:

- Past publishing moments are omitted and recorded as “omitted because event was entered late.”
- Remaining core items are placed in the available windows without stacking incompatible feed posts.
- Lower-priority optional modules are dropped before core items are compressed.
- Any compressed plan is clearly labelled for review.

### 6.4 Event changes

Changing an event date, time, venue, cost, or ticketing state produces a proposed campaign diff:

- New, moved, omitted, newly blocked, and copy-invalidated items are listed.
- The user accepts or rejects the proposed reflow.
- Approved items lose approval when their material facts, copy, or assets change.
- Handed-off items require an explicit cancel-and-resend decision; they are not silently mutated.

## 7. Ownership, readiness, and approvals

- Owners come from the small editable team list; “Unassigned” is a real filterable state.
- An item is approval-ready only when required copy, required assets, owner, publishing time/window, and delivery route are present.
- Item-by-item approval is always available.
- “Approve all ready items” approves only eligible items and reports every exclusion with its reason.
- Any existing Family Frequencies admin may approve. Actor and time are recorded.
- Requesting changes requires a short reason and moves the item from review/approved to creating.
- Editing material content after approval invalidates approval. Non-material notes do not.
- A delivery failure does not invalidate editorial approval unless the content itself changes.

## 8. Publishing boundary

### 8.1 Neutral publishing package

An approved item can produce a versioned package containing:

- Stable campaign-item ID and content checksum/version.
- Channels and format.
- Channel-specific copy.
- Ordered durable asset URLs and alt text when applicable.
- Intended publishing time and `Pacific/Auckland` timezone.
- Manual/native requirements such as music, stickers, collaboration tags, or group posting.
- A callback correlation ID for delivery state, external post ID, permalink, and errors.

The package is vendor-neutral. It is not shaped around an undocumented Postiz API.

### 8.2 Manual/native adapter

- Converts the package into a clear assigned checklist with media, copy, time, and native requirements.
- Supports “Mark published” with external post ID or permalink.
- Is a complete V1 route, not a degraded placeholder.

### 8.3 Future Postiz adapter

- Maps the neutral package to the real Postiz API only after Postiz and its API are available and separately authorised.
- Before handoff, the CMS owns the chosen time.
- After handoff, Postiz owns delivery timing; the CMS mirrors returned ID, state, permalink, and error.
- Changes after handoff use explicit cancel-and-resend behavior.
- V1 verifies the boundary with a fake adapter. It does not install Postiz, touch the NUC, or connect accounts.

## 9. Meta insights and continuous improvement

### 9.1 V1 insight collection

- Read-only, on-demand “Refresh insights” for Instagram posts, Reels, Stories, and Facebook Page posts when an external ID and permission allow it.
- Store snapshots rather than overwriting results so performance over time remains evidence.
- Retain provider-native metrics and normalize only safe common concepts such as reach, views/plays, reactions/likes, comments, shares, and saves when available.
- Never compare unavailable or semantically different metrics as though they were equivalent.
- Manual metric entry remains available for missing permissions, expired Story availability, unsupported formats, or Postiz-only records.
- Failed refreshes retain the latest snapshot and show the permission/error state; they do not block campaign work.

### 9.2 Learning loop

1. Pattern version generates items.
2. The team records deviations made during production and approval.
3. Publications acquire metric snapshots and qualitative observations.
4. The post-campaign review surfaces evidence-linked candidate learnings.
5. A human accepts, edits, or rejects two or three learnings.
6. “Use this in future campaigns” proposes a new pattern version with the exact changed rule.
7. A team member explicitly activates the new version for future campaigns.

One event result never mutates the default automatically. Past campaigns retain their original pattern version and remain reproducible.

## 10. Asset handling and provenance

- Every asset reference records its source: Claude Design import, content factory, manual upload, or existing durable asset.
- The September items initially use precise required-asset keys and missing-input flags. The separate fidelity import resolves those keys to final previews and durable files/URLs.
- The CMS previews finished assets; it does not provide a design editor.
- Candidate replacement assets require explicit selection and do not overwrite approved assets.
- Missing, inaccessible, or wrong-aspect assets visibly block approval when required.
- Local ignored design/export files are not assumed to be deployable URLs. The import must provide a durable application path or hosted URL before delivery.
- A broken link exposes retry, replace, and manual/native fallback actions without losing the brief, copy, history, or approval evidence.

## 11. Failure states

| Failure | Visible behavior | Recovery |
|---|---|---|
| Missing copy, owner, asset, or route | Item shows blocked/missing input and is excluded from bulk approval | Fill the input and recheck readiness |
| No collision-free position | Item remains blocked with the conflicting items and attempted window | Move manually, expand window, or omit explicitly |
| Event entered late | Past/low-priority items are omitted with reasons; remaining plan is labelled compressed | Review and approve the shortened campaign |
| Event facts changed | Proposed diff appears; existing work is not silently moved | Accept/reject reflow and reapprove affected items |
| Content factory fails | Item stays creating with error evidence; other items remain usable | Retry candidate production or provide manually |
| Asset is inaccessible | Preview and readiness show the failed asset | Replace, restore durable URL, or use manual fallback |
| Postiz unavailable | No V1 planning or manual publishing is blocked | Use manual/native; retry future adapter later |
| Delivery fails | Compact failure badge with last error and retry/manual action | Retry unchanged package or switch route |
| Meta permission or metric unavailable | Latest snapshot remains with a warning | Reauthorise separately or enter metrics manually |
| Concurrent edit detected | Stale save is rejected with a refresh/compare prompt | Refresh and reapply intentionally |

## 12. Verification

### 12.1 Automated contracts

- Pattern validation and deterministic generation.
- Anchor preservation, flexible-window placement, channel collision rules, recorded move reasons, late-plan compression, and protection of approved/handed-off items.
- Readiness calculation, partial bulk approval, request-changes behavior, and approval invalidation after material edits.
- Publishing-package schema, content checksum/version, manual adapter, and fake Postiz adapter state reconciliation.
- Metric normalization by format, snapshot preservation, manual fallback, learning evidence links, and proposed-version creation without mutation of past campaigns.
- Database constraints and admin-only row-level access.
- Existing `npm run test:admin` remains a required regression gate.

### 12.2 Interface verification

- Desktop and mobile-width Campaign screen review.
- Keyboard navigation, focus visibility, labels, contrast, and accessible status text.
- Correct preview aspect for feed, Story/Reel, carousel, and poster assets.
- Editorial status is always the prominent status; delivery remains compact and appears only when relevant.
- Empty, loading, missing-asset, conflict, stale-edit, delivery-error, and insight-error states are understandable without technical knowledge.

### 12.3 Acceptance campaigns

The real proof campaign is the 6 September 2026 Daylight Disco. The following are **fictional test fixtures only, not announced or planned Family Frequencies events**:

| Fixture | Fictional date/type | Simulated lead time | What it proves |
|---|---|---:|---|
| A | Family workshop, Tue 15 Sep 2026 | 10 days | Short standard campaign and weekday timing |
| B | Ticketed first-aid course, Sat 19 Sep 2026 | 21 days | Ticket module and overlap with Fixture A |
| C | Family-friendly gig, Sun 20 Sep 2026 | 14 days | Back-to-back event anchors and feed collision handling |
| D | Daylight Disco, Sat 3 Oct 2026 | 28 days | Full pattern reuse and optional countdown |
| E | Nutrition talk, Thu 8 Oct 2026 | 6 days | Late entry, omission, and compressed-plan visibility |

Acceptance requires:

- September artwork resolves to real previews when the separate import manifest becomes available; until then every unresolved asset has a precise missing-input key.
- The real campaign plus any three to five fixtures produces one understandable shared calendar.
- Anchors stay fixed; flexible moves are within their allowed windows and explain themselves.
- No approved or handed-off item moves silently.
- Late entry does not create overdue work.
- Every item has a clear owner/unassigned state, editorial status, readiness, and preview or missing-asset explanation.
- Bulk approval approves only ready items and explains exclusions.
- An approved item produces the neutral package and completes a fake-adapter round trip without an external post.
- A metric snapshot plus qualitative observation can create an evidence-linked learning and proposed next pattern version without altering the original campaign.
- No request is made to Railway and no Postiz, NUC, social account, or live publishing connection is required.

## 13. Implementation and rollout order

The implementation plan should preserve these slices:

1. Data contracts, migration, RLS, and pure generator/readiness tests.
2. Campaign screen with the September campaign using explicit asset placeholders/manifest keys.
3. Collision-aware shared calendar and fictional acceptance fixtures.
4. Approvals, material history, manual/native package, and fake adapter.
5. Read-only insight snapshots, manual fallback, and post-campaign learning proposal.
6. Import-manifest reconciliation after the separate artwork task lands.

The old Scheduling iframe is removed from the admin navigation only after the Campaign screen and manual/native path pass verification. Existing workflow exports remain as historical reference; V1 does not delete or revive them.

The design is complete without real future-event details because the fixtures make the calendar rules testable. Real events replace fixtures in validation as Holly supplies them; fixtures never enter production data.
