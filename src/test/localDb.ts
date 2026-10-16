import type { SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from '@/db/migrations';
import type { LocalDb, RemoteCollection, RemoteStore } from '@/sync/types';

/** Test helpers: real SQLite (node:sqlite) with the app's migrations, and a fake remote. */
export type Row = Record<string, string | number | null>;

export function openDb(): LocalDb & SQLiteDatabase {
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
  const d = new DatabaseSync(':memory:');
  d.exec('PRAGMA foreign_keys = ON;');
  for (const m of MIGRATIONS) d.exec(m);
  d.prepare(`INSERT INTO profile (id, updated_at) VALUES ('me', ?)`).run(Date.now());
  const norm = (p: unknown[]) => p.map((v) => (typeof v === 'boolean' ? Number(v) : v)) as (string | number | null)[];
  const self = {
    async getAllAsync<T>(sql: string, ...p: unknown[]) {
      return d.prepare(sql).all(...norm(p)) as T[];
    },
    async getFirstAsync<T>(sql: string, ...p: unknown[]) {
      return (d.prepare(sql).get(...norm(p)) as T | undefined) ?? null;
    },
    async runAsync(sql: string, ...p: unknown[]) {
      const r = d.prepare(sql).run(...norm(p));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async withExclusiveTransactionAsync(fn: (txn: unknown) => Promise<void>) {
      d.exec('BEGIN EXCLUSIVE');
      try {
        await fn(self);
        d.exec('COMMIT');
      } catch (e) {
        d.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return self as unknown as LocalDb & SQLiteDatabase;
}

/** In-memory Firestore stand-in: users/{uid}/{collection}/{id}, set(merge) + server timestamps. */
export class FakeRemote implements RemoteStore {
  docs = new Map<string, { data: Record<string, unknown>; serverUpdatedAt: number }>();
  clock = 1000;
  failNext: Error | null = null;
  onPush: (() => Promise<void>) | null = null;

  async push(uid: string, ops: { collection: RemoteCollection; id: string; data: Record<string, unknown> }[]) {
    if (this.onPush) await this.onPush();
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = null;
      throw e;
    }
    const ts = ++this.clock;
    for (const op of ops) {
      const key = `${uid}/${op.collection}/${op.id}`;
      const prev = this.docs.get(key)?.data ?? {};
      this.docs.set(key, { data: { ...prev, ...op.data }, serverUpdatedAt: ts });
    }
  }

  async pull(uid: string, collection: RemoteCollection, sinceMs: number) {
    const prefix = `${uid}/${collection}/`;
    return [...this.docs.entries()]
      .filter(([k, v]) => k.startsWith(prefix) && v.serverUpdatedAt > sinceMs)
      .sort((a, b) => a[1].serverUpdatedAt - b[1].serverUpdatedAt)
      .map(([k, v]) => ({ id: k.slice(prefix.length), data: v.data, serverUpdatedAt: v.serverUpdatedAt }));
  }

  get(uid: string, collection: RemoteCollection, id: string) {
    return this.docs.get(`${uid}/${collection}/${id}`)?.data;
  }
}

