# NPB Player Analysis: shared 30-day context and batting order

The Player Analysis page reads one server response for its 7/14/30 comparison, Home/Away,
opponent, and batting-order sections. The server reads one 30-day set of joined batting
and pitching Game Facts, plus the existing coverage calendar, then projects each section
in memory through the existing services and aggregators. Each projection has an independent
ready/error result. Existing individual endpoints remain available for rollback; no Fact,
schema, collector, Daily/Freshness workflow, HOT, or persistent cache changes are needed.

Batting order is the stored Player Game Batting Fact slot (1–9). Missing or invalid slots
remain unclassified; substitute appearances are included only when the Fact has a confirmed
slot. This is one slot per Player Game Fact and cannot describe an in-game slot change.
The selector shows only observed slots, ordered 1–9, and defaults to the most recent
recorded slot. Same-date ties choose the lower slot deterministically. Each slot is
aggregated independently with the existing batting formulas and metric availability.
The 30-day coverage calendar describes the **period**, not the completeness of a slot.
The comparison total includes only classifiable Facts, while unknown Fact and PA counts
remain available for diagnosis. No small-sample judgement or rank is implied.

The manual read-only batch verification workflow reports the latest 30-day known/unknown
distribution and selected real players without printing credentials or writing to Turso.
Rollback switches the page back to the individual Analysis endpoints and removes the
combined endpoint and batting-order section. Stored Facts need no migration or repair.
