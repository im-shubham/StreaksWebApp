# Local Database Architecture

Engine: `expo-sqlite` (SDK 57), file `streaks.db`. It is opened by `SQLiteProvider` in `src/app/_layout.tsx` with `enableChangeListener: true`.

## Layers

```
src/domain/       Pure TypeScript: dates, cadence rules, streak engine, plans. Unit tested; no I/O.
src/db/           Schema + migrations, repositories (all writes), live queries, sync outbox.
src/features/     View models (useHabitBoard) and screens. Reads go through useLiveQuery.
```

- **Writes** go only through repository functions (`src/db/repositories/*`). Each write is one exclusive transaction that updates the row **and** enqueues its sync operation in `sync_outbox`.
- **Reads** use `useLiveQuery(sql, params, tables)`. It re-runs when SQLite reports a change to any listed table, so every screen updates on its own after a write, whichever screen made it.
- **Derived data is never stored.** Streaks, best streak, consistency and week status are computed from check-ins, freezes and vacations by `src/domain/streak.ts`. This keeps sync conflicts limited to raw facts.

## Tables

| Table | Purpose | Key |
|---|---|---|
| `habits` | Habit definitions, cadence, reminder, status (`active` / `paused` / `archived`), dashboard pin | UUID |
| `completions` | One check-in per habit per local day | `habitId_YYYY-MM-DD` |
| `freeze_events` | Streak freeze used on a day (`auto` / `manual` / `repair`) | `habitId_YYYY-MM-DD` |
| `vacations` | Planned buffers that shield a date range for all or some habits | UUID |
| `milestones` | Milestone tiers reached (7 / 21 / 30 / 100) | per habit and threshold |
| `profile` | Single row `'me'`: account link, tier, freeze wallet, theme, haptics | `'me'` |
| `sync_outbox` | Pending pushes; one coalesced entry per record | `(entity, entity_id)` |
| `sync_state` | Pull cursors per collection | entity |

Conventions: epoch-ms `created_at` / `updated_at`, `deleted_at` tombstones (never hard-delete before the tombstone has synced), calendar days stored as `YYYY-MM-DD` in the device's local time, weekdays numbered Monday = 0.

## Streak rules (`src/domain/streak.ts`)

| Day status | Effect on the streak | Design source |
|---|---|---|
| completed | +1 | Hold-to-complete |
| frozen | +1 | Streak Freeze & Repair ("24d → 25d Safeguarded") |
| shielded (vacation) | keeps the chain, +0 | Dashboard (Active Vacation Mode): "Momentum frozen at 18 days" |
| rest (not scheduled) | keeps the chain, +0 | Weekly Rhythm "Rest" |
| pending (today) | keeps the chain | "Awaiting Execution" |
| missed | breaks the chain | "Streak Resets to Zero" |

## Migrations

`MIGRATIONS` in `src/db/migrations.ts` is append-only and tracked with `PRAGMA user_version`. Each migration runs in its own exclusive transaction. Never edit a migration that has shipped.
