# Family Frequencies Admin: Executive Calm Design

**Date:** 2026-10-06  
**Status:** Approved visual direction; implementation pending  
**Scope:** Internal `/admin` and embedded social scheduler only

## Summary

Redesign the Family Frequencies admin as a quiet, precise operating tool. The approved direction is **Executive Calm**: a dark charcoal navigation rail, light neutral work surfaces, compact information density, restrained Family Frequencies colour, and one consistent component language across events, attendees, scheduling, and audience reporting.

This is an internal product redesign. It does not change the public website, public event pages, ticket purchasing, Supabase security rules, payment behaviour, or n8n publishing workflows.

## Decisions Locked With Holly

- Use the quiet and precise option rather than a warmer branded studio or dark control-room theme.
- Land on an Overview dashboard after sign-in.
- Keep the scheduler fully functional inside Admin.
- Remove the scheduler's duplicate navigation when embedded.
- Preserve the existing scheduler, APIs, Supabase data, and publishing workflows.
- Design primarily for desktop operational work, with a coherent smaller-screen mode.

## Experience Goal

Holly or Toby should be able to sign in, understand what needs attention, and act without hunting across separate tools. The interface should feel comparable in finish to Linear or Stripe while remaining recognisably Family Frequencies.

The product should feel calm because hierarchy is clear, not because information has been removed. Density is allowed where it helps scanning. Colour is reserved for selection, status, focus, and primary actions.

## Information Architecture

The persistent left navigation contains:

1. **Overview** - operational summary and actions requiring attention.
2. **Events** - event list, editing, publishing, and public-page status.
3. **Attendees** - capacity, reservations, payment confirmation, and export.
4. **Scheduling** - social queue, calendar, library, feed preview, and post editing.
5. **Audience** - subscriber and event-performance reporting.

The signed-in user and Sign out action sit at the bottom of the sidebar. There is no separate scheduler navigation rail inside the embedded scheduler.

## Visual System

### Scene

The admin is used on a laptop in daylight, often between event and content tasks. It must remain legible in a bright room, support fast scanning, and feel composed rather than theatrical. The default theme is therefore light with a dark navigation rail.

### Colour

- Sidebar: charcoal `#151B23`.
- Primary text: near-black `#171C22`.
- Main surface: `#FBFBFC`.
- Workspace canvas: `#F6F7F8`.
- Dividers: `#DFE3E8`.
- Primary action: Family Frequencies navy `#1A2B40`.
- Focus and selected emphasis: gold `#EEB43D`.
- Rose and blue remain available for meaningful event or content states, not decoration.
- Success, warning, danger, and information colours use dedicated semantic tokens with accessible text contrast.

Gold, blue, and rose together should occupy less than 10% of a typical screen. Inactive controls remain neutral.

### Typography

- Use one neutral product family across headings, labels, controls, data, and body text.
- Prefer the existing Barlow family with system sans-serif fallback.
- Reserve Barlow Condensed for the small Family Frequencies brand lockup only.
- Remove uppercase display headings and tracked uppercase labels from normal product UI.
- Use a fixed product scale rather than viewport-scaled typography.

Recommended scale:

- Page title: 20px / 700.
- Section title: 14px / 700.
- Body and controls: 13-14px / 500-650.
- Metadata: 11-12px / 500-650.

### Shape, Depth, and Spacing

- Use a 4px spacing base.
- Controls use 5-6px radii.
- Panels and popovers use 8px radii.
- Avoid decorative floating cards and nested card layouts.
- Use dividers, grouping, and surface changes before shadows.
- Shadows are limited to overlays and the outer preview shell, with no more than 8px blur.
- Standard transitions are 150-200ms and explain state changes only.
- All motion has a reduced-motion alternative.

## Shared Admin Shell

The shell owns global navigation, current-user identity, page titles, and page-level actions. Each tool renders into the same content region and uses the same buttons, inputs, status pills, tables, empty states, toasts, and loading states.

Desktop structure:

- 220px fixed sidebar.
- Fluid content area.
- Optional 320-360px detail inspector where a workflow benefits from persistent context.

