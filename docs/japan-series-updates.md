# Japan Series update safety and portraits — 2026-10-25

## Result review

One official, bounded Wikipedia API acquisition at **2026-10-25T05:21:10.595Z** captured article **5306035 / 111505920**, timestamp **2026-10-25T00:02:38Z**, SHA256 `f9e6f90aa3a353dc52d7390fc6a310d363a229080c2dd5b684355f340b50dbb2`, and schedule **5307595 / 111501854**, SHA256 `fcf651e9fd6cf0ee98e563d9e5a256e4230ff1659331e29580ed55e0ebe7c167`. Existing CC BY-SA 4.0 admission and exact source/identity rules remain in force. The exact first-Game Linescore still matches v2; no new schedule/result was present. Independent private rebuild and predecessor comparison: **0 added finals, 0 schedule changes, 1 retained final**. Hence no new statistical release, pin change, acquisition-time-only publication, canonical write or Gate change.

Public data stays: October 24 SoftBank **3–1** DeNA; SoftBank **1** win, DeNA **0**, **1 collected Game**, next recorded schedule October 25/Game 2/Yokohama; all other results null, individual stats unavailable, Coverage partial. An announced source Game is not generated from the local date. No new result is claimed in this delivery.

## Future confirmed-result procedure

Use the existing `fetch-npb-japan-candidate.ts` private cache and explicit refresh only when a meaningful update is expected. Inspect exact article/template revisions, copyright flags, identity, schedule scores, completed Linescores and changes. Keep raw in `.data`; no automatic revision approval. Update admitted source hashes only after review. Rebuild through `build-npb-japan-series.ts` with the pinned CS snapshot, pinned `--previous`, exact reviewed blocks, acquisition-following review time, explicit confirmation and a new immutable tag, as in [the existing runbook](draft-japan-opening-2026-10.md).

The builder now also produces private **`update-report.json`**. Both snapshots pass the normal schemas, identity/old-final guard and source chronology/hash guard. It lists genuinely added finals, explicit schedule changes, before/after counts, played wins and clinch state. An identical replay or changed source/timestamp alone yields `requiresPublication=false`; retain the live release. It is a diagnostic, not a publication authorization. Corrections, deletions, changed final evidence, mismatched identities and source rollback/hash conflicts stop before release. Do not resolve these by editing the old final or immutable asset.

When evidence is sufficient: publish a new immutable asset, retain the old pin/URL, review the coordinated app pin/source change, full regression/review/merge, preserve-only Pages delivery, HTTP body/hash/identity/old-assets readback and real Home→Game/Player navigation. Recheck all visible results and standing against the same snapshot. No DB access is necessary; do not repurpose repair/static success as Scheduled, Backup or Current Production evidence.

Home's latest result, played wins and next fixture derive together from one validated snapshot. Tests simulate a second final, tie and clinch; no fixtures are public. Ties are labelled and counted separately from wins. A confirmed champion replaces the next fixture only on a validated clinch. Elapsed dates with no collected result remain directly accessible as “結果未収録”, alongside the next recorded fixture; postponements/cancellations are not treated as finals. Missing earlier finals suppress a misleading full-series standing. Existing local date ticks never create scores, starts or results. This is reviewed publication, not live automatic score collection.

## Probable starters

Checked October 25: [NPB official Home](https://npb.jp/) and [probable starters](https://npb.jp/announcement/starter/) provide an official destination. The latter timed out in the research tool; this is not evidence that announcements do not exist. [NPB+ terms](https://www.japan-baseball.jp/npb-plus/terms/) expressly limit reuse of its app data without permission; those app terms are not silently applied to non-members using a different website. NPB.jp's factual announcement and automated extraction/republication permissions must be distinguished. No sufficient published basis for this intended recurring app dataset was verified: **C, hold**, not a declaration that names or objective facts are copyrighted. The admitted Wikipedia snapshot contains no independently stated next-Game probable-starter pair/date; a completed Game's pitchers, lineup placeholders or forecast do not supply it. Existing nf3 Current permission/scope is not automatically extended to Japan Series probable starters. No paid/private APIs, scraping, contacts or newly asserted rights.

Keep the direct official link and **未収録**, not “未発表”. New in-app probable-starter data requires its own admitted provider, exact Game/date, independent canonical identity, observation/correction semantics and rights evidence; never disguise official data as Wikipedia. Regular/CS/Japan Series remain separate.

## Photos / limits / validation

Two dated informational portraits added: **東克樹 2018 / 周東佑京 2021**, with author, original revision, license, modifications, source hash and independent QID/NPB/canonical bridges in [the asset register](visual-assets-rights.md). They are reused by the existing exact-ID Player/Historical surfaces, without extra public requests, new roster/number claims or invented Game statistics. Official logos and app-owned identification rails stay unchanged. New optimized local assets total **36,574 B**; Home's existing three-player selection and its static request count stay unchanged. Existing personal stores, PR #73 fallback and Current/MLB/projection assets are untouched.

Physical Pixel inventory is empty; physical operation, TalkBack and signature continuity remain separate **NOT RUN / unresolved**. No app uninstall/data clear/signing changes. Turso was not probed or bypassed; latest canonical integrity is not asserted. Additional monthly cost **¥0**. Validation and public delivery receipts are recorded in the PR; raw/private QA stays ignored. Rollback is a normal source/UI/portrait commit revert; all statistical pins/assets remain unchanged.

## 2026-11-24 JST — 日本シリーズ全4試合の確認済み個人成績

[日本語版Wikipediaの固定版111797100](https://ja.wikipedia.org/w/index.php?curid=5306035&oldid=111797100)（2026-11-16 22:29:24 UTC）の両球団の打撃・投球表を、[第1戦](https://npb.jp/bis/scores/nipponseries/boxscore2026_1.html)・[第2戦](https://npb.jp/bis/scores/nipponseries/boxscore2026_2.html)・[第3戦](https://npb.jp/bis/scores/nipponseries/boxscore2026_3.html)・[第4戦](https://npb.jp/bis/scores/nipponseries/boxscore2026_4.html)のNPB公式記録と照合した。固定版本文SHA-256は `e5526c7d0558e8ec5696223455f94452fde5a5ebed3c14fdf705092cfac5937d`。出場順と球団を保ち、公式の略称を固定版の選手名・掲載順と照合した。収録するデータは固定版から抜粋・表記整理し、CC BY-SA 4.0で配信する。公式ページは照合と閲覧案内に使用する。

打撃117行（打数、安打、本塁打、打点）、投球44行（投球アウト、奪三振、自責点、記録された勝敗・セーブ・ホールド）を追加。第2戦・山本祐大の打数と第3戦・ショーン・レイノルズの奪三振は出典間で不一致のため `null` とした。第3戦・同投手の被安打にも差があり、被安打は表示項目に含めない。7本塁打と、延長・サヨナラ・裏を行わなかった回を含む8球団分の投球アウトを照合。0は確認した0のみ。出場が確認できる走者・守備交代も打撃表の記載順を維持した。

個人成績の表示範囲は一致した日本シリーズの試合詳細のみ。確定試合ID・年度・球団順・既存の結果証拠hashを照合する。既存のイニング別得点、日程、試合・選手IDとimmutable JSONはそのまま保持。選手名は試合内の表示用で、本人照合を経たcanonical連携や公式戦・CS・大会通算の再集計は別工程。
