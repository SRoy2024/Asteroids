import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../drizzle/0000_equal_iceman.sql', import.meta.url), 'utf8'));
// Minimal D1 adapter: production SQL executes against a real SQLite database.
export const env = { DB: { prepare(sql) {
  const statement = sqlite.prepare(sql);
  const bound = (params = []) => ({
    bind(...values) { return bound(values); },
    async first() { return statement.get(...params) ?? null; },
    async all() { return { results: statement.all(...params), success: true }; },
    async run() { const result = statement.run(...params); return { meta: { changes: result.changes }, success: true }; },
  });
  return bound();
} } };
export { sqlite };
