import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
const sqlite = new DatabaseSync(':memory:');
for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
// Minimal D1 adapter: production SQL executes against a real SQLite database.
export const env = { DB: { async batch(statements) { return Promise.all(statements.map(s => s.run())); }, prepare(sql) {
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
