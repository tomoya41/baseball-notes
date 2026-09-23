# AGENTS.md

## Source of truth
- `SPEC.md` is the product specification and primary source of truth.
- `docs/decisions.md` records durable product and architecture decisions and why they were made.
- `README.md` contains setup and operating instructions.
- Do not duplicate large sections of the specification into this file.

## Development policy
- Build incrementally. Do not implement multiple future phases at once.
- Each task must be small enough to review, run, test, and revert independently.
- Preserve working behavior unless the specification explicitly requires a change.
- Before a large structural change, explain the reason, affected areas, migration risk, and rollback path.
- Additional monthly running cost must remain ¥0 unless the user explicitly approves otherwise.
- Do not add paid APIs, paid services, or recurring-cost infrastructure without explicit approval.
- Do not use scraping, reverse engineering, undocumented private endpoints, or other data acquisition that conflicts with applicable terms.
- Keep external data-provider integrations behind adapters so providers can be replaced without rewriting the domain/UI layers.
- MLB and NPB do not need artificial feature parity. Use richer MLB data where it is legitimately and reliably available.
- AI must remain optional. The core app must work when AI is unavailable or quota-limited.
- Do not implement pitch-by-pitch速報 as a core feature. The app focuses on baseball data discovery, player context, trends, records, seasonal features, and personalization.

## Audience / UX
- Primary audience: ordinary baseball fans who want to understand data, not only advanced analysts.
- Advanced metrics are welcome, but every unfamiliar metric must have an accessible explanation: what it measures, how to interpret it, and when useful, what counts as roughly high/low.
- Prefer progressive disclosure: important metrics first, advanced metrics behind tabs, drawers, or expandable sections.
- Never invent unavailable NPB data to match MLB.

## Code quality
- Use TypeScript strict mode where TypeScript is used.
- Prefer simple, explicit code over premature abstraction.
- Validate external API responses before data reaches the domain or UI layers.
- Handle missing, stale, delayed, corrected, and partially available data explicitly.
- Add/update tests for important calculations, ranking logic, date windows, record milestones, and regressions.
- Run relevant lint, typecheck, tests, and build checks before considering a task complete.
- Never commit real API keys, tokens, credentials, or personal secrets.
- Keep generated/cache/build outputs out of Git.

## Repository hygiene
- At the end of every meaningful task, inspect changed areas for obsolete files, abandoned implementations, duplicate assets, temporary scripts, debug output, generated artifacts, stale mocks, and superseded documentation.
- Remove such files when they are demonstrably unused and safe to delete.
- Before deleting, verify references with repository search, imports, build configuration, scripts, and tests. Never delete merely because a file looks unused.
- Do not perform broad unrelated cleanup during a feature task.
- If a file may still be required, leave it in place and note the uncertainty instead of deleting it.
- After cleanup, rerun relevant checks so cleanup cannot silently break the project.
- Keep cleanup changes within the same logical task only when directly related; otherwise create a separate small cleanup change.

## Git / scope discipline
- Use Git from the beginning.
- Prefer one logical feature/fix per commit or review unit.
- Do not perform unrelated refactors while implementing a feature.
- Update `docs/decisions.md` only for durable decisions, not routine implementation notes.
- Do not rewrite established product decisions without documenting why.
