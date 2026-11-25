# NPB Draft / Young Player Discovery / Lifecycle

## Scope and contracts

This Product track consumes the existing, validated public Catalog and saved Regular Season/Recent projections. It does not add a source, change canonical identity, acquire profile data, write the canonical database, or modify any Production Gate. Additional recurring cost is ¥0.

NPB only: `/NPB/talent` replaces the old Draft placeholder. MLB Draft/Prospects remain unavailable. The legacy `/NPB/talent?tab=1` still opens the unimplemented Prospects surface. Existing Player, Team, Compare and public deep links remain compatible.

Views:

- `view=draft`: confirmed Draft years; `year=2022` is a Draft Class. Unknown years are excluded by default, optionally included with `unknown=1`. This is **collected players with verified metadata**, not the complete Draft register.
- `view=young`: age calculated from verified DOB at `asOf`, defaulting to Catalog effectiveDate, with an inclusive age ceiling of 25 by default. This does not certify Prospects, Rookie qualification or current roster membership.
- `view=school`: original confirmed school/amateur labels, partial text matching. No school canonical merging, graduation or enrollment interval inference.
- Player `/more`: lightweight school/amateur → confirmed Draft → partial saved affiliation history → saved Season section. Unknown years are omitted, not interpolated. Generic debutYear is not translated to NPB debut; Draft is not joinedYear.

Filters: exact Draft year or inclusive year range, exact stored round label, regular/developmental/unknown Draft type, canonical-matched Draft team, primary position, latest saved team, age bounds/reference date, player name, school/amateur label, batting/pitching data availability and minimum PA or recorded outs. A source's raw historical team label is displayed but never silently mapped into the Draft-team filter. 3 pitching outs = 1 inning.

Unsupported competitions/seasons, malformed dates, invalid bounds or unknown team/position/round are explicitly reported with no incompatible data query. URL query parameters retain filters, page and 2–4 Compare selections across reload/back. Compare uses the existing engine, league, role and Season/7d/14d/30d context; it does not create a new ranking.

## Evidence and partial coverage

Snapshot: public Catalog effectiveDate **2026-10-07**, 739 canonical players. Counts are computed from the loaded Catalog at runtime, not hardcoded in UI.

| Field | Known / total |
|---|---:|
| Draft year | 623 / 739 |
| Draft round | 602 / 739 |
| Draft type | 601 / 739 |
| Canonical-matched Draft team | 33 / 739 |
| Birth date | 665 / 739 |
| School / amateur label union | 653 / 739 |
| Partial affiliation history | 562 / 739 |

Null Draft information means **unconfirmed**, never undrafted. Unknown DOB means unknown age and is excluded from an age-filtered result. Pending/conflicting registry candidates are not consumed. Latest saved affiliation is not current registration evidence.

Existing field provenance and attribution remain unchanged: Wikidata CC0, Wikipedia CC BY-SA and other already accepted Catalog credits. The Player Lifecycle section links source articles and license URLs with transformation disclosure; full field/revision provenance remains in the existing publication/registry contracts and source documents. No new asset, source-rights interpretation or export permission is added.

## Fetch, state and performance

- One shared Catalog response, plus **one** bulk Season or selected Recent response. No 739 per-player Profile requests. Changing metadata filters, pagination or Compare selection triggers no additional payload requests; changing period fetches only that period projection.
- Both projection identity (canonical ID/name/saved team) and effectiveDate must match the Catalog. A mismatched generation is an error; Catalog metadata remains visible and statistics render `—`.
- Results render 30 at a time. Compare caps at four same-stat-role candidates. Natural page scrolling; no nested results scroller or wide table.
- Existing validated-response persistent cache provides offline fallback. No new local persistence key/schema; URL query is the portable view state. Existing Favorites/Collections are untouched.
- Snapshot decoded JSON sizes: Catalog 1,249,191 B; Season 1,521,095 B; Recent7/14/30: 573,663 / 724,549 / 888,763 B. These are reused published payloads; no new public payload.
- Local Node benchmark of 100 evaluations per query: Draft Class 3.0 ms, age/pitcher 2.5 ms, school 6.0 ms, year-range/round 2.4 ms. Device timings may differ.

