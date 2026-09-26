# NPB Game Detail / Box Score

`#/NPB/games/{canonicalGameId}` reads one saved `npb_games` row, its saved
batting and pitching Game Facts, game completeness, and canonical team/player
display metadata. The API performs six fixed SELECTs for an existing Game;
neither the number of players nor the number of substitutes adds queries.
It makes no source request or database write. A correction to a Fact appears
on the next read; the HTTP response has a five-minute CDN freshness window.

Team assignment uses the Fact's canonical team ID and is cross-checked against
the Game's home/away IDs and opponent ID, as in Player Game Log. Missing names
are labeled as unregistered. Batting order is a sorting key, never a unique
identity; same-slot substitutes remain separate players. When appearance
sequence is unavailable, a stable canonical ID tie-break is used rather than
an invented substitution order. Pitcher order uses saved `appearanceOrder`
when known, then the explicit role and a stable ID; role classification shares
the Game Log/Analysis helper. Internal innings remain outs; only display uses
baseball `innings.remainder` notation.

Nullable player fields stay unknown and display as a dash. Team totals are returned
only when every saved player row supplies the field. For a validated complete
Game only, missing individual PA may be supplemented at the **team** level by
the opposing pitchers' saved BF sum, with provenance displayed beside PA;
individual PA remains unknown. Score is taken from the
Game, not inferred from player totals. A non-complete Game carries a visible
completeness note. Scheduled/postponed games show their status without a fake
Box Score. The view does not claim inning-by-inning or play-by-play detail,
which is not available in the saved canonical Facts. Pitching `walksAndHitBatters`
is labeled 四死; no standalone BB or WHIP is inferred.
