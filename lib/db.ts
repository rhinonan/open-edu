import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA_SQL } from './schema';
import { resetData, seedIfEmpty } from './seed';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    const dir = join(process.cwd(), 'data');
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(join(dir, 'app.db'));
    db.exec('PRAGMA journal_mode = WAL;');
    // 此检查必须在执行 SCHEMA_SQL 之前：旧版 students 表没有 idcard 列，
    // SCHEMA_SQL 里的 CREATE UNIQUE INDEX ... ON students(idcard) 会抛
    // “no such column: idcard”，导致下面的重置永远轮不到执行。
    // 以 idcard 作为哨兵列：列不存在即判定为旧库，先重置再重建。
    const studentCols = (db.prepare('PRAGMA table_info(students)').all() as { name: string }[]).map(c => c.name);
    if (studentCols.length > 0 && !studentCols.includes('idcard')) resetData(db);
    db.exec(SCHEMA_SQL);
    seedIfEmpty(db);
  }
  return db;
}
