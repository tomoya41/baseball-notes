# NPB Player Analysis: Home / Away

The Player Analysis screen compares saved batting and pitching Game Facts for the inclusive JST `30d` window. The server joins each Fact to its canonical Game and classifies the Fact's `teamId` against the Game's `homeTeamId` and `awayTeamId`. The Game Log uses the same classifier. Missing or conflicting team metadata goes to an `unknown` count, never to either split.

One batting query and one pitching query read the player's 30-day Facts with Game team IDs. The application partitions those rows and calls the existing `aggregateBatting` and `aggregatePitching` functions for each nonempty side. No split rates or derived tables are maintained. A correction to a Game Fact appears on the next read. The API uses the same read-only Turso connection as Player Recent and returns only aggregates, coverage, and unknown counts; it does not expose source records or credentials.

The result keeps 30-day Period Coverage separate from Home/Away sample size and metric availability. Coverage may be `unknown` while both split values are calculable. A side with no Fact is empty, not a zero-rate performance. Zero-PA batting Facts and zero-out pitching Facts still count as appearances. Missing fields propagate through the existing Metric Status rules, and WHIP is never shown.

The screen presents the existing 7/14/30 comparison first, followed by Home/Away. The split request has independent loading and error states. It shows saved-data wording because the current Fact history does not establish a complete season record. Only `30d` is wired to the UI; other period types can reuse the partition-and-aggregate flow later without a query language or new formulas.
