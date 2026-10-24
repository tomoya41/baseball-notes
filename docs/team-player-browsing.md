# NPB team → year → player browsing

2026-10-24 JST. Follow-up to PR #70 after the user's request to find individual players through their club, uniform number, appearances and innings. This is a separate presentation/navigation change; no data acquisition, canonical write, release-pin change or personal-store migration.

## Shipped behavior

- The club page has a primary **選手一覧 · 背番号・年度で探す** entry before the season record. The player search's club selector is immediately visible, with a direct link to the selected club's player list. The original lightweight affiliation disclosure still works independently of season-stat loading.
- `/NPB/teams/:teamId/players` shows the year, sort, all/batting/pitching and name search. Current uses latest stored affiliation, not a live registration roster. Historical uses the actual selected year's club rows, including historical-only identities; never the current club to label old performance.
- Confirmed numbers sort numerically (including `0`/`00`), with unknowns last. A number must have the selected Current calendar year and dated observation, with neither date in the future relative to the published catalog. Previous-year numbers never masquerade as Current. If the club has no admitted numbers, the default is appearances; the unavailable number option is explicit rather than a column of decorative dashes.
- Selecting batting defaults to games descending; selecting pitching defaults to **integer outs** descending, displayed as baseball innings. Games/innings/name remain selectable. Actual zero and missing are separate. No rank positions or qualification claim: this is a roster display order, not an opened Ranking gate.
- Current season counts can include earlier clubs in the same season; the scope states this. Historical counts use only the selected club's rows. Do not infer live registrations, missing players, positions, transfer dates, full Career or complete seasonal coverage.
- Selecting a player opens the actual canonical profile, or the selected historical year/role. Router state gives the profile an on-screen return link preserving club, year, role, order and query; Android/Browser Back remains ordinary route navigation. Historical-only players are not forced into a Current profile. Favorites remain highlighted; all personal stores are unchanged.
- The list has one source disclosure, keeping rows compact while retaining every historical player's original article/revision/license and each admitted number's effective date/profile reference. No per-player fetch is added. Only a selected Historical year is loaded; Current stats are one validated static season payload, independent of Turso. Catalog and season effective dates must match; mismatches show unknown stats, not stale values borrowed from another snapshot. Stats failure retains known Current affiliation/number; Historical failure is not labelled zero players.

## Validation and limits

Ten new model/UI/share/navigation tests cover numeric number order, `0`/unknown, integer-outs order, date mismatch, club/year isolation, old-number exclusion, failed load, exact canonical links, source preservation, return state and fail-closed Competition/deep-link boundaries. Full local lint / strict TypeScript / tests / Web / Vercel builds are required before merge. A new Android test adds the real Tigers 2025 pitching list, canonical/year/role navigation, system and on-screen Back, and 150%/200% Light/Dark captures to the existing 20-test suite.

Actual browser inspection: Current Tigers at 390px Light, selected 2025 pitching at 360px Dark, source expansion and the actual 村上頌樹 profile/return state. No root horizontal overflow in these views. Further run/evidence links are recorded in the PR after execution; this paragraph is not a claim that pending native QA has passed.

PR #70's completed Android build/emulator evidence: [run 40073326720](https://github.com/tomoya41/baseball-notes/actions/runs/40073326720), **20 tests PASS** on `63920aa`. Its merge is `2f981ebe412d70e3f9adb76664b2ee42ba7989a2`. Earlier three native test assumptions were fixed, and final large-font graph/portrait/directory screenshots inspected. Further cloud review was quota-limited after the earlier `d8bc882` review; no paid workaround. This follow-up requires its own tests and review record.

Pixel/physical TalkBack remain NOT RUN while no device is attached. NPB Current gates/freshness, six pending games, five partial dates, MLB 2014–2025 and MLB 2026 rights gates are unchanged; live canonical integrity is not asserted. Extra monthly cost **¥0**.

Rollback: revert only this follow-up's UI/read-model/tests. Existing team/player/history URLs and immutable data assets remain intact.

## Review correction

Codex review identified that profile tabs and year/filter changes dropped the list return context (P2, comment 4366407517). Profile links now carry only a validated ephemeral roster context, and their query updates preserve it. This includes tabs, quick actions, year/competition/role, graph metric/year selection, career-season links and club/year detail links. Public shared URLs still omit that private navigation state. Regression uses the actual tabs and quick actions, while native QA changes the historical profile year before returning. In the actual 360px browser, Tigers 2026 pitching → Murakami → Stats → Player Information → 2024 season → original 2026 innings-sorted list was verified without overflow. No state-store migration.

## Concise default UI

At the user's request, the normal roster now shows one dated affiliation/scope line. The longer Current transfer scope, unknown-number rules, qualification limits and individual credits are retained in one **出典・収録範囲** disclosure. Progression charts retain values/year/sample/partial state, while interpolation and minimum-sample explanations move to **集計条件**. Collected Record Watch uses a short selected-years scope; its full-Career limitation remains in its disclosure. Combined-year sums similarly group their scope and source details. No data, metric help or source credit was removed.
