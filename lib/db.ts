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
    const studentCols = (db.prepare('PRAGMA table_info(students)').all() as { name: string }[]).map(c => c.name);
    if (studentCols.length > 0 && !studentCols.includes('idcard')) resetData(db);
    db.exec(SCHEMA_SQL);
    seedIfEmpty(db);
  }
  return db;
}
