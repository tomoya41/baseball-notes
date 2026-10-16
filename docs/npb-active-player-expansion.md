# NPB Active Player / Competition Expansion — 2026-10-16

## Scope and baseline

PR #34 / main `249c30c` is the baseline. This batch prioritizes saved 2026 Directory identities, not a new OB crawl. No production SQL writes, provider inquiries, payments, registration automation or new paid keys. Current NPB and MLB 2014–2025 releases remain independent. Source records and statistical rows are observations, not proof of current registration.

## Current-player coverage audit

The public Directory effective date is **2026-10-12**, with **740 players**. A fresh HTTP hash check confirmed the 18 protected Current/MLB payloads still match the saved baseline (5,222,780 bytes). The audit uses that validated snapshot, not an unavailable fresh SQL query.

| Measure | Before | After |
|---|---:|---:|
| Directory players | 740 | 740 |
| Exact canonical Historical matches | 572 | 577 |
| No admitted Historical rows | 168 | 163 |
| Exactly one Historical year | 89 | 91 |
| Multiple Historical years | 483 | 486 |
| No verified Wikipedia canonical bridge | 73 | 73 |
| Independently evidenced 2026 registration | unknown | unknown |

Directory presence and latest stored affiliation do not establish active, controlled or first-team registration. There is no new registration proof in this release. Unknown is not zero active players.

After expansion: known pitcher type 330 (279 with History), fielder 188 (162), unknown type 222 (136). Pitching appearances alone do not classify a two-way player. The role audit retains the Directory's existing semantics.

| Saved team | Directory | Historical |
|---|---:|---:|
| DeNA | 66 | 49 |
| オリックス | 63 | 53 |
| 広島 | 56 | 45 |
| 中日 | 63 | 51 |
| 楽天 | 62 | 46 |
| 日本ハム | 61 | 52 |
| 巨人 | 64 | 49 |
| ソフトバンク | 58 | 43 |
| 西武 | 60 | 46 |
| ロッテ | 63 | 51 |
| ヤクルト | 62 | 46 |
| 阪神 | 62 | 46 |

Existing profile availability: birthdate 665, position 518, bats/throws 667 each, height 584, weight 486, draft year 623, draft round 602. Separate school strings 456 and affiliation observations 562; neither is complete Career or current roster proof. Uniform number 0. These are saved observations, not refreshed roster assertions. No new current profile/number/registration field is claimed. `careerHistory` remains an empty legacy field; separately sourced schools/affiliations are audited under their own fields.

Reproducible read-only tool: `scripts/audit-npb-active-coverage.ts <directory.json> <catalog.json> <history.gz> .data/report.json`. It validates the three contracts and emits player/year/team/role and profile gaps privately. Missing years are missing observations, not inferred absence. Priority next is independently bridging the 73 identities and correcting source contradictions for Directory players; recent entrants/foreign-only source tables cannot be assumed to have prior NPB seasons.

## Historical recovery