The sidebar may collapse to icons at intermediate widths. On narrow screens it becomes an off-canvas drawer. The content area never retains two simultaneous sidebars.

## Overview

Overview is the default post-login route. It answers four questions:

- What events are coming up?
- What requires attention today?
- What content publishes next?
- Is the audience growing?

The page uses an unframed summary strip followed by two working columns:

- Upcoming events with date, venue, status, and direct action.
- Needs attention, including pending bank transfers and content approval issues.
- Publishing next, with channel, format, and scheduled time.
- Audience snapshot with subscriber count, recent growth, source, and last-updated state.

Metrics must link to the underlying tool. The dashboard does not use decorative tiles with no drill-down.

### Overview Data Sources

- Events and ticket counts come from the existing authenticated Supabase queries used by Admin.
- Subscriber counts come from the existing `/api/stats` endpoint.
- Scheduling summaries reuse the scheduler's existing Google Sheet read path through a small shared read-only data module. The scheduler remains the only owner of post mutations.
- Every remote block shows loading, empty, error, fallback, and last-updated states independently so one unavailable source does not blank the page.

## Events

Events use a list-detail workflow.

- The left or primary column lists events by date with status, ticketing type, and public-page state.
- Selecting an event opens its editor without losing list context.
- New event uses the same editor in creation mode.
- Fields are grouped into Details, Artwork and sponsors, Ticketing, and Publishing.
- Ticketing fields appear progressively when Ticketed event is enabled.
- Save and Publish are primary workflow actions. Delete is visually separated as destructive.
- Unsaved changes are clear before selection or navigation changes.
- Publishing success includes the public URL and next logical action.

The existing event fields and publish behaviour remain intact.

## Attendees

Attendees also use a list-detail workflow:

- Ticketed events appear in a compact event list with sold, capacity, pending, and paid counts.
- The selected event shows a capacity summary and attendee table.
- Filters include All, Pending, Paid, Cancelled, and Refunded.
- Search matches buyer name, email, and payment reference.
- Pending reservations expose a clear Mark paid action.
- Cancellation and refund actions retain confirmation and error handling.
- CSV export reflects the current event and remains available at page level.

Status is always represented by text plus colour. Capacity is shown numerically as well as visually.

## Scheduling

Scheduling keeps the existing tool and workflows but adopts the shared shell and component system.

### Embedded Mode

- The Admin sidebar remains the only global navigation.
- Scheduler views become compact top tabs: Inbox, Calendar, Library, and Feed.
- Status filters sit in the same toolbar.
- The queue or selected view occupies the centre.
- The selected post opens in a persistent right-hand inspector.
- New post, Refresh, and view-specific actions remain at page level.
- The existing scheduler rail and its Family Frequencies header are hidden.

The existing same-origin iframe boundary may remain to reduce regression risk. Embedded mode must render only the scheduler workspace and inspector, with shared design tokens loaded by both Admin and the scheduler. The result should appear continuous even though the scheduler retains implementation isolation.

### Standalone Mode

The full-screen scheduler remains available for focused work. It uses the same visual tokens and provides a clear Back to Admin action. Standalone mode may include the compact scheduler identity header but must not diverge into a second design system.

### Scheduler Behaviour Preserved

- Sheet loading and local fixture fallback.
- Queue filters and selection.
- Calendar drag and reschedule behaviour.
- Library and feed views.
- Post creation and editing.
- Approval, rejection, deletion, upload, and n8n mutation flows.
- Toasts, errors, and existing workflow safeguards.

## Audience

Audience replaces the current sparse Stats presentation with a small operational report:

- Total subscribers.
- Net growth in the last 30 days.
- Data source and last update.
- Event ticket summary where existing Supabase data supports it: reservations, paid tickets, and collected or expected revenue.

The first implementation should only show metrics backed by existing data. No invented engagement metrics or placeholder charts are allowed.

## Component Vocabulary

The redesign standardises:

