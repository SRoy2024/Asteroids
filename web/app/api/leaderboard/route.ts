import { database, failure, getPilot, json } from "@/lib/game/api";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const db = database(), pilot = getPilot(request), period = new URL(request.url).searchParams.get("period");
    const since = period === "week" ? Date.now() - 7 * 86400000 : 0;
    const { results } = await db.prepare(`WITH best AS (
      SELECT name, score, frames, finished_at, pilot,
        ROW_NUMBER() OVER (PARTITION BY pilot ORDER BY score DESC, frames ASC, finished_at ASC, id ASC) AS choice
      FROM runs WHERE finished_at IS NOT NULL AND finished_at >= ? AND score > 0
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC, frames ASC, finished_at ASC, pilot ASC) AS rank FROM best WHERE choice = 1
    ) SELECT name, score, frames, rank, CASE WHEN pilot = ? THEN 1 ELSE 0 END AS isYou
      FROM ranked WHERE rank <= 20 OR pilot = ? ORDER BY rank`).bind(since, pilot ?? "", pilot ?? "").all();
    const stats = await db.prepare("SELECT count(*) AS flights, count(DISTINCT pilot) AS pilots, COALESCE(MAX(score), 0) AS record FROM runs WHERE finished_at IS NOT NULL AND finished_at >= ?").bind(since).first();
    const personal = pilot ? await db.prepare("SELECT COALESCE(MAX(score), 0) AS best, count(*) AS flights FROM runs WHERE pilot = ? AND finished_at IS NOT NULL").bind(pilot).first() : { best: 0, flights: 0 };
    return json({ entries: results, stats, personal, updatedAt: Date.now() });
  } catch (error) { return failure(error); }
}
