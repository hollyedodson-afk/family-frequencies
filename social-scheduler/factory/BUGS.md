# FF Content Factory — Bugs Register

Every issue found during the build, with severity + resolution. Rule: nothing is reported "done" while an item here is open/unresolved. Sweep this + `npm test` + `npx tsc --noEmit` + `npm audit` before any completion claim.

| ID | Found in | Issue | Severity | Status | Resolution |
|----|----------|-------|----------|--------|------------|
| BUG-01 | Task 8 (tsconfig) | `tsconfig.json` missing `allowImportingTsExtensions` + `noEmit`, causing TS5097 on every `.ts`-extension import → `tsc --noEmit` failed across all source/test files | High (typecheck broken) | ✅ FIXED | Added both options for `moduleResolution: "bundler"`. Commit `bc7caac`. `tsc --noEmit` now clean. |
| BUG-02 | Task 1 scaffold (`npm audit`) | esbuild dev-server advisory GHSA-67mh-4wv8-2f99 pulled transitively via `vitest`→`vite`. npm aggregated it as "3 moderate, 1 high, 1 critical" but the root advisory is a single **moderate**, and it only affects an exposed esbuild **dev server** — which this CLI/test project never runs (not exploitable in our usage). | Moderate (dev-only, not exploitable here) | ✅ FIXED | Bumped `vitest` ^2.1 → ^4.1.10 (pulls patched vite/esbuild). `npm audit` = **0 vulnerabilities**; all tests still green. Commit `e6f9ddc`. |
| BUG-03 | Task 7 review | `writeCopy` threw an opaque `Unexpected end of JSON input` when the caption model returned no/ malformed JSON — non-actionable, and (before the orchestrator's per-entry try/catch) risked aborting a batch | Minor | ✅ FIXED | Added explicit `-1` guards + try/catch throwing descriptive errors (`caption response contained no JSON object: …` / `… was not valid JSON: …`). 2 new tests. Commit `3e639b7`. |
| BUG-04 | Task 7 review | `buildCaptionPrompt` produced a dangling `", , "` in the facts line when `event_facts.time` was absent | Minor (cosmetic) | ✅ FIXED | Facts now `filter(Boolean).join(", ")`. 1 new test asserts no `", ,"`. Commit `3e639b7`. |
| BUG-05 | Final review | `RenderResult` interface exported from `src/types.ts` but never used (CLI uses inline `OutputRecord`) — dead code | Minor (dead code) | ✅ FIXED | Removed the unused interface. `tsc`/tests still green. |

## Non-bugs (noted for completeness)
- **npm `allow-scripts` warning** (esbuild/fsevents have install scripts not in this sandbox's allowlist). This is an npm-config/sandbox notice, **not** a vulnerability or code defect — dependency install scripts for a well-known toolchain. No action; recorded so it isn't mistaken for an open issue.

## Open items
_None._ All found issues resolved. Toolchain state at last sweep: `npm test` 13/13 pass · `tsc --noEmit` clean · `npm audit` 0 vulnerabilities.