- Primary, secondary, quiet, and destructive buttons.
- Icon buttons with accessible names and tooltips.
- Text, select, date, time, textarea, checkbox, and file controls.
- Segmented tabs and filter chips.
- Status pills with text labels.
- Tables with responsive row alternatives.
- Empty, loading, error, and unavailable states.
- Toasts and inline validation.
- Confirmation patterns for destructive actions.
- Right-hand inspectors and narrow-screen drawers.

Every interactive component includes default, hover, focus-visible, active, disabled, loading, success, and error states where applicable.

## Responsive Behaviour

### 1280px and above

- Full sidebar.
- List-detail layouts may use two columns.
- Scheduling uses queue plus persistent inspector.

### 900-1279px

- Sidebar may collapse to icon mode.
- Secondary panels narrow or stack where needed.
- Scheduler inspector becomes overlayable or collapsible.

### Below 900px

- Sidebar becomes a drawer opened from the page header.
- Page actions wrap without changing control height.
- Tables become horizontally scrollable only where preserving columns is essential; otherwise they become labelled rows.
- Editors and inspectors become full-height drawers.
- Scheduling retains access to all views but shows one primary pane at a time.

The admin is desktop-first, but no text, controls, or actions may overlap or become unreachable on smaller screens.

## Accessibility

- Body text meets WCAG AA 4.5:1 contrast.
- Large text and non-text controls meet applicable 3:1 requirements.
- Focus-visible styling uses the gold focus token plus sufficient contrast.
- Navigation, tabs, filters, tables, drawers, and status changes use semantic markup and ARIA only where native semantics are insufficient.
- Icons never carry meaning without an accessible name or adjacent text.
- Status is not communicated by colour alone.
- Keyboard users can reach and operate all actions in logical order.
- Drawers and confirmations manage focus correctly and restore it on close.

## Loading, Errors, and Empty States

- Use skeletons for list and dashboard loading states.
- An unavailable source affects only its own section.
- Errors explain what failed and offer Retry when useful.
- Empty states explain the next available action.
- Mutation actions show pending state and prevent duplicate submission.
- Optimistic UI is used only where the current backend contract can safely reconcile failure.
- Scheduler fixture fallback remains clearly labelled as sample data.

## Technical Boundaries

- Keep the existing plain HTML, CSS, and JavaScript approach.
- Do not introduce React or a new application framework.
- Do not change public page markup or styles.
- Do not change Supabase RLS, admin allowlisting, ticketing rules, bank-transfer logic, or n8n workflow contracts as part of this redesign.
- Do not add new serverless functions solely for dashboard presentation.
- Prefer a shared CSS token file and a small shared scheduler read module over copying logic between Admin and Scheduler.
- Preserve the current standalone scheduler URL.

## Verification

Implementation is complete only after:

- Existing admin logic and API tests pass.
- Scheduler smoke tests pass unchanged or with equivalent coverage.
- Overview data is verified against its source, including failure and empty states.
- Event create, edit, save, publish, and delete workflows are exercised locally or in a safe test environment.
- Attendee load, status update, cancellation, and CSV export are exercised.
- Scheduler Inbox, Calendar, Library, Feed, post selection, editing, creation, and mutation actions are exercised.
- Login and sign-out continue to work.
- Browser screenshots are reviewed at 1440x900, 1024x768, and 390x844.
- Keyboard navigation, focus visibility, contrast, overflow, and reduced motion are checked.
- No public customer-facing route or asset changes in the final diff.

## Delivery Sequence

1. Add shared product tokens and update the global admin shell.
2. Add Overview using real existing data sources.
3. Redesign Events and its editor without changing event behaviour.
4. Redesign Attendees and payment actions.
5. Apply the shared system to Scheduling embedded and standalone modes.
6. Build the source-backed Audience view.
7. Complete responsive, accessibility, and regression QA.

## Out of Scope

- Public website redesign.
- Public event-template redesign.
- Stripe activation or payment-provider work.
- New ticket types or ticket-purchase fields.
- Campaign CMS architecture not already present in this branch.
- Replacing Google Sheets, n8n, Cloudinary, Telegram approval, Supabase, or Kit.
- A new mobile application.
