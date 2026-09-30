# Batch G — NPB data / visual rights evidence

Accessed/reviewed: **2026-09-30 JST**. This is an implementation eligibility record, not a new blanket licence for baseball content. Data availability, identity confidence and permission are separate gates. No new paid source, third-party current collector, image download, hotlink or raw HTML publication was added.

## Adopted scope and safe expansion

The existing nf3 integration remains **provisional** under the established decision. This batch does not enlarge its acquisition scope. A publicly readable page is not evidence of permission to copy an entire database into a public app. Rights uncertainty also remains a durable blocker for a future commercial release of the existing integration; do not tell Astra that provisional means licensed.

Existing manually verified Wikidata bridges identify four canonical players using an exact entity ID, name, date of birth and team relationship. New measurement data uses only those bridges; no bulk name-only matching. Wikidata entity claims are CC0. CC0 permits free download, storage, modification, app display, redistribution and commercial use; required copyright attribution is none, but About already credits Wikidata. This permission does **not** apply to photographs linked from P18 or prose from Wikipedia.

Primary statements (short excerpts):

| Source | Primary evidence | Decision |
| --- | --- | --- |
| Wikidata structured data | [Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing): “All structured data from the main, property, lexeme, and EntitySchema namespaces is available under the Creative Commons CC0 License” | `production_allowed` for structured claims only |
| Wikidata API | [Data access](https://www.wikidata.org/wiki/Help:Data_access), documented `wbgetentities` / Action API | One manual batch request for reviewed IDs; not a daily dependency |
| nf3 | [2026 index](https://nf3.sakura.ne.jp/), [player example](https://nf3.sakura.ne.jp/Central/T/f/8_stat.htm), [公示履歴](https://nf3.sakura.ne.jp/Stats/kouji.htm), [2025 index](https://nf3.sakura.ne.jp/2025/index.html) | Readable uniform/投打/registration/history pages exist. No comprehensive save/process/public redistribution grant verified; no new ingestion |
| NPB official | [Stats index](https://npb.jp/bis/2026/stats/), [draft](https://npb.jp/draft/), [social guideline](https://npb.jp/social/guideline.html) | Current/history/career/milestones/draft/open games have sources. Reference only; no bulk collector switch or new redistribution permission inferred |
| Team-owned profile/marks | [Hawks copyright](https://www.softbankhawks.co.jp/company/copyright.html), [owner FAQ 615](https://faq.softbankhawks.co.jp/faq/show/615?site_domain=open) | Hawks prohibit unapproved reproduction/use of site photos/marks and provide permission contact. Other teams require their own asset-specific audit; not automatically licensed |

Exact identity bridge: `src/data/npb-verified-player-mappings.ts`. Reviewed measurement snapshot: `src/data/npb-reviewed-measurements.ts`; source adapter: `src/infrastructure/providers/wikidata-measurements.ts`. Manual review command writes only an ignored review artifact, never auto-applies or mutates canonical data:

```sh
npx tsx scripts/review-npb-measurements.ts
# replay a downloaded official JSON response, without HTTP
npx tsx scripts/review-npb-measurements.ts --input=.data/batch-g/wikidata-reviewed-players.json
```

Source response SHA256 reviewed this batch: `0df3ae7a83c65d25ffb9b492156ed6ffef37dc91392ebe274321d0d9f75409a1`.

| Canonical player | Entity | P2048 height | P2067 weight | Handling |
| --- | --- | --- | --- | --- |
| 中島大輔 `06a3e027-7a73-4792-9c91-8ecc3c1da36a` | Q124479656 | absent | absent | null / null |
| 上原健太 `6bf4b271-e16c-43f9-9142-8c7ca7de9887` | Q22117979 | 190 cm | 83 and 84 kg | 190 / null (conflicting normal claims) |
| 坂本誠志郎 `2d760a27-b58a-47a5-80df-6b0aa3571ef5` | Q22118838 | 176 cm | 78 kg | 176 / 78 |
| 早川隆久 `a66dfd52-1ae2-4245-b849-558f263e6422` | Q102246615 | 180 cm | 76 kg | 180 / 76 |

Explicit unit conversion only; preferred claims take precedence, deprecated claims are ignored, conflicting/unknown units remain null. Observation/review time is not the date a measurement was taken. No “current weight” claim. Stored position/投打 is not inferred from appearing as a batter/pitcher. Neither NPB ID P4260 nor a Wikidata image link is an image licence.

## Visual source matrix

| Candidate / owner | Licence / app display | Hotlink | Local cache / redistribution / modification | Commercial / credit | Production classification |
| --- | --- | --- | --- | --- | --- |
| Official NPB/club headshots and logos / respective owners | No general reusable asset licence verified; Hawks explicitly prohibit unauthorized use | URL existence grants nothing; not enabled | Not enabled without permission | Permission from relevant rights holder; no automatic endorsement | Hawks `prohibited` absent permission; other unaudited assets `permission_unclear` |
| [Daisuke Nakashima.jpg](https://commons.wikimedia.org/wiki/File:Daisuke_Nakashima.jpg) / Hotta Akahane, own work, taken 2024-03-27 | **CC BY-SA 4.0** verified on exact file, copyright use allowed subject to licence | Commons technically supports it but does not recommend it | Copyright licence permits download/cache/redistribution/adaptation; attribution and derivatives' ShareAlike required | Commercial copyright reuse allowed; credit author + licence + changes; no implied endorsement | Copyright permission verified; overall intended app portrait permission `permission_unclear` pending applicable non-copyright/venue/personality review; no public URL |
| Wikidata P18 links to [Uehara20.jpg](https://commons.wikimedia.org/wiki/File:Uehara20.jpg), [坂本誠志郎選手.jpg](https://commons.wikimedia.org/wiki/File:坂本誠志郎選手.jpg), [Eagles Takahisa Hayakawa 20220330.jpg](https://commons.wikimedia.org/wiki/File:Eagles_Takahisa_Hayakawa_20220330.jpg) | Candidates exist; this batch does not approve them from P18 alone | Off | Off until file-specific owner/licence/intended-use review | Not presumed from Wikidata CC0 | `permission_unclear` |
| Commons team marks / individual owners | A freely licensed/public-domain graphic can still carry trademark restrictions | Off | Requires exact file + brand rights analysis | No implied official endorsement | `permission_unclear` |
| App-created neutral text mark / this app | Abbreviation/name text fallback, no copied art | Not relevant | Generated UI text, no remote asset | No official affiliation claim | `production_allowed` fallback |
| Official team colour specification | No reviewed licensed brand specification adopted | Not relevant | No official colour palette copied | App may choose neutral UI colours; must not label them official | Official metadata unavailable; neutral fallback allowed |

[Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) requires file-specific licence verification and discusses non-copyright restrictions separately. It does **not** say every athlete photograph needs a release for every use. Our decision is narrower: the requested intended app/commercial portrait use has not been verified, so this batch does not classify it as fully cleared. A later documented editorial-use analysis or permission can approve an exact file without changing the UI contract. [NPB spectator photography rules](https://www.npb.or.jp/npb/satsuei_haisin_kitei_text_20250201.html) are another relevant venue/context check; not a licence for team-owned website photographs.

Do not route around these conditions with hotlinks, Wikipedia thumbnails, team CDN URLs, scraping SPAIA/DELTA or a paid API. No `display_allowed_but_no_redistribution` source was positively confirmed this batch.

## Other source gaps

| Group | Source exists? | Missing gate / outcome |
| --- | --- | --- |
| Uniform, detailed position/投打, height/weight, birthplace | nf3/club/NPB and partially Wikidata | Broad source reuse + canonical bridge; only reviewed CC0 claims expanded |
| Draft, registration/removal, trade, retirement, FA/posting | Official and some nf3 registration records | Event-specific reusable source, effective dates and canonical mapping; OFF, not treated as Game Facts |
| NPB past season / career | nf3 older index + official historical records | Rights, historical enumeration/coverage and longevity; OFF, collected 2026 totals are not career |
| Career milestones | Official lists exist | Reusable source + full career coverage; cannot infer 1000th career hit from this app's collected range |
| Prospects / camp / exhibition/open games | Official/team information exists | Rights + competition-specific identity/coverage; OFF, never mixed into regular season |
| Direct BvP / pitch-level / exact substitution / relief order | Required adopted canonical granularity absent | `source_unavailable` means unavailable in the adopted reliable data contract, not nonexistent anywhere |
| Ranking / Records / HOT | Existing engines and payloads exist | Production readiness gates, not a rights-based substitution or mock |

No newly verified evidence closed a rain-shortened game. Existing partial status and its reasons remain intact. Scheduled proof is owned by the separate Operations track and was neither monitored nor inferred from this manual publication.
