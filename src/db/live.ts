import { addDatabaseChangeListener, useSQLiteContext, type SQLiteBindValue } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs a query and re-runs it whenever any of `tables` changes.
 * Requires the database to be opened with `enableChangeListener: true`.
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
    const sub = addDatabaseChangeListener((e) => {
      if (watched.has(e.tableName)) void run();
    });
    return () => sub.remove();
  }, [run, tablesKey]);

  return rows;
}
