# NPB CS multiline-row recovery and comment boundaries

2026-10-17 JST. Baseline: PR #37 / main `0c02268d69c2abbf22eab50e26f8dffd93dd7568`, published by Pages run [38961060307](https://github.com/tomoya41/baseball-notes/actions/runs/38961060307).

## Narrow follow-up

The previous CS parser's 66 `unsupported_box_columns` exclusions were **physical cells in six multiline pitching rows**, not 66 distinct players or 66 table layouts. MediaWiki permits each cell to occupy its own `|` line. Read logical rows bounded by explicit `|-` separators and concatenate their explicitly written cells, retaining the exact reviewed header and column count. Never borrow a cell from a following row, accept an incomplete row, split combined BB/HBP or infer a blank zero.

All six rows were re-evaluated from the same previously archived revisions, with zero additional source requests. One has an exact linked article and an admitted independent canonical/QID/NPB-ID bridge: 上原健太 (野球), 2026 CS Final, Game `npb:game:8bf0e973f55bf9e42666`, one recorded pitching out (0.1 IP). Five remain unverified identities. No name-only match or bridge update.

| Item | v1 | v2 |
| --- | ---: | ---: |
| Observed-final Games | 8 | 8 |
| Players / aggregate rows | 125 / 125 | 126 / 126 |
| Batting / pitching rows | 97 / 28 | 97 / 29 |
| Source exclusion observations | 213 | 152 |
| Public current-generation body | 111,154 B | 112,056 B |
| Compressed archive | 18,368 B | 18,499 B |

Existing 125 rows and eight Game records are byte-equivalent as data values: changed 0, removed 0; added one player and one pitching row. This is partial collected-game data, not full CS totals or independent evidence for the six shortened Regular games. The 61-item exclusion reduction reflects six physical-cell errors becoming five identity exclusions, **not 61 recovered players**.

v2 gzip SHA256 `3bfaf6d22d2093a452e93a542ba3b416e9740b86b429792acb93d08fd824455a`; public body SHA256 `b5add5d74403a4ba791bd277f51ae3b4950a5445e0fb12b666cfc698deef0cdd`; same archived-source input SHA256 `362a4c88222069bd046d5782ecada65c0adffd86849b0b4be7306d40a656d573`. New immutable release `npb-cs-wikipedia-20261017-v2`; never overwrite v1.

The v1 public URL/body remains pinned and staged alongside v2 for installed APKs. Publication verification reads and hashes both generations. Current v2 needs one bounded 112,056-byte fetch, at most 30 list rows/page; retained v1 adds no client fetch. Home extra fetch = 0. Independent scratch readback/idempotent replay PASS; canonical writes = 0.

## Historical comments are not data

Regular/Postseason readers now remove whole HTML comments **before** locating annual sections, physical rows and rowspans. Original article revision/hash is retained for provenance; hidden future rows/tables never become an eligible observation. Existing numeric, identity, scope and arithmetic rules remain unchanged.

Replaying the full archive after this fix preserves the complete v6 artifact **byte-for-byte**: 598 players / 3,324 rows, gzip SHA256 still `3546cea6b2c3767c973739ab5a902c98b02a89e81d33e47444f079efabbd21b4`. No new Regular release is needed. Three diagnostics were generated from hidden 2026 templates (山本祐大, 稲川竜汰, 鈴木豪太); these disappear without accepting any statistic. Original 55 exclusions become 52, plus four earlier-year exclusions = 56 across the expanded range. This does not recover three statistical rows or resolve remaining WHIP/numeric disagreements.

## Rights and operating boundaries

Same pinned Wikipedia pages and [CC BY-SA 4.0 reuse conditions](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content), with article/revision/author/license/modification attribution. No new provider, raw article redistribution, inquiry, paid service or contract expansion. Cost remains ¥0. Canonical IDs, Current Regular Facts, identity mappings, MLB 2014–2025, Current Gates, Favorites/Collections/Watch are unchanged.

Turso SQL reads and the Current API resumed on October 17; read-only integrity/Fact audits and independent scratch restore succeeded as recorded in [PR #37 delivery evidence](npb-completion-next.md). Stale status, six pending Regular Games / five partial days, zero eligible HOT batters and absent scheduled-production evidence still keep HOT/Ranking closed.

## Validation and release record

Boundary tests cover multiline vs one-line equality, incomplete logical rows, following-row isolation, hidden tables/rows and visible rowspans. The v1 publication hash is fixed by a regression and independently checked during builds. Final CI, review, Android and public run evidence is recorded on the follow-up PR after each actual run. Physical Pixel is not connected; Pixel/TalkBack NOT RUN.
