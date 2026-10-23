# Design System — Baseball Notes

Updated 2026-10-23 for the result-first presentation refinement. This document supersedes the early preview's sample-data and icon policy. `SPEC.md` and the current capability/contracts remain the functional source of truth.

## Concept and data boundary

**Sports Broadcast × Scouting Report**. Games prioritize opposed teams, score and status; Player prioritizes the real name and role-specific recorded statistics; HOT uses a prominent leader followed by compact rows. Analytical and personal screens use lists, rules, disclosures and meaningful charts rather than identical cards.

Production uses saved NPB 2026 data and admitted MLB Historical 2014–2025, with Regular/Postseason isolated. NPB HOT/Ranking remain gated. There is no production mock-data fallback, MLB Current, official Career claim or invented portrait/number. See `astra-reconstruction-research.md` for actual competitor-screen research and the route inventory.

## CSS ownership

- `src/ui/styles.css`: theme tokens, reset, typography, shared controls, shell, dialog, semantic data states.
- `src/ui/feature-layouts.css`: retained specialist layouts needed by existing Analysis, persistence, charts and product surfaces.
- `src/ui/final-design.css`: dedicated Home / Player / Game / HOT / Records / analytical / personal compositions and responsive adaptations.

Import order is explicit in `src/main.tsx`. Avoid adding competing global reset/token blocks or anonymous overrides at file ends. Shared interaction rules belong to the foundation; a screen-specific composition belongs to the screen layer.

## Palette and typography

| Token purpose | Light | Dark |
|---|---|---|
| Background | `#f3f6fa` | `#0b1320` |
| Surface | `#ffffff` | `#111f30` |
| Elevated | `#ffffff` | `#182a40` |
| Text | `#12253b` | `#ecf2f9` |
| Muted | `#59697c` | `#a4b3c6` |
| Brand | `#204fcf` | `#9db8ff` |

Game and featured-Home surfaces retain their own readable light text. Player uses an editorial name/major-stat heading on the page surface; HOT uses one lead entry with a brand rule, then dense rows. These accents are app colours, not official team colours. On a 360–390px viewport at standard text size, body is 14px with 1.5 line height, controls 13–14px and stat captions 12px. Page titles, player names and headline stats are 20px, HOT lead names 17px and subsequent names 15px; ordinary stat values are 16–17px. Game scores remain distinct at 32px. Avoid promotional typography on phone screens. Desktop headings grow moderately with available width. These are rem-based scales, not a restriction on Android text enlargement. Navigation and help controls retain 44px-or-larger targets. A stat guide's button stretches over its own cell so the visible label and value can sit together without a separate 44px label row; no adjacent cell is covered. HOT metric columns wrap with Android font scale instead of squeezing values. Numbers use tabular figures. System fonts avoid extra network/font dependencies.

## Icons and asset rights

Basic navigation and actions use the installed **Lucide** set (ISC). The old handwritten baseball/bat/home-plate module has been removed; do not reintroduce it or build a decorative equipment-icon library. Brand identity uses the wordmark. Information-bearing charts can use CSS/SVG; that does not authorize decorative clip art.

Use only the existing visual availability/usage contracts. No new player photo, official logo, lookalike generated logo or unverified team colour is introduced. The signature Player hero uses the real name, scoped team/role and statistics without a giant initial-only substitute. Small existing identity marks in rows are secondary navigation aids.

## Navigation and screen primitives

Five primary destinations: **ホーム / 試合 / 選手 / 記録 / My**. Existing HashRouter paths, public deep links, validated queries and native Back translation retain their meaning. One natural document scroll is used. Native dialogs temporarily lock the document and retain a visible close action.

The PR #26 refinement uses a single Player context row above identity: year, competition, compact Back and a labelled action dialog. HOT keeps visible mode tabs and a category/window summary, with secondary criteria inside an expandable row. Game separates opposed team labels from its full-width numeric score row. Nested dialogs share a document scroll lock so a route exit cannot leave scrolling disabled. See [visual-refinement.md](visual-refinement.md) for same-condition captures and measured hierarchy changes.

- Shared controls/statuses: `components.tsx`, `design-system.tsx`, `app-dialog.tsx`.
- Signature identity/headline/record/discovery: `signature.tsx`.
- Comparison chart: `comparison-bars.tsx`, using existing comparison formatters and unavailable/partial semantics.
- Full data/detail engines stay in their existing domain/application/readers; presentation does not recalculate eligibility or recreate Watch logic.

Home gives seasonal/game/player context before discovery. Player retains all Stats, Analysis, Trends, Game Log and saved history through accessible tabs/disclosures; year history and comparison are direct links below its major statistics. Search prioritizes input/results and keeps active secondary filters visible in a closed disclosure. Row comparison/collection actions share a labelled dialog, while Favorites stays direct. Metric labels are dotted-underlined buttons opening the existing full explanation, instead of repeating a separate info icon at every number. Explorer shows result scope and compact primary controls; detailed criteria, methodology and secondary routes are disclosed. My starts with followed/saved entities, then organized collections/conditions/history. フォローの変化 means observed data changes, not Push. See [intuitive-ui.md](intuitive-ui.md).

## States, accessibility and performance

Loading, network failure/retry, empty result, unsupported capability, partial coverage, stale and saved-response fallback remain separate. A real zero is preserved; unknown remains `—`. Scope, date, partial warnings and attribution remain discoverable even when explanatory copy is disclosed.

Keep semantic headings/tables/labels, keyboard focus, local metric help, native dialog Escape/focus return, 44px action targets and reduced motion. Check 360px first, then 390/768/1280 widths and both themes. Browser/build evidence does not prove Android device/TalkBack behaviour.

Retain lazy route readers, bounded Historical reads and rendering limits. Home does not add form-projection fetching. Do not fetch all profiles/PA for a visual feature or reset local Favorites/Collections/Saved Views/Activity/Watch state.
