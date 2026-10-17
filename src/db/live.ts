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
  const db = useSQLiteContext();
  const [rows, setRows] = useState<T[] | undefined>(undefined);
  const key = JSON.stringify(params);
  const tablesKey = tables.join(',');
  const generation = useRef(0);

  const run = useCallback(async () => {
    const gen = ++generation.current;
    const result = await db.getAllAsync<T>(sql, JSON.parse(key) as SQLiteBindValue[]);
    if (gen === generation.current) setRows(result);
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

  return rows;
}
