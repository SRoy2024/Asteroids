import { database, failure, getPilot, json } from '@/lib/game/api';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const pilot = getPilot(request) ?? '', since = new URL(request.url).searchParams.get('period') === 'week' ? Date.now() - 7 * 86400000 : 0;
    const { results } = await database().prepare(`WITH best AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY pilot ORDER BY score DESC, kills DESC, ended_at ASC, id ASC) AS choice
      FROM arena_scores WHERE ended_at >= ? AND score > 0
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC, kills DESC, ended_at ASC, id ASC) AS rank FROM best WHERE choice = 1
    ) SELECT name, score, kills, rank, CASE WHEN pilot = ? THEN 1 ELSE 0 END AS isYou FROM ranked WHERE rank <= 20 OR pilot = ? ORDER BY rank`).bind(since, pilot, pilot).all();
    return json({ entries: results });
  } catch (error) { return failure(error); }
}