Metadata availability, statistic loading/error, minimum-sample empty results, partial Fact Coverage and unknown individual metrics remain distinct. Rankings/HOT gates are not used as a discovery ranking or bypassed.

## Integration and validation

### 2025年ドラフトから入団・一軍初出場へ

2025年の支配下1位指名のうち、立石正広、小島大河、中西聖輝、松下歩叶、石垣元気、竹丸和幸の6人を確認。ドラフト同期の選手一覧から、指名時の所属、最初の所属シーズン、一軍公式戦の初出場、収録済みの試合詳細と2026年の年度成績をたどれる。2026年ドラフトの予想・指名結果は従来の保存版を保持する。

指名・入団の採用元は日本語版Wikipediaの[固定版111790323](https://ja.wikipedia.org/w/index.php?curid=5129630&oldid=111790323)（CC BY-SA 4.0）。各選手記事の固定版から初出場日と最初の所属シーズンを抜粋した。指名球団・順位・当時の所属をNPBの指名一覧、入団を球団または当時の所属先の発表、初出場をNPBの投打成績で照合した。公式資料は照合とリンクに使用し、表や記事本文は収録していない。

| 選手 | 採用した選手記事 | 初出場の公式記録 |
| --- | --- | --- |
| 立石正広 | [固定版111543816](https://ja.wikipedia.org/w/index.php?oldid=111543816) | [2026年5月19日](https://npb.jp/scores/2026/0519/t-d-10/box.html) |
| 小島大河 | [固定版111898458](https://ja.wikipedia.org/w/index.php?oldid=111898458) | [2026年3月27日](https://npb.jp/scores/2026/0327/m-l-01/box.html) |
| 中西聖輝 | [固定版111651013](https://ja.wikipedia.org/w/index.php?oldid=111651013) | [2026年4月1日](https://npb.jp/scores/2026/0401/d-g-02/box.html) |
| 松下歩叶 | [固定版111889979](https://ja.wikipedia.org/w/index.php?oldid=111889979) | [2026年5月29日](https://npb.jp/scores/2026/0529/e-s-01/box.html) |
| 石垣元気 | [固定版111655585](https://ja.wikipedia.org/w/index.php?oldid=111655585) | [2026年9月17日](https://npb.jp/scores/2026/0917/m-e-22/box.html) |
| 竹丸和幸 | [固定版111901926](https://ja.wikipedia.org/w/index.php?oldid=111901926) | [2026年3月27日](https://npb.jp/scores/2026/0327/g-t-01/box.html) |

選手記事のWikidata IDとNPB ID、公式試合記録からリンクされるNPB ID、既存のChadwick照合を同じ選手IDに確認した。石垣は試合記録の登録名「石垣元」と選手記事のNPB IDが一致。試合リンクは既存の日別索引の収録済み試合IDと日付を参照する。入団は2026年シーズンの事実として扱う。契約日、支配下登録日、現在の所属、二軍成績、新人資格は追加していない。

Entry points: Players/Search, Discovery's data tools, Home's existing Explorer links, Team Hub (saved team filter), Data Explorer, Compare and Player profile. Five primary destinations are retained. Detailed conditions are disclosed progressively for 360px.

35 targeted tests cover nullable Draft/DOB, canonical team matching, age boundaries, year ranges, role, samples, exact school-label preservation, invalid URLs, generation/identity rejection, master immutability, bounded rows, bulk requests, error preservation, loading versus empty, all four Coverage states, legacy unavailable Prospects routes, existing Compare handoff, reuse after temporary filter errors, explicit retry and successful-period restoration after another period fails, including retry isolation across periods. Full test/build, visual and delivery results are recorded in the PR.

Release procedure: app-only Pages workflow; preserve all existing NPB/MLB data artifacts. Compare public payload hashes before/after; no collector, canonical migration or Source acquisition. Android build regression uses the existing debug APK/unsigned release AAB workflow. Formal signing, Play publication, source-quality review queues, Rookie eligibility and MLB Draft/Minor League remain outside this batch.