MediaWiki [table syntax](https://www.mediawiki.org/wiki/Help:Tables) permits optional cell attributes separated from content by a pipe. One bounded official `action=parse` call independently confirmed empty-attribute numeric cells (`|14`, `|.450`). Accept only the empty prefix; malformed nonempty prefixes such as `2|19`, unknown templates, arithmetic discrepancies and ambiguous geometry remain rejected. Rate tolerances are unchanged. Three pinned real article excerpts and synthetic negative tests fix this behavior.

**13 Directory players** gain **17 rows**. Five become newly represented in Historical. The same general format fix recovers one existing Historical-only player's 2016 row (能見篤史); no new OB identity or OB crawl.

Regular v5: **598 players, 3,090 rows, batting 1,675 / pitching 1,415**, 2015–2025, all partial. Historical-only identities remain 21. Old 3,072 rows and all identities unchanged; no row removals or number edits. Quarantine 73 → **55**. `2|19`, `0|0`, WHIP/other arithmetic conflicts remain quarantined; no tolerance loosening.

| Year | Batting added | Pitching added | Total rows after |
|---|---:|---:|---:|
| 2015 | 0 | 0 | 93 |
| 2016 | 0 | 1 | 116 |
| 2017 | 0 | 1 | 149 |
| 2018 | 0 | 0 | 183 |
| 2019 | 0 | 0 | 223 |
| 2020 | 0 | 0 | 256 |
| 2021 | 0 | 0 | 302 |
| 2022 | 0 | 0 | 365 |
| 2023 | 0 | 1 | 396 |
| 2024 | 1 | 5 | 461 |
| 2025 | 1 | 8 | 546 |

The offline importer performs fresh SQLite scratch ingestion, exact readback and idempotent replay. It never writes Turso. Input archive SHA remains `1e383d106ef9db5329aca692d08e938e4d10dd931e945a604bb859347cdd570f`. New regular gzip SHA `5eff56db3046b37317499ef1aef0e3a10769391901fc65cb26af046c430d24ed`. Old immutable v3 and v4 assets are retained, not overwritten.

## Competition source / rights decision

Checked **2026-10-16**. This is a scope-specific use assessment, not a blanket judgment that objective scores are copyrighted. Contract, acquisition method, source expression/database and redistribution are assessed separately.

| Source / use | Coverage and identity | Acquisition / storage / modification | Web / Android display | Decision |
|---|---|---|---|---|
| Existing archived Wikipedia NPB Regular tables | 2015–2025, exact NPB ID/QID/canonical bridges, partial | Existing documented official API archive; licensed extraction, integer outs, bounded aggregate | Author/revision, modifications, CC BY-SA 4.0 required | **B**, adopted |
| Existing archived Wikipedia explicit NPB postseason table | 東克樹 only; 2023 CS First, 2024 CS First/Japan Series, 2025 CS Final | Same licensed archive; exact independently reviewed column/stage definitions, no article totals | Same CC BY-SA notices; partial scope, no Game reconstruction | **B**, adopted, 4 rows |
| Wikidata | Existing identity/profile evidence; not complete competition/player stats | CC0 structured data; official APIs and existing independent bridges | CC0; do not infer current registration | **A** for licensed identity fields, no competition Facts added |
| NPB official [Preseason 2026](https://npb.jp/preseason/2026/) | Schedule, results, team stats, qualifier leaders and links to club player lists exist | Secondary-use/unapproved-reproduction restriction in site footer; public inspection is not a bulk-ingestion license | Planned automated copied-statistics publication not cleared | **D** for the proposed bulk reuse; diagnostic reference/external links only |
| NPB official [CS rules](https://npb.jp/games/2026/info_cs.html) / stats | 2026 series rules and result/stat pages exist | Rules summarized as application logic with citation; no collected result/player dataset | No bulk result/player republication admitted | **C/D** for Facts adoption; rule reference only |
| NPB official [Japan Series 2026](https://npb.jp/nippons/2026/) | Official page schedules start 10/24; participants/results not invented | Same official-site restriction | External link only | **C/D** for automatic Facts reuse; no 2026 results imported |
| nf3 | Existing Regular provisional integration | Existing approved/provisional scope retained; no independent permission established for Preseason/CS/Japan Series | General redistribution/expanded competition scope remains unresolved | **C** for expanded scope; no new collector or repeated six-game investigation |
| Free API / third-party datasets in prior audit | Credentials, completeness, trial/free permanence or upstream terms remain unresolved | No new credentials/contracts; prior [audit](npb-source-rights-2026-10.md) and [free API validation](npb-free-api-validation-2026-10.md) findings retained where present | No automatic expansion of rights from code-only licenses | **C/D**, not adopted this batch |

Wikipedia basis: [Wikimedia Terms §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), [API etiquette](https://www.mediawiki.org/wiki/API:Etiquette). Wikidata: [structured data access](https://www.wikidata.org/wiki/Wikidata:Data_access). No photo, logo, article prose or large raw archive is republished. Data and excerpt fixtures retain CC BY-SA; independent application code is separate. Per-revision author and license links survive comparisons and totals.

The archived NPB postseason table is present only for 東 among the examined sources. Other postseason headings are explicitly MLB, and are excluded. No 2026 competition archive is synthesized from a source captured before CS. No 2026 Preseason/CS/Japan Series Game, schedule, scoreboard, player aggregate or advancement Fact is imported. Newly imported Games: **0**. All 2026 non-Regular player-stat scopes remain **unavailable / not collected**, not zero appearances. Japan Series was future at the inspection date; this is distinct from a proven no-game day.

## Competition implementation

`npb-competition.ts` reuses the existing NPB season competition enum and shared postseason round enum. The shared legacy `CompetitionType` remains regular/postseason. An additive NPB scope requires exact league/year/competition/stage coherence; CS First, CS Final and Japan Series are separate. Validated aggregate inputs and existing arithmetic are reused, never reimplemented in UI. Scope-aware sums reject mixed competitions/stages and duplicate club-year rows; yearly component sums propagate null and recompute ratios. Historical release limits still exclude 2026.

Independent collection states distinguish complete / partial / not collected / failed / no games / not started. Complete needs an independently evidenced nonzero game universe; no-games needs explicit zero-universe evidence. Player-stat availability remains separate. None of this is evidence for Current HOT, Ranking, freshness or scheduled production.

`seriesSchema` now accepts actual canonical NPB team/game IDs, while preserving legacy UUID NPB fixtures and MLB IDs. The reviewed 2026 CS helper computes the conditional 1/2 credited wins and 6/7 played-game limit from independently supplied win/loss standings (exact half-game difference and .500 boundary). Two-win mode requires its evidence, matching teams, season, target wins and maximum games; no synthetic advantage Game. Actual final standings, series wins, draws, cancellations, reserve-day exhaustion and clinch observations remain source evidence, never generated from a rule. Existing explicit `competition_rule` decisions and scheduled/postponed/cancelled statuses are preserved. This is rule/contract readiness, **not a live 2026 CS feed or newly verified advancement engine**.

A reviewed, fixed NPB postseason header reader accepts only explicit year/team/stage links and exact numeric columns. Unsupported definitions stop admission. Four stage aggregates pass IP/ERA/W-L/arithmetic, identity validation and a separate SQLite readback/idempotency test. Missing CG/SHO/no-walk/WHIP source cells stay null. No BF/PA or decimal-IP substitution.

Postseason projection: one 2,642-byte JSON, gzip 925 bytes; SHA `aedfdd74c9f149779222a9d588862b08a482734281020b2d804430c985d5b5ef`. Separate schema, reader, scope index and release hash; it is never fed to the Regular importer, Games, Recent, HOT or Ranking.

## Player experience

Current Player's scope link and tools open `/NPB/players/:canonicalId/seasons`. Year, role, competition and stage are URL state. Only actually admitted competitions can be chosen. A year change preserves the stage only where admitted, otherwise returns to Regular. Invalid/unavailable deep links show an unsupported state, without fetching different-scope stats. Current 2026 links back to the existing Current page, without silently adding Current to historical sums.

The focused page reuses History's numbers, 4-year comparison, collected-year total and per-revision credits. Initial Regular view selects only the opened year. The lightweight explicit postseason view exposes detailed nullable inputs and an optional **same-year Regular comparison**, fetched only when expanded; periods/sample/competition stay labelled and never summed. The source's complete set of admitted numeric columns is available under expandable detailed stats. The Directory/Profile overview and Home have **0 added data fetches**. No registration, back number, current team or complete Career assertion is derived from past rows.

Search/History/Compare/Records continue to use the existing partial annual data. No Current rankings are exposed by the added entry. No new primary tab, storage format, export right or full Career feature.

## Delivery, performance and outstanding gates

Regular active projection: 12 files, **2,080,999 bytes**, largest year **354,459 bytes** (below 500KB bound). The 24 old v3/v4 files are pinned and verified byte-for-byte. Including 1 new competition file: 37 retained/active files, **5,449,198 bytes**. No raw archive in Pages or Git. Assets are pulled once from immutable releases at build time, never from Wikipedia on CI/client. Regular History initial fetch stays manifest + selected year; explicit player year entry also 2; explicit postseason entry manifest + 2,642-byte scoped file; expanding its Regular comparison adds at most 1. Annual comparisons remain max4 years, lists30/page. Canonical DB growth0, current collector load0, Home additional fetch0.

Latest reviewed Scheduled EOD [38829589128](https://github.com/tomoya41/baseball-notes/actions/runs/38829589128), main `249c30c`, failed **2026-10-16T00:27:55.253Z**: `SQL read operations are forbidden`. DB reads1 / writes0 / nf3 HTTP0. The provider message mentions blocked reads/plan, but actual quota, billing/account restriction and account dashboard are not visible here; root cause is **not established**. Owner must inspect Turso usage, plan/read limits, database/account restrictions and service notices. No upgrade, bypass, new account or repeated retry. Latest canonical SQL integrity is **NOT VERIFIED**. Pending6 / partial5 are the last verified state, not a new SQL audit. Current stale and HOT/Ranking closed remain unchanged.

Physical ADB enumeration is empty; Pixel install, physical 150/200%, gestures, TalkBack and offline device QA are **NOT RUN**. Existing physical-device instructions and Play owner gates remain. New APK/unsigned AAB and Emulator evidence are recorded in the PR/delivery receipt. No signing-key, App Links, Play registration/payment or store publication.

Rollback: revert new code/pins; keep both old releases and namespaces. Future releases must retain v3 root, v4 namespace, v5 namespace **and** this competition hash URL. No DB migration or restoration is necessary.

Checks, reviewed commit, exact Android/Pages runs and public verification are appended after execution, not assumed from prior PRs.

### Local validation before merge

Full suite at `7c8c8f9`: 115 files / 1,338 tests PASS; subsequent source/URL/cache/retired-player boundary tests are included in final CI. Lint/typecheck/Web/Vercel PASS. Final immutable-release and all 24 retained-file guards PASS. Active regular projection is 2,080,999 bytes plus the separate 2,642-byte stage projection; no annual file exceeds 354,459 bytes.

Initial JS measured 483,748 bytes (baseline 482,861, +887 / <0.2%); CSS 66,769 bytes unchanged. Manifest 69,383 bytes; latest-year History/player entry 2 requests / 423,842 uncompressed bytes. Stage entry 2 requests / 72,025 bytes, expanding Regular comparison adds 1 annual payload. Route lists/comparisons remain bounded. New data is not in initial JS.

Browser actual-screen QA (not a physical Android result): 東2025 Regular / CS Final and 2024 Japan Series / optional Regular comparison, year changes, Back, Reload, unsupported scope, source links and null values; 360/390 Light/Dark. Screenshots kept privately in `.data/npb-active-expansion/screenshots`. Desktop/tablet evidence and final Android receipt follow the completed checks. Current main overview / full other-screen visual audit is not implied by the focused-page screenshots.

Latest additional operation evidence: Scheduled Calendar [38852383968](https://github.com/tomoya41/baseball-notes/actions/runs/38852383968) failed at **2026-10-16T04:47:18.667Z** with the same SQL-read-forbidden response; reads1/writes0/nf3 HTTP0. Its recorded cron delay is a lower bound of 260.07 minutes. This confirms a second affected operation, not its account-side root cause. No collection rerun or Gate change.

Focused actual-screen tablet 768 and desktop 1280 Light verification also completed: controls, numbers and attribution visible, document width equals scroll width. Final native/share URL validation rejects malformed years/roles instead of silently dropping them to Current.
