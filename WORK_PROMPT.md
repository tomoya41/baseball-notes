# Initial Work Prompt

Use **GPT-6 Astra with High reasoning** for this initial foundation task.

You are starting a new Android-first NPB + MLB baseball data application.

## Read first
Read these files completely before changing anything:
1. `SPEC.md`
2. `AGENTS.md`
3. `docs/decisions.md`
4. `README.md`

Treat `SPEC.md` as the product source of truth and `AGENTS.md` as execution rules.

## Goal of this task
Create a robust project foundation that supports the full roadmap in `SPEC.md` without attempting to implement the full application now.

This first task is intentionally about architecture, data feasibility, and a stable skeleton.

## Required work

### 1. Validate architecture assumptions
Evaluate the preferred direction:
- TypeScript-based mobile-first UI
- Capacitor for Android
- GitHub source control
- browser development/preview
- Vercel only if it provides useful free preview/developer value
- zero additional recurring monthly cost

If a materially better architecture exists under the constraints, choose it only after documenting why.

### 2. Validate data-source feasibility
Investigate current legitimate zero-cost/free-tier options separately for MLB and NPB.

For each proposed provider/source, document:
- coverage,
- data types available,
- authentication,
- current free quota,
- update frequency,
- terms/licensing concerns,
- whether caching/storage appears permitted,
- reliability/official-support caveats,
- fallback/replacement strategy.

Do not use prohibited scraping, reverse engineering, or private undocumented endpoints as the foundation.

The product does not require pitch-by-pitch速報.

MLB has richer data and should use useful permitted advanced data rather than being limited to NPB parity.

### 3. Design provider-independent domain models
Create clean interfaces/types for at least:
- League
- Team
- Player
- PlayerProfile
- SeasonStats
- TimeWindow / recent-form window
- HitterStats
- PitcherStats
- MetricDefinition / metric explanation
- Favorite
- DataFreshness / source metadata

Design extension points for:
- records,
- draft/prospects,
- FA/posting/movement,
- preseason,
- advanced MLB metrics,
- notifications.

Do not prematurely implement every future model in full.

### 4. Build the project skeleton
Create the minimum runnable project structure.

The skeleton should support:
- Android packaging direction,
- browser preview,
- routing/navigation,
- NPB/MLB selection,
- data-provider adapters,
- validation/normalization,
- local persistence,
- test setup,
- lint/typecheck/build commands.

Avoid unnecessary frameworks, libraries, boilerplate, or duplicate configuration.

### 5. Implement one thin vertical proof
Implement only enough UI/data flow to prove the architecture.

Example acceptable proof:
- app launches,
- basic Home / Players shell,
- NPB/MLB switch,
- a player list/profile loaded through the provider abstraction or a clearly isolated fixture when live provider setup is not yet safe,
- metric explanation component,
- local favorite toggle.

Do not begin Hot rankings, draft, FA, preseason, full records, notifications, or AI unless strictly required to prove the foundation.

### 6. Verify
Run:
- install/build,
- typecheck,
- lint,
- relevant tests,
- browser smoke check if available,
- Android build/sync check if environment permits.

Fix issues found rather than merely listing them when feasible.

### 7. Repository hygiene
At the end of this task:
- inspect for unused starter files,
- superseded configs,
- abandoned implementation attempts,
- temporary scripts,
- debug output,
- duplicate assets,
- stale mocks or generated artifacts.

Delete only items verified to be unused by repository search/import/build/config checks.
Do not perform unrelated broad cleanup.
After cleanup, rerun relevant checks.

### 8. Documentation
Update:
- `README.md` with exact local setup/run/build instructions,
- `docs/decisions.md` with durable architecture/data decisions,
- `.env.example` if environment variables are introduced.

Do not put secrets in the repository.

## Hard constraints
- Additional recurring monthly cost must remain ¥0.
- No full-app implementation in this task.
- No pitch-by-pitch速報 clone.
- No AI dependency in the core architecture.
- No paid service added without explicit approval.
- No destructive repository cleanup without reference verification.
- Do not invent NPB fields to match richer MLB data.
- Prefer replaceable data-provider adapters.
- Keep implementation small, testable, and reversible.

## Completion report
When finished, report:
1. architecture chosen and why,
2. data sources considered/chosen and important caveats,
3. files and modules created,
4. commands/tests run and their results,
5. what was deliberately not implemented,
6. any unresolved risk that matters before the next task,
7. the single best next implementation task.

Stop after the foundation task. Do not continue into later phases automatically.
