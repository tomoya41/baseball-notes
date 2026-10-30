# NPB Home: context and verified freshness

The previous Home promoted Japan Series ahead of all controls for the entire
2026-10-24–11-08 calendar window. The manual `homeSeason` query affected only
secondary stories; standings/follow views could not suppress that headline.

Home now has a visible Auto / Spring / Regular / CS–Draft / Moves–Contracts
selector using the existing `homeSeason` URL parameter. Other query parameters,
saved favorites, native Back and existing destinations are preserved. Top,
standings and follow remain separate views; contextual stories appear on Top only.

## Selection rules

- Regular: saved game results first. Their year comes from a validated payload,
  never the device clock or a hardcoded current year.
- Spring: existing young-player and collected historical-analysis destinations.
- Autumn: a recent verified Japan Series result (today/yesterday JST) or a near
  scheduled game with a snapshot no older than 48 hours can lead. Overdue missing
  results prevent promotion. This is prominence logic, not a series-final decision.
  The automatic series window can extend into November; an explicit manual
  Spring/Regular/Winter selection takes precedence.
- Late October/winter: available article records from the last 14 JST calendar
  days, at most three distinct people. Saved NPB player/team UUID favorites come
  first, then recorded date and stable ID. Photos/names do not establish identity.
- Otherwise: existing seasonal discovery links. Stale or unavailable data never
  establishes no games/no transactions or a completed series.

At the fixed QA clock 2026-10-30T03:00Z, the actual pinned Japan Series v4 has
three results through October 27, with October 28/29 results missing. It moves
to an explicit closed **日本シリーズの収録情報** disclosure. The actual v7
events dataset has 66 partial article records, including October 29 notices,
so Home leads with **選手の動き**. Contract renewals remain **未収録**.
Article record labels and Wikipedia author/revision/CC BY-SA 4.0 links remain
visible; neither current registration nor direct official verification is implied.

## Reads, gates and preservation

One existing hashed Japan Series projection (5,185 bytes), then, when needed,
one existing hashed event projection (50,921 bytes). No provider/DB request,
canonical write or new public data. Verified values stay in Home state across
view changes; no minute-by-minute network polling. Regular results and the
personal statistics dashboard are mounted on demand outside Regular mode.
CS spotlight data remain unrequested until their existing disclosure is opened.

These are dated source records, not HOT/Ranking or an inferred player status.
All production gates, payload pins, legacy URLs and immutable assets remain intact.
No typography enlargement or new screen/design is introduced. Existing compact
rows, selector, disclosures and native font scaling are reused. Additional cost ¥0.

## Validation

Presentation/UI regression covers JST boundaries, November series selection,
future/stale/overdue data, manual scope, favorite UUIDs, 14-day expiry, source
failure/retry, attribution, lazy saved games and retaining loaded pins across tabs.
Native regression explores recorded series explicitly rather than assuming stale
scores must always lead. Added real-pinned-data Home → event → canonical Player
QA, 360px Light/Dark at native 100/150/200%, navigation and missing-data checks.

Final CI, emulator and publication evidence is recorded after completion.
Public browser visual inspection, physical Pixel, TalkBack and installed-app
signing compatibility must not be inferred from emulator results.
