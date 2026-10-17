import { addDatabaseChangeListener, useSQLiteContext, type SQLiteBindValue } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeTablesChanged } from './changes';

/**
 * Runs a query and re-runs it whenever any of `tables` changes.
 *
 * Re-runs on post-commit notifications from writeTransaction() (the reliable
 * signal for the app's own writes) and on expo-sqlite's native change events
 * (other writers). The latest-started query wins, so a stale read triggered by
 * a pre-commit native event can never overwrite a fresher one.
 */
export function useLiveQuery<T>(sql: string, params: SQLiteBindValue[], tables: string[]) {
  return useLiveQueryState<T>(sql, params, tables).rows;
}

/** useLiveQuery plus the last query error (cleared by the next successful run) and a manual retry. */
export function useLiveQueryState<T>(sql: string, params: SQLiteBindValue[], tables: string[]) {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<T[] | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const key = JSON.stringify(params);
  const tablesKey = tables.join(',');
  const generation = useRef(0);

  const run = useCallback(() => {
    const gen = ++generation.current;
    return db.getAllAsync<T>(sql, JSON.parse(key) as SQLiteBindValue[]).then(
      (result) => {
        if (gen !== generation.current) return;
        setRows(result);
        setError(null);
      },
      (e: unknown) => {
        if (gen === generation.current) setError(e instanceof Error ? e : new Error(String(e)));
      },
    );
  }, [db, sql, key]);

  useEffect(() => {
    void run();
    const watched = new Set(tablesKey.split(','));
    const native = addDatabaseChangeListener((e) => {
      if (watched.has(e.tableName)) void run();
    });
    const unsubscribe = subscribeTablesChanged((changed) => {
      for (const t of changed) {
        if (watched.has(t)) {
          void run();
          return;
        }
      }
    });
    return () => {
      native.remove();
      unsubscribe();
    };
  }, [run, tablesKey]);

  return { rows, error, retry: run };
}
