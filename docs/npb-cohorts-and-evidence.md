# NPB collected seasons, CS and peer analysis

Started 2026-10-17 JST, release verification 2026-10-18 JST. Baseline main `33c816d` / PR #40. This is an incremental data/product delivery, not another design reconstruction. Source acquisition dates below are snapshot dates, not a claim of live coverage.

## Real data and identity

Reuse the existing reviewed nf3 → NPB-ID → QID bridges for **Roberto Osuna (Hawks)** and **Ariel Martínez (Fighters)**, then independently verify Wikipedia's page/QID/NPB-ID and day-precision DOB against Wikidata. Keep their existing canonical UUIDs; never substitute the Historical-only namespace. The other Osuna (Swallows) and Martínez (Giants) remain distinct. No master/history/Fact/mapping write or current registration/number assertion.

The previous archive admission only consulted the free-profile bridge list, omitting two already reviewed abbreviation identities. Build/import admission now unions both lists with collision rejection. Hidden infobox documentation is removed before reading IDs/DOB; visible contradictions and unverified IDs still fail. Exact regression fixtures cover hidden examples, missing real dates, same-name collisions and forbidden rekeying. A seven-article bounded collection used **2 official Wikimedia API requests**, and one CS refresh used **1**. Cache replay makes no further source requests. Five independently evidenced Wikipedia identities lack a proven link to the existing Current canonical identity and are **not admitted**, including foreign players present under abbreviations. No new OB identities.

Regular **v7** adds **10 rows (6 batting / 4 pitching)** for these two players, 2020–2025. Years 2020/2021 add one batting row each; 2022/2023/2024/2025 add one batting and one pitching row each. Total **600 players / 3,334 club-year-role rows**, 1,805 batting / 1,529 pitching, **2002–2025**, all partial. Earlier years were not newly found. Old **3,324** metric rows and their canonical identities: changed 0, removed 0. Historical-only registry remains 21 / 119 rows. Quarantine remains 56; no tolerance relaxation.

Saved Directory remains 740, not a verified active-registration population. Historical matches **577→579**; no admitted past rows **163→161**; Historical bridge gaps **73→71**; one-year-only 90, multiple-year 489. Current metadata/profile projections are not silently rewritten. `scripts/audit-npb-active-coverage.ts` now uses the same accepted bridge union as import admission, rather than reporting these two accepted links as missing.

Regular release `npb-history-wikipedia-20261017-v7`: gzip SHA256 `fe66dd98b2bdb47107df42f84cec805b0ca86005b447a3c1a06f8a29f8c88e1e`, input SHA256 `679cebaef5135cbd4d78316100641258f6eec0ced12c6df5d6c9188de970b545`. Compressed 214,726 B; 25 active public files / 2,251,521 B / max 355,825 B. Retain every v3 root/v4/v5/v6 URL (61 files); never overwrite v6. Rollback reverts the release pins; no database restore/migration.

## CS snapshot

Official API snapshot **2026-10-17T05:17:43.394Z**: Pacific page 5301694 revision **111412778**, Central page 5302364 revision **111412750**. Explicit final-time/innings/score proof admits three additional games: 10/16 Hawks 6–2 Fighters, 10/15 Tigers 0–1 Baystars, 10/16 Tigers 0–4 Baystars. The old eight Game values are unchanged.

CS **v3**: **11 observed-final Games / 145 participant aggregate rows**, 112 batting / 33 pitching; **+19** rows. Old 126 aggregates/sample Game-ID arrays unchanged. The snapshot is partial; it is not full CS totals, a complete box score or an advancement/official-ranking engine. Unlinked/abbreviated names remain excluded rather than assigned by name. Source issue observations rise 152→248 as more game tables are present; these are not distinct players. Combined BB/HBP stays inseparable, unknown PA/OPS/WHIP stays null. No new completion proof for the six shortened Regular games.

Release `npb-cs-wikipedia-20261017-v3`: gzip SHA256 `8cdd5f9fc9993311b81c3163fce96be004b782b0629aa43d06bff3723ae325f6`, public body SHA256 `af9a051d4c26eafa9de81c045af5e60f1579e50ad536058b80bccaa3f7e70cbd`, input SHA256 `7d967af005c05126b3d4865627aa301345fca3c7a93872eae77bf21fe3b3722a`. Body 129,207 B, gzip 21,090 B. Both v1/v2 URLs retained for old APKs. New independent `verify-npb-cs-expansion.ts` rejects changed/removed Game, metric/sample or canonical identity; scratch SQLite readback and idempotent replay pass. Canonical writes 0.

## Peer and club-year analysis

