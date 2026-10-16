import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Local SQLite schema. SQLite on device is the source of truth for the UI.
 * Firestore is a sync replica (see docs/architecture/firebase-plan.md).
 *
 * Conventions:
 * - ids are client-generated UUIDs so records can be created offline.
 * - `updated_at` (epoch ms) drives last-write-wins conflict resolution.
 * - `deleted_at` is a tombstone so deletions can sync; rows are never
 *   hard-deleted until the tombstone has been pushed.
 * - calendar days are 'YYYY-MM-DD' local dates (see src/domain/dates.ts).
 *
 * Migrations are append-only. Never edit a shipped migration; add a new one.
 */
const MIGRATIONS: string[] = [
  // v1: initial schema
  `
  CREATE TABLE habits (
    id               TEXT PRIMARY KEY NOT NULL,
    name             TEXT NOT NULL,
    category         TEXT NOT NULL,
    emblem           TEXT NOT NULL,
    cadence_type     TEXT NOT NULL CHECK (cadence_type IN ('daily','specific_days','interval')),
    weekdays_mask    INTEGER NOT NULL DEFAULT 127,
    interval_days    INTEGER NOT NULL DEFAULT 1,
    start_date       TEXT NOT NULL,
    weekly_target    INTEGER,
    target_label     TEXT,
    execution_time   TEXT,
    reminder_enabled INTEGER NOT NULL DEFAULT 0,
    reminder_time    TEXT,
    notes            TEXT,
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
    is_primary       INTEGER NOT NULL DEFAULT 0,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    template_id      TEXT,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    archived_at      INTEGER,
    deleted_at       INTEGER
  );
  CREATE INDEX habits_status_idx ON habits (status, sort_order) WHERE deleted_at IS NULL;

  -- id is deterministic: '<habit_id>_<local_date>' (see completionId()).
  CREATE TABLE completions (
    id           TEXT PRIMARY KEY NOT NULL,
    habit_id     TEXT NOT NULL REFERENCES habits (id),
    local_date   TEXT NOT NULL,
    completed_at INTEGER NOT NULL,
    source       TEXT NOT NULL,
    value        REAL,
    note         TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    deleted_at   INTEGER
  );
  -- One live check-in per habit per day; undone check-ins keep a tombstone.
  CREATE UNIQUE INDEX completions_habit_day_uq ON completions (habit_id, local_date) WHERE deleted_at IS NULL;
  CREATE INDEX completions_date_idx ON completions (local_date);

  -- id is deterministic: '<habit_id>_<local_date>', like completions.
  CREATE TABLE freeze_events (
    id          TEXT PRIMARY KEY NOT NULL,
    habit_id    TEXT NOT NULL REFERENCES habits (id),
    local_date  TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('auto','manual','repair')),
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
  );
  CREATE UNIQUE INDEX freeze_habit_day_uq ON freeze_events (habit_id, local_date) WHERE deleted_at IS NULL;

  CREATE TABLE vacations (
    id             TEXT PRIMARY KEY NOT NULL,
    start_date     TEXT NOT NULL,
    end_date       TEXT NOT NULL,
    habit_ids      TEXT,            -- JSON array, NULL = all habits
    ended_early_on TEXT,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    deleted_at     INTEGER
  );

  CREATE TABLE milestones (
    id          TEXT PRIMARY KEY NOT NULL,
    habit_id    TEXT NOT NULL REFERENCES habits (id),
    threshold   INTEGER NOT NULL,
    achieved_on TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
  );
  CREATE UNIQUE INDEX milestones_habit_threshold_uq ON milestones (habit_id, threshold) WHERE deleted_at IS NULL;

  -- Single row ('me'): profile, plan and preferences for this device's account.
  CREATE TABLE profile (
    id                 TEXT PRIMARY KEY NOT NULL DEFAULT 'me',
    account_uid        TEXT,          -- Firebase uid once signed in; NULL for guests
    display_name       TEXT,
    email              TEXT,
    avatar_url         TEXT,
    tier               TEXT NOT NULL DEFAULT 'guest' CHECK (tier IN ('guest','free','pro')),
    freeze_balance     INTEGER NOT NULL DEFAULT 1,
    freeze_refilled_on TEXT,
    auto_freeze        INTEGER NOT NULL DEFAULT 1,
    accent             TEXT NOT NULL DEFAULT 'lime',
    surface_mode       TEXT NOT NULL DEFAULT 'charcoal',
    app_icon           TEXT NOT NULL DEFAULT 'default',
    haptics            INTEGER NOT NULL DEFAULT 1,
    onboarded_at       INTEGER,
    updated_at         INTEGER NOT NULL
  );

  -- Transactional outbox: every local write enqueues its sync operation in
  -- the same transaction. Drained FIFO by the sync engine.
  CREATE TABLE sync_outbox (
    seq             INTEGER PRIMARY KEY AUTOINCREMENT,
    entity          TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    op              TEXT NOT NULL CHECK (op IN ('upsert','delete')),
    payload         TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    last_attempt_at INTEGER
  );
  CREATE UNIQUE INDEX sync_outbox_entity_uq ON sync_outbox (entity, entity_id);

  -- Pull cursors per collection.
  CREATE TABLE sync_state (
    entity         TEXT PRIMARY KEY NOT NULL,
    last_pulled_at INTEGER NOT NULL DEFAULT 0
  );
  `,
];

export const DATABASE_NAME = 'streaks.db';
export const DATABASE_VERSION = MIGRATIONS.length;

/** SQLiteProvider onInit: applies pending migrations using PRAGMA user_version. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  while (version < DATABASE_VERSION) {
    const sql = MIGRATIONS[version];
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(sql);
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }

  await db.runAsync(`INSERT OR IGNORE INTO profile (id, updated_at) VALUES ('me', ?)`, Date.now());
}
