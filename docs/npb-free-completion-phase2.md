# Free NPB Completion Phase 2 — 2026-10-03

735 released canonical Players, public effectiveDate 2026-10-01. This is a licensed,
release-time read-model complement: **canonical/Turso writes 0**, no new result collector,
paid service, daily source polling, media or Current MLB data. Existing values and all
85 previous conflicts remain. The completed UI receives fields in its existing profile.

## Rights evidence and boundaries

Accessed 2026-10-03 JST. Source existence, robots access, and permission to reuse are
separate. Agent transcription does not circumvent terms. New source grants:

| Source | Primary license evidence | Use / public output |
|---|---|---|
| Wikidata | [Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing): structured data is CC0 | Exact identity claims and structured profile facts. No images or non-entity text |
| Japanese Wikipedia | [Terms §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Normalized infobox facts and 20 Codex-read explicit draft nomination relationships; derived values remain CC BY-SA 4.0 |
| Chadwick Register | [README License](https://github.com/chadwickbureau/register/blob/master/README.md): “This dataset is made available under the Open Data Commons Attribution License” ([ODC-BY 1.0](https://opendatacommons.org/licenses/by/1-0/)) | Exact `key_npb`/UUID/external-ID bridge and full birth components. No career spans interpreted as NPB debut |

These licenses allow storage, modification, distribution and commercial reuse under
their conditions. Wikipedia article/revision/contributor links, license links, modified
notices and field lists remain in `profile.credits` and the existing Data Sources UI.
Chadwick's ODC attribution appears in Data Sources and profiles using its DOB. The
registry/review queue retains source-specific licensing. Neither license on an ID
bridge nor an external MLBAM/BBref/Retrosheet ID licenses that other site's data.

Only permitted normalized facts and necessary provenance are in Git/public projections.
Raw API archives are ignored under `.data/npb-free2`, never Pages/APK payloads. No
third-party article prose, photographs, logos, salary, box-score or career tables copied.
Private licensed ingestion/aggregation remains separate from permitted public output.

## Bounded source exploration

Rechecked [existing rights inventory](npb-free-data-expansion.md), official APIs and:

| Candidate | Source available | Rights / adoption |
|---|---|---|
| [npbnoitall/npbdata](https://github.com/npbnoitall/npbdata) | Historical registers/CSV | Upstream/database redistribution not verified; not adopted |
| [armstjc repository](https://github.com/armstjc/Nippon-Baseball-Data-Repository) | Rosters/draft/PBP | SPAIA upstream; repository/code license not an upstream grant; not adopted |
| [wocchi09](https://github.com/wocchi09/npb-data), [BR scraper](https://github.com/Shinichi-Nakagawa/br-scraping-npb) | Profiles/stats | NPB/Yahoo/BR upstream reuse not verified; not adopted |
| [Ramos-Ramos/npb](https://huggingface.co/datasets/Ramos-Ramos/npb) | Dataset search result | License/upstream could not be verified; retrieval failure is not permission |
| [University baseball directory](https://probaseballdata.com/) | School/pro associations | No affirmative dataset redistribution grant verified; not adopted |
| [e-Gov](https://data.e-gov.go.jp/), municipal CKAN, public university/school materials | Public datasets/documents | No rights-clear, complete pro-player/profile collection found; per-item license/identity required |
| [Japan Search](https://jpsearch.go.jp/en/policy) / Wikimedia-related metadata | Open bibliographic metadata | Metadata licenses do not cover embedded source assets; no additional relevant player values adopted |
| NPB, 12 clubs, baseball-data.com, SIJ/野球DB, nf3 | Profiles/historical/events | Prior restrictions/permission uncertainty remain; no expanded collector or database replication |

No paid account/trial or rights-unclear raw download/import. Career/historical totals,
transactions/registration/FA/posting/trade, Current NPB Postseason and PA/pitch/tracking
remain blocked. Existing provisional nf3 regular collector scope is unchanged.

## Identity and accurate verification

116 → **667** bridges; **551** new automated approvals, **68** unmatched, **0** approved
ambiguous identities. Canonical IDs never changed or merged.

1. Official WDQS index: exact Japanese label/registered alias (NFKC/whitespace/interpunct
   normalization only), canonical franchise membership, unique eight-digit P4260.
   Actual non-deprecated claims and known DOB checked before approval: 489 additions.
2. For the remaining 130, exact Japanese article titles or documented API redirects,
   explicit infobox club, one NPB external ID, exact Chadwick cross-reference and the
   article's `wikibase_item`: 62 further approvals. No surname/fuzzy/romanization guess.
3. All 667 match one Chadwick UUID; conflicting UUID/Wikidata or duplicate matches reject.
   Historical franchise association establishes identity, not current roster/jersey.

`npb-free-profile-identities.json` keeps the original archived bridges and new method,
source/revision/evidence, Chadwick archive SHA-256 and cross-references. Register public
updates may lag; its SHA identifies the reused archive rather than a fabricated release.

Field candidates: 1,878 retained previous source-verified + 13,029 new **automated** +
20 **codex_assisted** = **14,927**. These are evidence entries, including duplicate
agreeing values/conflicts, not a claim of 14,927 new public values. **Human-reviewed 0**.
The 20 draft teams were read by Codex in explicit dated draft nomination statements;
no prose copied or historical team renamed. No joining year inferred from draft year.

## Coverage (known Players out of 735)

| Field | Before | After |
|---|---:|---:|
| Current uniform number | 0 | 0 |
| Bats / throws | 116 / 116 | 667 / 667 |
| Primary position | 80 | 518 |
| Source-listed position set | 89 | 583 |
| Birth date | 121 | 665 |
| Birthplace / origin | 104 / 108 | 571 / 629 |
| Nationality | 125 | 662 |
| Height / weight | 100 / 80 | 584 / 486 |
| Draft year / round | 105 / 103 | 623 / 602 |
| Draft canonical franchise | 2 | 33 |
| Explicit NPB regular/developmental draft type | 0 | 601 |
| Joining year | 0 | 0 |
| Professional first-appearance year | 99 | 604 |
| Explicit NPB-only debut year | 0 | 0 |
| School information (P69 or explicit school history) | 70 | 653 |
| Partial professional/team affiliation history | 104 | 608 |
| Latest stored affiliation | 735 | 735 |
| Current registered/developmental status | 0 | 0 |
| Career identity bridge | 116 | 667 |

The previous 99 `debutYear` values are **professional**, not automatically NPB debut.
Keep that published meaning; generic 初出場 for a foreign player never proves NPB debut.
School attendance/history does not prove graduation; 456 P69 school sets and 644
explicit high-school/university history sets overlap (653 unique Players). Position
sets are not a verified current primary position or a complete defensive-game history.
Current jersey/status requires precise dates covering the public day plus exact same
canonical Team; unbounded/historical Wikipedia/Wikidata fields cannot satisfy this.

## Conflicts, contract and publication

**400** field exceptions: 396 source conflicts, 4 cross-field definition conflicts;
the original 85 are retained. No voting/recency priority resolves them. Queue:
[`npb-curated-review-queue.json`](npb-curated-review-queue.json), with player/field,
known/candidate values, source/revision/license/date, evidence, reason and action.
Unmatched identity without a viable candidate remains a discovery limitation, not 68
artificial manual-transcription requests. Current-number absence likewise isn't a queue.

Additive optional Catalog v1 fields: `amateurHistory`, `npbDebutYear`, `draftType`.
Registry adds accurate method/revision/observation/transformation and ODC-BY support.
Capabilities count each supported field and school union, plus rosterStatus. Older
payloads/offline caches remain readable. No migration/new canonical table. Public
consumer/UI remains provider-independent and requests no source APIs.

All publish/safety-net paths use the same projector. Directory/Catalog/Capabilities/
Milestones share effectiveDate and generation, validated before artifact upload and
by public HTTP/hash verification. New advertised field counts are checked at that
boundary. Profile-only coordinated publish does not access/write Turso. NPB Season,
HOT, Team Season, Records, Games/Coverage, standings, MLB and Postseason are preserved.
Rollback reverts this PR's additive registry/projector fields and republishes the family;
no canonical DB rollback is needed. No Operations proof or Gate reclassification.

## Cost, performance and repeatability

One WDQS query, 184 sequential Wikimedia API batches across exploration/resumes,
retry 0; 182 cached response archives total 52,436,147 bytes plus final augmentation
responses/index. Cached batches dedupe by URL/IDs. The profile downloader bounds
transient retries to three; permanent/API validation failures stop the import. Chadwick
archive reused locally, no new full-register download. No daily source workload.

Catalog **1,258,130 bytes**, Directory about 237 KB, generation about 0.26 seconds,
DB reads/writes 0. Full registry is build-time server-side evidence, not client bundle.
Recurring hosting/API/backend charges remain **¥0**. Local ignored raw archives and
curated registries are release inputs; Pages contains normalized projections only.

Reproduction starts with a saved production Directory and existing licensed Chadwick
CSV/archive, then the explicit scripts `download-npb-curated-identities`,
`download-npb-curated-profiles`, `discover-npb-wikipedia-identities`,
`augment-npb-wikipedia-identities`, profile download for additional IDs, and
`normalize-npb-curated-profiles` (all `.ts` via `npx tsx`). Normalize does not invent
Codex-assisted entries; those are separately recorded source-read facts. Validate with
`verify-npb-safe-projections`, `audit-npb-free-profile-expansion`, and
`audit-npb-curated-review-queue`. Re-import is explicit, never scheduled. Validate
identity/known-value preservation and inspect proposed data diff before publication.

## Practical free-source endpoint

- Still worth free work: explicit draft nominations and NPB-specific debut/join evidence
  in already verified CC BY-SA articles; localized aliases/external IDs for the 68.
- Codex-assisted continuation: small targeted semantic fact extraction (not wholesale
  prose, roster or box-score reproduction); preserve revision/definition/method.
- Human judgment only: the 400 conflicting fields; definitions/time/identity evidence,
  never majority vote. Absence alone is not a human exception task.
- Free limit reached for now: dependable dated current jerseys/roster and complete
  Career/historical/event/Postseason/PA data with verified public redistribution rights.
- If licensed data is considered later: dated roster/jersey + annual Career coverage,
  with explicit public derived-output permissions first. No subscription in this batch.