Existing `/NPB/history` gains `cohort=birthYear|draftYear&peer=<canonical UUID>`, one selected Historical Regular season/role and 2–4 selected `recentPlayers`. Enter from the annual History or player progression. **同じ生年** is objective birth-year grouping, not rookie qualification or an assertion that ages are identical throughout a season. **同じ指名年** uses the explicit stored field, not inferred joined/debut year. Unknown reference fields show an unavailable explanation; no unfiltered replacement results.

Reuse validated annual readers, selected-aggregate component formulas and ComparisonBars. Keep club-year rows, null propagation, PA/IP samples, per-player article/revision/license and profile source links. No rate averaging, official qualification/ranking, Current registration or Full Career claim. At most 30 rows/page and 4 selected players. URL conditions survive Back/reload/share/native deep links and condition serialization. Other league/competition scopes cannot enter this view.

Player progression also describes **adjacent collected years with one different club each**, showing the selected metric, sample and signed difference. Missing years and same-year multiple clubs are not assigned an inferred before/after order. This is recorded club-year comparison, not proof of a transfer date or its causal effect. Existing per-club rows remain available.

Home additional requests **0**. Plain History remains manifest + one annual payload; peer mode adds one existing Catalog read only after explicit navigation (3 cold requests total). No per-player profile/PA fetch and no all-years initial load. Reference changes/filtering reuse the loaded season/Catalog. CSS/design, persistence schema and five primary navigation items stay unchanged.

## Rights, other competitions and operations

Checked 2026-10-17: Wikipedia **B / conditional reuse**, preserving [Terms §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) article/revision/author links, extraction/normalization notice and share-alike for the processed data. Wikidata identity facts follow [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing). [Official API etiquette](https://www.mediawiki.org/wiki/API:Etiquette): identified user agent, maxlag, cache, bounded serial calls; no retries to bypass limits. App source-code license is separate. No nf3/source-contract expansion, raw article/identity dump, photos/logos, inquiries or fee.

Preseason player-stat source admission remains unresolved in the existing audit; no newly licensed dataset added. Japan Series results are not generated ahead of actual play. Six shortened Regular games remain an independent evidence/rights hold; no refetch or dry-run repeated.

Turso scheduled watcher [38990309636](https://github.com/tomoya41/baseball-notes/actions/runs/38990309636) made one successful SQL read on October 17 and normally skipped outside the reviewed calendar, writes/source requests 0. The independent integrity step in [39006017960](https://github.com/tomoya41/baseball-notes/actions/runs/39006017960) passed: 899 saved Games, 6 pending, 5 partial dates, errors/findings 0, eight protected table counts/hashes unchanged, writes/source requests 0. **The overall workflow failed its stale/retention health check**; do not report that workflow as PASS or mark stale healthy. On **October 18 06:28 JST**, scheduled watcher [39071034967](https://github.com/tomoya41/baseball-notes/actions/runs/39071034967) again failed `SQL read operations are forbidden`, reads 1, writes/source requests 0. Recovery is intermittent; account-side cause remains unknown. Latest canonical integrity cannot be declared newly verified after this failure. No quota bypass, plan/account/key change or repeated SQL retries.

HOT/Ranking remain closed: partial whole-Regular, stale payload, insufficient batting sample and missing actual scheduled collection/backup/publication evidence. CS/Historical/manual restore do not satisfy those gates. The previous independently verified encrypted backup remains a 7-day manual artifact, not newly scheduled Fact backup proof.

2027 readiness: season-specific reviewed calendar/end evidence, existing source capability/rights/future availability, identities and actual scheduled acquisition → encrypted backup → publication proof are still required. Do not clone the 2026 calendar or synthesize 2027 Facts. Existing lifecycle skips and all gates remain.

## Android and verification

Add a native peer-comparison scenario: choose a real admitted reference from the UI, compare two canonical players, retain URL selections through 200% font Activity recreation and check overflow. Existing seven native flows remain. Actual CI/build/emulator/visual/public results are recorded on the delivery PR after execution.

Physical Pixel disconnected; Pixel/TalkBack **NOT RUN**. No keystore found in the conventional previously checked locations or scoped workspace/data `.jks`/`.keystore` inventory. This is not proof that the owner has no original key elsewhere. CI uses a fresh default debug signer per runner, explaining why independently built CI APKs need not match the initial APK; do not assume they can update the Pixel. APKs expose the public certificate, not a recoverable signing private key. Preserve the installed app/data; original signing-key continuity is required before update. No uninstall, data clear, new signing key, new secret, App Links or Play payment/publication.

Before the later Astra reconstruction, prioritize independent Current ID evidence for the remaining 71, admissible annual rows for the remaining 161, dated field-specific profile evidence and source-ready competition additions. Do not consume another batch merely repeating blocked shortened-game probes. Product/data integrity work continues independently of Turso and physical-device gates.
