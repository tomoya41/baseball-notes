# NPB free, reusable profile completion — 2026-10-02

This batch complements the 735 existing canonical Players through **public read models**, without writing Player Master, Facts, mappings, Coverage, Operations or any Production Gate. No paid API/account, daily Wikimedia job, new NPB result collector, image download or Current MLB request is added.

## Source evidence

Accessed 2026-10-02 JST. `source_available` and `rights_available` are independent decisions; a public page, GitHub license on code, successful HTTP or permissive robots file is not a data redistribution grant.

### Adopted: Wikidata structured entities (CC0)

Primary [licensing policy](https://www.wikidata.org/wiki/Wikidata:Licensing), [data access](https://www.wikidata.org/wiki/Help:Data_access), [API policy](https://www.mediawiki.org/wiki/Wikimedia_APIs/Access_policy), [rate limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits).

Policy excerpt: “All structured data (i.e. the main, Property, Lexeme, and EntitySchema namespaces) is released into the public domain”. Its stated license is [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Storage, transformation, public redistribution and commercial reuse of these structured values are permitted. Other namespaces and photographs have different licenses and are excluded. Attribution is offered in Data Sources, though CC0 does not require it.

Identity follows an existing archived canonical/team/player identity → exact NPB external ID → unique [P4260](https://www.wikidata.org/wiki/Property:P4260) claim. Names alone never link entities. 116 unique bridges, archive dates and SHA-256 are in `src/data/npb-free-profile-identities.json`. 34 ambiguous/historical-team archive candidates were excluded. Existing canonical IDs and provider mapping tables are untouched.

API requests are sequential, identifiable, batched (40 entities), separated by at least 1.2 seconds and bounded; no per-Game HTTP. One WDQS exact-ID query, ten entity/label batches and one draft-event batch were needed. No profile page from NPB/club/nf3 was fetched to populate fields. Stored nf3 identity links were read locally only.

P19 is birthplace, P69 is school attendance, P54 is affiliation history, P647 is drafted-by. P54 with an absent end date does **not** prove current roster membership. Year/month precision is retained. [P423](https://www.wikidata.org/wiki/Property:P423) concerns shooting handedness; P741 concerns generic playing hand. Neither becomes baseball bats/throws.

### Adopted: Japanese Wikipedia infobox facts (CC BY-SA 4.0)

Primary [Terms of Use section 7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content), [Japanese copyright policy](https://ja.wikipedia.org/wiki/Wikipedia:著作権), [official API access](https://developer.wikimedia.org/ja/use-content/content/), [CC BY-SA 4.0 deed](https://creativecommons.org/licenses/by-sa/4.0/).

Terms excerpt: “license the modified or added content under CC BY-SA 4.0 or later”. Section 7 explicitly permits commercial use under the license, article-link attribution, and requires modification and license notices. Only the selected infobox factual fields are extracted/normalized; the **Wikipedia-derived values** in the registry and Catalog retain CC BY-SA 4.0. Other independently collected data and application code are not relicensed. No media, narrative text, salary, event/statistic tables, annual/career totals, or copyrighted third-party dataset are imported. Photographs on Wikipedia are **not** covered by the article-text license.

116 articles are selected through the verified Wikidata sitelink; the returned `wikibase_item` must equal the exact bridge. Fifteen documented API batches (three sitelink, twelve article/revision/pageprops), 4,904,897 response bytes. The parser reads one named baseball infobox, respects nested template/link boundaries, rejects duplicate fields/truncated boxes and ignores unsupported syntax. References/markup are removed rather than executed.

Every applied Wikipedia-derived field receives `profile.credits`: article/revision URL (with contributor history), authors, license URL, affected fields, `modified: true`. The existing Profile and Data Sources UI expose these notices. Credits remain present even if Directory generation has already filled a field before Catalog generation. No inference establishes a current jersey or current registration from an infobox snapshot.

`出身地` becomes **originPlace**, distinct from Wikidata **birthPlace**. A club's draft year is not an inferred joining year. Only explicit NPB draft templates populate NPB draft years; MLB draft strings are excluded. `debutYear` is the year of an explicit first professional appearance, not automatically an NPB debut for foreign players. No source-listed team start is assumed to be a debut or registration event.

### Investigated, not imported

| Source / primary evidence | Data available | Reuse decision / upstream limitation |
|---|---|---|
| [nf3](https://nf3.sakura.ne.jp/) | Game facts, public notices, player/year pages | Existing provisional regular-season scope retained. No affirmative broader reuse permission; no new career/transaction/postseason collector |
| [NPB](https://npb.jp/) | Profiles, draft, historical/registration/Postseason records | Footer prohibits secondary reuse/unauthorized reproduction; no bulk automated copying or new production integration |
| [Hawks copyright](https://www.softbankhawks.co.jp/company/copyright.html), [Hanshin rights FAQ](https://hanshintigers.jp/home/qa/detail13.html), [Giants](https://www.giants.jp/) | Profile/roster/news/assets | Facts could support individualized human verification; website/database/media redistribution is not granted. Club logos/photos excluded |
| [baseball-data.com](https://baseball-data.com/) | Profiles, statistics | No affirmative database reuse grant verified; robots restrict multiple automated clients. No data downloaded |
| [SIJ / 野球DB Terms](https://www.yakyudb.com/tos/) | Profiles, career/draft context | Rights retained, public-app dataset redistribution not verified. No import |
| [NPB Data Visualization](https://npb-visualization.com/index.html) | Regular/open/Postseason, situational data | Availability does not establish upstream redistribution permission. No import |
| [Baseball Data Store](https://baseball-data-store.com/about) | Season database | Terms/upstream permission not sufficiently verifiable; unavailable rights, not an alternative production source |
| [armstjc dataset](https://github.com/armstjc/Nippon-Baseball-Data-Repository) | Rosters/draft/PBP | MIT code/author credit request does not authorize upstream SPAIA data; excluded |
| [nyk510](https://github.com/nyk510/baseball-dataset) | NPB historical TSV / scraper | No verified data license/upstream permission; excluded |
| [OOTP historical](https://github.com/lebronisbest/OOTP_NPB_Historical) | Historical/import files | Personal/non-commercial OOTP scope, not this public app; excluded |
| [wocchi09](https://github.com/wocchi09/npb-data) | NPB profiles/roster/Sports Navi PBP | Upstream scraped NPB/Yahoo data; no independent redistribution permission. Code/public repository is not a license for its upstream data |
| [CKAN research dataset](https://ckan.pf-sapporo.jp/dataset/baseballdata) | Baseball event data | Paid teaching/research data; not free app data |
| [DataStadium Snowflake sample](https://datastadium.co.jp/news/avOAp0E6) | Limited NPB schedule/result sample | Free sample availability is not verified public redistribution entitlement; no account or paid contract |
| [Municipal Osaka CC0](https://www.oml.city.osaka.lg.jp/page/1645.html), [e-Gov](https://data.e-gov.go.jp/info/ja) | Open bibliographic/general data | Dataset-level licenses do not supply a verified 735-player/complete-career dataset |
| [Zenodo](https://developers.zenodo.org/) / research papers | Repository/paper metadata | Metadata license is not dataset-file permission; no suitable rights-cleared NPB full-career/event dataset found |

Robots were checked separately at the above primary hosts on 2026-10-02. `docs/npb-free-source-robots.json` retains response status/hash and observed rules, not protected page data. NPB/nf3/Hawks/Hanshin/Osaka returned 404, Giants 403; these are **not** permission. Wikimedia permits the documented APIs under its API policies; no HTML crawl or robots bypass is used. Other sources' robots do not settle reuse rights. Unknown/prohibited source raw content is neither committed nor published.

## Inventory: 735 Players

Baseline public generation: effectiveDate 2026-09-30. Counts describe field availability, not a new verified current roster.

| Field | Before | After |
|---|---:|---:|
| Current dated uniform number | 0 | 0 |
| Bats | 0 | 116 |
| Throws | 0 | 116 |
| Canonical primary position | 9 | 81 |
| Additional source-listed positions | 0 | 88 |
| Birth date | 10 | 121 |
| Birthplace | 10 | 104 |
| Origin place | 0 | 108 |
| Nationality | 11 | 125 |
| Height | 7 | 100 |
| Weight | 5 | 80 |
| NPB draft year | 0 | 105 |
| NPB draft round | 0 | 103 |
| Canonical drafting team | 0 | 2 |
| Joining year | 0 | 0 |
| Explicit professional debut year | 0 | 99 |
| Schools attended | 0 | 70 |
| Partial affiliated-team history | 0 | 104 |
| Latest stored team | 735 | 735 |
| Current dated registered/developmental class | 0 | 0 |
| Exact additional career identity bridge | 0 | 116 |

No existing non-null field is overwritten. All valid competing values remain in the registry; they block null supplementation rather than letting source priority or recency choose a winner. Registry observations are not effective dates. Unknowns remain null/absent. Multiple positions are not reduced to a guessed primary position. School lists are not an inferred graduation/chronology claim. Affiliation lists are incomplete; missing end/period remains explicitly unknown.

1,878 source-verified candidate field records across the two licensed registries; 116 linked Players. **Actual human-reviewed additions: 0.** Codex source checks are not misrepresented as human review. `verificationStatus` distinguishes `source_verified`, `human_reviewed`, `pending`, `conflict`; the human workflow is implemented but unreviewed manual entries are not published. Disagreements/unsupported claims are retained in audit reports rather than silently accepted.

## Human-reviewed canonical master procedure

`profileRegistrySchema` validates playerId/field/value/sourceName/sourceUrl/license/rightsEvidence/publicReuseAllowed/verifiedAt/effectiveFrom/effectiveTo/status/reviewer/notes/additionalSourceUrls. Existing canonical IDs are mandatory; it cannot create or merge Players. For an individually verified fact, a named **actual human** reviewer and multiple independent references are required. Confirm that the record is an individually verified fact, not copied database content, and document reuse evidence. A page being accessible is insufficient. Pending/conflict/unapproved entries never enter production.

High-frequency results, game/annual stats and roster events are excluded from manual entry. Current jersey/class require day-precise bounds **and the same canonical team context**; naked numbers, open-ended historical claims, “professionally entered” years or cached provider path numbers cannot establish them. Career identities are internal links only, not permission to collect the linked site's data.

To reproduce normalized licensed snapshots from private official-API archives:

```
npx tsx scripts/review-npb-free-profiles.ts claims.json labels.json exact-bridges.json output.json observedAt
npx tsx scripts/review-npb-free-wikipedia.ts wikipedia-api-archive.json output.json
```

Review candidate field changes and conflicts before committing snapshots. No scheduled source request is required. Human review of unresolved entries is a separate future task; this batch does not fake its completion.

## Contract, capabilities and publication

Catalog **schemaVersion 1 remains backward-compatible**: all new fields are optional and old saved/offline payloads still parse. Added neutral profile fields: `knownPositions`, `schools`, `affiliations` (name/canonical team nullable/from/to/uniform), `originPlace`, `draftTeamId`/name, `joinedYear`, `debutYear`, `identityLinked`, field-specific reuse `credits`; membership `registrationClass` remains optional/unavailable. `careerHistory` retains its established empty/full-career-unavailable semantics. No canonical table or migration.

Capabilities include profile, handedness, knownPositions, schools, originPlace, draft, teamHistory/rosterHistory and careerIdentity with `known/total/status`. Current numbers/class, Career stats, historical seasons, transactions/FA/posting/prospects and NPB Current Postseason are not made available. Historical Wikipedia tables are potentially reusable but their annual/career completeness and league semantics have **not** been validated: rights availability alone cannot open Career. Direct BvP/PA Analysis cannot come from game co-participation.

The **same projector** is used by Directory, full Game surface, refresh and safety-net generation. Directory/Catalog/Capabilities/Milestones are validated/staged together at the same effectiveDate/generation; preserved Season/HOT/Team Season/Records/game data are not advanced or recomputed. New capability counts are checked at the publication boundary once advertised. The existing coordinated Directory workflow is used with `profile_projection_only=true` and `import_verified_profiles=false`: no canonical reads/writes or source collection. Preserved MLB/Postseason hash guards remain active.

The existing profile definition-list receives the additional fields and an expandable partial history/source credit section. No navigation/redesign/Mock, no source-ID route, no extra browser-to-source request. Catalog remains one request and approximately 606 KB, Directory approximately 223 KB; registries/raw API archives are **not** included in app runtime bundles, APK or Pages as raw data. Public Profile contains only allowed normalized values and necessary reuse credits.

## Intentional blockers / next paid consideration

No verified comprehensive free NPB career/annual/game-level historical/event dataset was found. Career milestones, dated movements/trade/FA/posting, comprehensive draft/prospects, Current Postseason and PA/BvP remain unavailable or Source rights pending. Rain-shortened partial Games and NPB HOT/Ranking/Infrastructure Gates are not reassessed. Photos/logos remain unavailable.

If a future small paid contract is considered, the highest-value scope is explicit **public-app storage/redistribution rights** for complete historical stats, current roster/movement and Postseason/Game-level facts. A paid price alone does not grant those rights. No paid service is selected or contracted in this batch.
