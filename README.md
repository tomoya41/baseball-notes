# Baseball Data App

Working title for an Android-first NPB + MLB baseball data application.

## Product idea

This app does **not** try to replace pitch-by-pitch速報 apps such as Sports Navi. It focuses on helping baseball fans understand:

- who is hot right now,
- recent 7 / 14 / 30 day and monthly performance,
- player profiles and career histories,
- season and career records,
- record milestones,
- comparisons,
- advanced MLB data,
- draft and prospects,
- FA / posting / trades / roster movement,
- preseason / spring performance and historical comparisons,
- personalized favorite teams and players,
- and useful notifications.

The target user is a normal baseball fan who wants more data without needing to already understand sabermetrics.

## Read first

1. `SPEC.md` — product specification and phased roadmap
2. `AGENTS.md` — development rules
3. `docs/decisions.md` — durable decisions and rationale

## Hard constraints

- Android smartphone app first.
- NPB + MLB.
- Additional monthly running cost: ¥0.
- Use only data sources whose usage is permitted for the intended use.
- AI is an enhancement, never a hard dependency.
- Build incrementally; do not attempt the full roadmap in one implementation pass.
- Repository hygiene is part of completion: safely remove obsolete task-related files after verifying they are unused.

## Development environment

Available tools/services:
- VS Code
- GitHub
- Vercel
- Android development toolchain
- Google AI Pro for development assistance
- Free-tier services may be used only when they preserve the ¥0 monthly-cost constraint.

The final technical architecture should be decided during the initial architecture task and recorded in `docs/decisions.md`.

## Suggested implementation direction

A web-first TypeScript UI wrapped with Capacitor is the preferred starting direction because it supports fast browser iteration and Android packaging, but the architecture task may choose a materially better zero-cost solution if it documents the reason before implementation.

Vercel may be used for free web previews or lightweight developer tooling if useful; it is not automatically required for production runtime.

## Git workflow

Start Git immediately. Keep `main` stable and implement larger work in small feature branches or reviewable commits.
