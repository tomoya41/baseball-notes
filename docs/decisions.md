# Durable Decisions

This file records decisions that should survive individual implementation tasks.

## 2026-09-23 — Product focus
The product is a baseball data discovery app, not a pitch-by-pitch速報 replacement.

Reason:
- Sports Navi already serves pitch-by-pitch速報 well.
- The product can differentiate through recent-form analysis, player context, historical records, advanced data, seasonal features, and personalization.
- Avoiding pitch-by-pitch monitoring substantially reduces infrastructure and API pressure.

## 2026-09-23 — Audience
Primary audience: ordinary baseball fans who want to explore data.

Advanced metrics are allowed and encouraged, especially for MLB, but the UI must explain unfamiliar metrics in plain language.

## 2026-09-23 — Leagues
NPB and MLB are both first-class leagues.

MLB may expose significantly richer data. The app should use useful legally available MLB data rather than artificially limiting MLB to match NPB.

## 2026-09-23 — Cost constraint
Additional recurring monthly cost must remain ¥0 unless explicitly changed later.

Free tiers are acceptable. A feature that requires recurring paid infrastructure belongs in a future/optional bucket until explicitly approved.

## 2026-09-23 — AI
AI is optional enrichment only.

The core application, rankings, records, profiles, favorites, and seasonal features must remain useful when AI is unavailable. AI may later explain statistics, summarize sourced information, or make complex data easier for general fans to understand.

## 2026-09-23 — Accounts
Initial implementation does not require user accounts.

Favorites and preferences should initially be stored locally on the device. Cloud synchronization can be added later if justified.

## 2026-09-23 — Development method
All planned features remain in the long-term scope, but implementation is incremental.

Do not build everything at once. Establish a stable foundation, verify it, then add feature groups one by one.

## 2026-09-23 — Repository hygiene
Repository cleanup is continuous.

After each meaningful task, check for obsolete task-related files, superseded implementations, temporary scripts, debug files, duplicate assets, and stale mocks. Delete only after verifying they are unreferenced, then rerun relevant checks.
