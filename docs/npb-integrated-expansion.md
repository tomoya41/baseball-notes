# NPB integrated data and discovery expansion

Baseline: main `0abcaf6` / PR #43, 2026-10-18 JST. Delivery PR #44. This document records admitted scope separately from deployment and physical-device evidence. Final delivery receipts are appended after validation.

## Scope and user priorities

The user prioritizes record/age analysis, a season-aware Home, and postseason game details. These increments use existing licensed observations. Complete career totals, age-on-birthday cumulative statistics, farm/Rookie eligibility, pitch tracking, defense/catcher metrics, transactions and background notifications remain separate requirements. A related screen does not complete them.

No canonical writes, new paid services, media assets, source contacts, Current Gate changes or bulk OB identity additions. The 21 previously admitted Historical-only identities remain 21. MLB Historical 2014–2025 is protected.

## Licensed source acquisition and immutable releases

[Wikimedia terms §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content), [official API etiquette](https://www.mediawiki.org/wiki/API:Etiquette), and [Wikidata CC0](https://www.wikidata.org/wiki/Wikidata:Licensing) were rechecked on 2026-10-18. Retain article/revision/authors, license and normalization notices. No photos, logos, third-party scraped datasets or inquiries were introduced. The source archive and raw nf3 pages remain private; public payloads are bounded normalized statistics and provenance.

| Release | Previous | Admitted candidate |
|---|---|---|
| NPB Historical Regular | v7, 2002–2025, 600 players / 3,334 rows | v8, 2000–2025, **same 600 players / 3,524 rows**, 1,927 batting / 1,597 pitching |
| 2026 CS | v3, 11 observed-final games / 145 stage rows | v4, **12 games / 179 stage rows**, 120 batting / 59 pitching, 153 identified players, **185 per-game observations** |
| Coverage | partial | **partial**, unchanged meaning |

Regular v8 gzip SHA256: `5cda8fb982f6e972ebadb887fb90ed66c9d79ae95be367ebe0fc32533d614181`; archive input: `d4946a34dd2c2c72bc10ee0a2bf0b2336690a705f51d38198d00bb35f9f9b092`.

CS v4 gzip SHA256: `df6eb6065789393ee07350cfe14ab488c29b0f56cc71abfa28cfdda3c65c6c31`; public body SHA256: `394e11d43baaf383c10f38e7a5de966bc021360af269682a1c4a20d5ed28aacd`; input: `d86904400262ce9c751c55462361d5dd72ce21863db014bebbe6129f29c9a666`.

Prior v7/v3 families are retained byte-for-byte for installed APKs and rollback. A new family is never a correction of the old release.

## CS identity and game evidence

One bounded official MediaWiki API request refreshed the two already adopted CS articles. Snapshot acquisition: `2026-10-18T05:41:42.885Z`. Pinned sources:

- [Pacific CS, page 5301694 / revision 111417089](https://ja.wikipedia.org/w/index.php?curid=5301694&oldid=111417089).
- [Central CS, page 5302364 / revision 111424439](https://ja.wikipedia.org/w/index.php?curid=5302364&oldid=111424439).

An unlinked box-score cell is admitted only when the **same game, same club, same batting/pitching role** contains an unambiguous source-authored article reference whose article has an independently verified canonical bridge. Batting references are the club's home-run summary; pitching references are its battery summary before the explicit ` - ` catcher separator. Catchers, other games/clubs/roles, unknown competing article targets, surname matching and global aliases cannot resolve a player. The default parser mode remains strict; summary references require explicit opt-in.

Independent archive replay preserves all **11 prior game objects and 145 prior game observations**. Forty observations are added; 34 new stage rows and six extended stage totals result. Changed stage totals require per-game evidence and independent component summation; default add-only admission still rejects unexplained changes. Published observations must match replayed source values, not merely the same stage total.

New observed-final game: `npb:game:c0e3700f483b5a5239d5`, October 17, Tigers 5–8 Baystars, CS Final. Scores do not prove full player coverage. There are 257 excluded unresolved article rows in the refreshed snapshot; they are not missing-zero appearances.

### Postseason game details

CS score rows and a player's collected-game list link to `/NPB/games/:gameId?competition=postseason&stage=…`. The score hero, heading, responsive stat table, metric explanations and club box-score structure reuse the Regular presentation system. The reader and data contract remain distinct.

Each detail filters **actual game observations** by exact canonical game, club and role. It never divides a stage total into game facts. Unknown PA/BB/HBP/OPS, empty cells, participant order and missing players remain explicit unknowns. No live pitch feed, inning reconstruction, substitutions or complete recap is invented. Source revision/CC BY-SA attribution remains reachable. Direct/reloaded known CS IDs use the CS reader; an explicitly postseason request never falls back to Regular. Share/native links and direct-link Android Back retain competition/stage.

Japan Series is still not admitted as a 2026 game dataset. The page does not manufacture Japan Series details from older stage-only aggregates. This is a remaining source/admission gap, not complete postseason parity.

## Two canonical identity bridges, no live DB repair

Turso's SQL-read denial is not bypassed. [Manual scratch inspection run 39102325654](https://github.com/tomoya41/baseball-notes/actions/runs/39102325654) used the **fixed, previously verified retained encrypted backup run 38963670207**, ciphertext SHA256 `6aff8770a2f90923a75a21ed24b6d84a007cafb30bbda05b1756ffd0996ddd2e`.

The existing independent 17-table scratch restore runs before a read-only query restricted to two fixed canonical IDs. Only a sanitized two-identity JSON report is uploaded, with `include-hidden-files: true` and an exact file path. Plaintext archives, DBs, full mappings and secrets are not uploaded. The inspection makes zero remote SQL calls, zero source requests and zero canonical writes.

Snapshot: `2026-10-16T20:38:41.102Z`, scratch SHA256 `9f4bf8315faba57ec244ad544354fbd50c58b3bd0eb0bfb08ec2afd4ae20cfb9`.

| Existing canonical ID | Backup source mapping | Independent external IDs / DOB |
|---|---|---|
| `bab3e29d-faa7-44e3-abe1-ee7023163a63` | `2026:DB:uniform:69` | NPB `33035152`, Wikidata `Q90743792`, 1997-10-22 |
| `e88b4e3d-1c6c-4b81-9c7c-9af1e8e133f3` | `2026:DB:uniform:62` | NPB `93995152`, Wikidata `Q127516948`, 1998-04-19 |

Existing private nf3 archived pages explicitly identify the year/club/uniform and link to the respective exact NPB ID. Uncompressed page SHA256 values: `28de07163e294503e1de72dce83dd41b4f6d08c7ae50ca77f64f8ccd32f4c418` and `9ef8c79354c552faf60d177b2972b7dc6cabfeb5eb65c6fe0eac2c1c5a5024a6`. These are content hashes, not an interpretation of cache filenames as content hashes. Wikipedia and Wikidata independent ID/day-precision DOB verification was replayed from existing cached official API responses. A matching name alone is insufficient.

Source mapping numbers are **not current jersey/roster certification**. Neither identity is reissued in the Historical-only namespace. Their NPB careers begin in 2026 in the source archive, so these bridges improve CS/profile coverage but do **not** add fictional 2015–2025 NPB rows. The saved Directory remains 740, Historical matches 579 / missing 161; bridge gaps decrease 71→69. Other uncertain identities, including a DOB mismatch, remain excluded.

## Regular/archive results and profile enrichment

Forty-nine Current article candidates were rechecked in three cached/bounded batches, eight official API requests. Forty-eight passed independent identity checks; 栗原陵矢 failed the exact DOB check. No additional Current Historical rows passed the existing arithmetic guards. A refreshed 平良海馬 article would remove an existing row; it was rejected. WHIP/OPS discrepancies were not waived.

The additional 190 rows are **earlier years of the already admitted 21 Historical-only identities**, not new OB identities. Older-year admission requires explicit `--include-registered-history` plus membership in the verified registry. The previous 3,334 rows/metrics/identities remain unchanged. Exact DOBs for these 21 identities allow same-grade and same-age discovery without creating Current Catalog membership.

| Year | Batting added | Pitching added |
|---|---:|---:|
| 2000 | 3 | 4 |
| 2001 | 4 | 3 |
| 2002 | 5 | 4 |
| 2003 | 4 | 4 |
| 2004 | 6 | 5 |
| 2005 | 7 | 6 |
| 2006 | 8 | 6 |
| 2007 | 9 | 4 |
| 2008 | 9 | 5 |
| 2009 | 10 | 5 |
| 2010 | 10 | 3 |
| 2011 | 11 | 4 |
| 2012 | 12 | 5 |
| 2013 | 12 | 5 |
| 2014 | 12 | 5 |
| 2015–2025, including 2023/2024/2025 individually | 0 | 0 |

Regular exclusions: 59, versus prior 56; two newly inspected older-year discrepancies and one foreign-table exclusion add diagnostics, not accepted rows. Five unsupported definitions are foreign/unsupported tables, not reason to interpret MLB/CPBL rows as NPB. NPB-marked club rows with a contradictory MLB year template remain unadmitted pending a justified correction.

Four saved players receive 21 missing profile fields from pinned licensed infoboxes: Osuna (weight/hands/known positions), Ariel Martínez (hands/origin/amateur history/known positions/generic professional debut), Encarnación (DOB/hands/position), Reynolds (DOB/hands/origin/position). Source revision/authors/modification notices remain. Codex-assisted verification is not human review. Generic debut is not NPB debut; current jersey, roster, affiliation and registration are not inferred.

Scratch coordinated profile projection changed only these four Directory/Catalog players and 11 profile capability counts; Milestones values stayed identical. Source date remains separate from the saved effective date `2026-10-12`. Metadata projection generation may advance without advancing Facts/freshness. Known competing profile claims remain conflicts, not majority-vote merges.

## Record/age analysis and seasonal Home

- **Record Watch, collected scope**: Profile's selected Historical years and age-collected comparison show hits/HR/SB or wins/SO/IP checkpoints. Exact years, sample and nulls are retained. A missing component prevents that sum. No career certification, threshold date, future prediction or push notification is claimed.
- **Age-collected comparison**: add `ageMode=collected` to the existing same-age URL. For up to four canonical players, sum admitted Regular rows through the season in which the player reaches the selected **December 31 age**. Not birthday-time cumulative statistics. Missing years/club rows/roles remain unknown. Ratios use components; outs remain integers.
- Cumulative reads require an explicit load action, display expected years/bytes, share annual requests, and run with **two workers**, max **36 years / 8 MB**. An annual fetch failure suppresses the affected player's sum; it cannot silently publish the successful subset. Year-only mode retains the earlier at-most-four-year behavior. No initial Profile/Home history fetch is added.
- **Same grade** remains April 2–next April 1, not actual enrollment or birth-year equality. Historical-only DOBs support same-grade discovery without adding OB players to Current.
- **Seasonal Home**: a no-fetch editorial section uses the JST calendar: February–March spring, April–September regular, October CS/Draft, November–January player-history/offseason context. The explicit selector is URL-persisted. Actual saved dates stay visible in destination screens. Old 2026 CS/2025 Regular links remain explicitly dated in 2027. This is not an official competition calendar, live news or proof of a completed season.
- Spring links young-player discovery and admitted past statistics; autumn links actual collected CS and draft peers; winter highlights recorded history/comparison/My. FA/transactions/preseason and current draft predictions are explicitly uncollected. No Current HOT/Ranking bypass.

The user's proposed sourced news/event feed is tracked separately in [news readiness](npb-sourced-news-readiness.md). It does not authorize unknown-rights article republication or automatic canonical membership edits.

## Operations, performance and remaining gates

Last inspected scheduled calendar run [39098607230](https://github.com/tomoya41/baseball-notes/actions/runs/39098607230), October 18 13:52 JST, failed on `SQL read operations are forbidden` (one read, zero writes/source HTTP). No verified account-side cause or stable live recovery. A retained scratch snapshot is not a fresh canonical audit or Scheduled production evidence. Six shortened Regular games / five partial dates / stale freshness / closed HOT and Ranking remain independent.

Regular active family: 27 files / 2,392,849 bytes, largest 355,825 bytes; gzip asset 223,762 bytes. CS current normalized payload: 249,383 bytes, gzip 28,282 bytes. Per-game observations duplicate only small normalized player aggregates, not raw event data. Default historical entry fetch remains manifest + selected year; CS detail uses one bounded admitted CS response. Home extra fetch **0**. Retained historical assets are intentionally kept for older APKs, not loaded at startup.

Physical ADB check in this batch found no device. Pixel update, original debug signer continuity, TalkBack/gesture/actual physical offline QA remain NOT RUN. No uninstall/data reset/signing key/Play action. Full-career record-watch data, birthday-time cumulative comparison, fielding/catcher/pitch analysis and actual seasonal event coverage remain unfinished.

## Delivery evidence

Implementation checks and final review/build/deploy receipts are recorded here when actually completed. Local first full check: 137 files / 1,516 tests PASS, one Windows-only skip; lint/typecheck/Web build PASS. Subsequent test additions and final native/public results require a final rerun. No CI or physical-device result is inferred from this local check.
