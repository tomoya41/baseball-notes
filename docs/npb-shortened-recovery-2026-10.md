# Shortened NPB Games: evidence and controlled recovery readiness

Baseline: PR #30, main `88c87d1`, October 14, 2026 JST. This delivery does not add a Source or relax any Gate. All six final headers are saved; their atomic participant writes were previously rejected, so saved batting/pitching Facts are zero. Candidate counts or pitcher-IP sums are not saved Facts or independent ending evidence.

## Reviewed scope and evidence matrix

| Date / canonical Game suffix | Source record ID | Home–away score | Prior candidate B/P | Primary diagnostic reference |
|---|---|---|---|---|
| Apr9 / `2469292e18a73924f23c` | `2026-04-09:T:S:1` | Hanshin–Yakult 2–0 | 24 /5 | [official](https://npb.jp/scores/2026/0409/t-s-03/box.html) |
| Apr14 / `99b0c4913966af7674ad` | `2026-04-14:S:DB:1` | Yakult–DeNA 5–3 | 23 /4 | [official](https://npb.jp/scores/2026/0414/s-db-04/box.html) |
| May3 / `e9a705d2e3ddfe1dabe8` | `2026-05-03:T:G:1` | Hanshin–Giants 3–0 | 20 /3 | [official](https://npb.jp/scores/2026/0503/t-g-08/box.html) |
| Jun20 / `b2f541664347c98a1f62` | `2026-06-20:S:C:1` | Yakult–Hiroshima 6–8 | 30 /7 | [official](https://npb.jp/scores/2026/0620/s-c-10/box.html) |
| Sep9 / `51c3f0f8dba6a7bb710e` | `2026-09-09:M:E:1` | Lotte–Rakuten 10–4 | 23 /9 | [official](https://npb.jp/scores/2026/0909/m-e-19/box.html) |
| Sep9 / `645ed547effceffc5ca9` | `2026-09-09:DB:S:1` | DeNA–Yakult 9–2 | 24 /5 | [official](https://npb.jp/scores/2026/0909/db-s-21/box.html) |

The suffixes above all have prefix `npb:game:`. Prior candidates are September diagnostics, not fresh verified values; fresh read-only execution is recorded separately below and in the PR delivery report. Every official page explicitly identifies a rain-shortened final and matches saved date/teams/score. Those links are **research/diagnosis**, not an adopted stats provider. No official player-stat table, HTML or ending record is ingested or placed in public payloads.

## nf3 investigation and rights boundary

Inspect the existing twelve paired year-wide published schedules, starting-lineup and player-use pages, pitching/batting rosters, all-season player logs, retained private responses and existing `permanent_events`. Published links are resolved against the site's HTML base URL; a web reader misresolving a relative link into a duplicated `php/stat_disp` path is not evidence that the real published endpoint is missing. Do not probe undocumented/private routes.

The schedule's `回` belongs to **starting-pitcher innings**, not final Game inning. Player pitching IP is a Fact; summing it does not independently establish a called ending. PA detail cannot prove that an unseen later inning was canceled or that records reverted to an earlier completed inning. Aggregate team inning tables also cannot establish one Game's terminal state. The rolling two-week pitching-use page is a participant-discovery surface, not a historical ending record.

nf3 remains **enabled-limited-public /provisional**, with the existing bounded acquisition, attribution and disable policy. The [operator's disclaimer](https://nf3.sakura.ne.jp/) is not a new affirmative storage/redistribution licence. Source access does not upgrade rights. The NPB official footer restricts secondary use; no independent permission for automated permanent storage, production evidence, public projections or player-data redistribution was established. Official observations cannot be relabeled `provider=nf3` or be accepted merely by manually transcribing them.

If explicit nf3 ending metadata is not found, recovery remains blocked. A future alternative-evidence design must keep a **diagnostic observation** separate from an **admitted production evidence record**. It needs source-specific identity, URL/date/revision, actually recorded final inning, stopped inning/half (if separately known), explicit team outs, verification method and permitted acquisition/storage/public-use decision. Unknown fields remain null. A provider-discriminated adapter can be proposed only after permission is resolved; no union/provider option, evidence writer or official collector is added here. Rights-clear independent evidence plus fresh existing nf3 participants must agree before a separate guarded repair can run.

## Validator safety and meaning

The existing evidence schema/provider boundary is unchanged. `observedFinalInning` describes the **last inning represented in the counted official record**, not a later interruption inning. For example, if play begins in a sixth inning but the final counted record ends with five full innings, `6 /15 /15` is inconsistent; do not automatically decrement it or infer reversion from pitcher sums. Source must explicitly establish the counted ending. Likewise, fractional `.1`/`.2` are one/two outs, never decimal fractions.

Fixed an actual validation gap: merely matching both supplied totals and the maximum inning bound could accept physically inconsistent pairs (e.g. seventh-inning 21/1 or 20/19 outs). For an admitted ending, visiting defenders retain only prior-inning outs during a partial top half; once the top half is finished, their bottom-half outs range from zero to three. Exact Game/team/score binding, independently supplied outs, every participant/PA/BF/hit/run/completeness check and null handling still apply. No exception IDs or observed official values are embedded in validator logic. Normal/extra-inning finals retain the previous path.

Synthetic tests deliberately use unrelated Game IDs/URLs; they are not disguised observations of the six production Games. They exercise whole and fractional endings, stopped-versus-counted inning, impossible pairs, wrong teams/score/provider, missing PA/outs/Facts and unchanged normal-final behavior.

## Read-only operational preflight

`npb-freshness.yml` gains an opt-in `shortened_readiness=false` input. **Scheduled behavior does not acquire nf3 pages.** Only explicit manual opt-in uses the shared collector/publication concurrency group and a longer bounded timeout. Existing freshness failure is not waived; the independent readiness step still runs and reports its own result.

`audit-npb-shortened-readiness.ts` permits only individual SELECT statements on the remote facade, blocking mutation/transactions/batch/migrations. It hashes all 17 protected tables, exports privately with the existing portable Backup code, independently restores a new empty scratch DB and verifies repository readback/hash equality. Both Source schedule copies must match all reviewed/saved identity and metadata fields. Exactly the six reviewed Games run through the existing historical-pitcher discovery and **dry-run** Game proof, without injecting any ending evidence. All mapped participant IDs and checks are retained as bounded diagnostics, with candidate outs explicitly labeled Fact sums.

HTTP uses the existing polite transport/cache/retry policy and a hard 500-attempt budget, reserving retries and permitting cached reads after exhaustion. No raw responses or private export/scratch DB are uploaded. Only the bounded `report.json` artifact is retained seven days. Remote and scratch hashes must remain unchanged; no repair/Day/identity/evidence/projection write occurs. This scratch restoration is a baseline-verification drill, not a claim that shortened Games were recovered or a newly durable encrypted backup exists.

If a Game eventually has admitted independent evidence and full validation, `ready_for_controlled_recovery` is an **assessment only**. Actual repair must separately use PR #30's backup-before-write, exact scoped current metadata, scratch ingestion, readback/value hashes, replay, encrypted post-backup/independent restore, coverage and coordinated publication safeguards. This diagnostic never auto-writes or auto-publishes.

## Android and owner gates

Use [physical checklist](android-device-qa.md) and [short result form](android-physical-qa-results.md). The debug APK in a successful Android Run is installable; unsigned AAB is not. A build or emulator test cannot certify a physical device, OEM gesture or TalkBack. No connected physical device/ADB was available at initial inspection. Continue emulator testing independently of Source/evidence blockers.

Release signing/custody, verified App Links and root `assetlinks.json`, Privacy/Data safety final review, Console/store listing/testers/submission remain owner gates. No key generation/change, fee/payment, host association or Play publication is authorized here. Monthly additional cost stays ¥0. See [Play preparation](play-release-readiness.md).

## Execution evidence

Initial read-only integrity [38543203196](https://github.com/tomoya41/baseball-notes/actions/runs/38543203196): 899 Games, six pending, five partial dates, zero evidence/input findings, protected hashes unchanged. The full workflow fails honestly on stale Oct12 data; it is not new Scheduled collection proof. Actual scheduled freshness [38537439377](https://github.com/tomoya41/baseball-notes/actions/runs/38537439377) likewise remains stale/outside reviewed acquisition calendar, six pending, retention unverified. Repair, snapshot retention and fresh production collection are separate claims.

The final fresh nf3 candidate validation, independent restore, Android builds/emulator, review, merge/public smoke evidence will be recorded after execution, rather than inferred from the existence of this document.
