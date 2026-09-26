# NPB Player Analysis: starter and reliever

The 30-day Analysis Bundle reuses its single joined Pitching Fact read and shared
coverage calendar. It partitions each stored appearance by the Fact's explicit
`role` (`starter` or `reliever`), then passes each group to the existing pitching
aggregator. `starter` flags that contradict `role` remain unknown. An absent
or unknown role is never inferred from innings, pitches, decisions, saves, or
holds. Game Log uses the same classification helper. The HOT ranking and its
production gate are unchanged; the stored role and starter flag agree for a
normally classified Fact.

Each role retains its own metric availability, including nullable pitch count.
The 30-day coverage calendar describes the period, not a role. Empty roles show
no saved appearance rather than zero ERA. Zero-out appearances count as
appearances; ERA and K/9 remain undefined when total outs are zero. WHIP is
never displayed because NPB Facts do not contain standalone BB. The result
includes unknown appearance count, outs and BF, and a classified total for
diagnostics. No role aggregate is persisted or written back to Turso.

These are saved-game splits and do not establish whether a pitcher is better
suited to either role. Older or corrected Game Facts change the result at the
next read. This work does not affect Daily/Freshness workflows or HOT rankings.
