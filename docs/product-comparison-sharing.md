# Product Expansion Batch 5

## Scope and boundaries

Team Compare, saved-season comparisons, local Collection dashboards and bounded
display exports reuse existing canonical public projections. No collector, source
acquisition, canonical DB write, migration, HOT/ranking qualification, Coverage or
Current MLB change is introduced. Recurring cost remains ¥0.

Routes retain five primary destinations; Discovery, Player, Team Hub and My link
to the additions. A comparison is descriptive exploration, never an official
standings/ranking result. Unknown values remain null. Partial Coverage remains
visible and is not promoted by a successful UI fetch.

## Team Compare

`#/NPB/team-compare` and `#/MLB/team-compare` accept up to four unique canonical
`teams`, `season`, `view` and `metric` URL parameters. Each league is isolated.

NPB reuses the coordinated Catalog and Team Season family, requiring the same
effectiveDate **and** generatedAt. Season W/L/T/runs and saved batting/pitching
aggregates are available. Recent is explicitly **14-day final Game results only**:
up to 14 date payloads, concurrency three, anchored to saved effectiveDate, with
date Coverage and missing final scores respected. It does not fabricate team
Recent batting/pitching or claim current/live data.

MLB uses a single small Team Hub payload per selected team, concurrency three,
selected historical season and explicit Regular/Postseason subtree. Optional
`comparisonViews` contains 7/14/30 calendar-day and home/away summaries, computed
from each Game's actual teams and validated Facts. Team Hub original totals,
player contributions and latest Games remain unchanged. All publication paths
already run the shared generator, so the whole derived family accompanies the
preserved immutable archives. Legacy payloads without the optional views show
unavailable instead of substituting Season values.

## Saved-season comparisons

`#/MLB/season-compare?kind=player|team&entity=<canonical-id>&years=2020,2021,...`
supports at most six collected years, role and metric. Player comparison reads one
existing multi-year profile; team comparison reads up to six Team Hub payloads.
Regular/Postseason never mix. It is **保存済みシーズン比較**, not Career.

Only an actual calendar predecessor (`year - 1`) yields a prior-year delta;
missing metrics/years remain unavailable. A selected 2020 rate has its actual
sample and shortened-season context rather than an assumed 162-game denominator.
Graphs show one chosen metric, with samples and secondary metrics in compact
rows. An explicitly empty year selection is not silently restored. NPB currently
has only 2026 and cannot manufacture history or a year-over-year change.

## Collection dashboard and persistence

`#/<league>/library/collections/<local-id>` is device-only. Existing library v1
and Favorites schemas/keys are unchanged. There are at most 12 rendered players
per page, separate League/competition/year/role/window selection, Favorite marks,
2–4 same-league Compare candidates and links to Trends/Analysis/Season/Milestones.
Trends expand for one player at a time. NPB uses one bulk Season/Recent projection
plus Directory; MLB Season uses a bulk year projection plus metadata, while
Historical Recent uses at most 12 cached profiles with concurrency three.

The existing Preferences and last-successful-response cache adapters remain in
use. Offline payload failures preserve local collections and render an explicit
data error. Existing corrupt/future storage handling, reset isolation, reload
persistence and legacy migration are retained. No cloud sync/account/analytics.

## Share contract

Sharing uses the public GitHub Pages origin plus existing hash routes, canonical
IDs and a whitelist of portable conditions. Player, Team, Game, MLB Series,
Player/Team/Season Compare and Data/Recent/Season Explorer are supported. Native
custom/app links translate these into the same router. Local Collection/Saved
View IDs, unknown query keys and credentials are excluded. Saved Views share
their portable **conditions**, not their local identifier.

User action invokes the Web Share API where available; clipboard is the fallback,
then a selectable URL when clipboard is unavailable. Nothing is sent to an
analytics/backend service. Native Back returns Collection details to the local
library; standalone comparisons return to Discovery with Postseason context.

## Export rights and contract

Rights rechecked **2026-10-08** against the official Retrosheet notice:
https://www.retrosheet.org/notice.txt . It explicitly permits use, redistribution
and commercial products provided its required credit appears prominently.
The exact required credit is preserved in `RETROSHEET_EXPORT_CREDIT` and is the
second CSV record. Existing app Data Sources attribution remains unchanged.
Chadwick identity attribution and ODC-BY reference are also retained.

`DisplayExport` is only MLB, at most 40 currently displayed aggregate rows and
20 columns, with explicit scope, saved date and Coverage. Supported screens are
Player/Team/Season Compare and the current Data Explorer page. Null is an empty
CSV field, actual zero is zero, outs remain integer `outsRecorded`, and string
cells are protected against spreadsheet formula injection. It does not expose
PA raw rows, provider identifiers, images, or a bulk archive/export endpoint.
NPB nf3 remains provisional: this batch does **not** infer CSV redistribution
permission, so NPB CSV is disabled. NPB portable URL sharing transfers no dataset.

## Verification and rollback

Tests cover scope/identity, generation mismatch, null/sample semantics, bounded
reads, calendar windows, home/away, preserved source objects, exact predecessor
delta, direct native links, private local IDs, CSV rights/size/formula protection,
dashboard bounded loading and offline local-data retention. All earlier tests,
Web/Vercel build and Android debug APK/unsigned AAB are required before merge.

App-only coordinated publication preserves NPB and both historical archives,
then generates only the additive Team Hub comparison fields. Audit original
archive hashes and old Team Hub root data separately; whole Team Hub byte hashes
necessarily change. Public HTTP/date/identity/Gate validation and 360px Light/Dark
smoke checks follow deployment. Rollback reverts the application/additive derived
artifact, without a canonical migration or destructive storage operation.
