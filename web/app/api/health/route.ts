import { database, json } from '@/lib/game/api';
export const dynamic = 'force-dynamic';

// Public readiness check: never returns player data, credentials, or raw errors.
export async function GET() {
  try {
    const { results } = await database().prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('runs', 'arena_rooms', 'arena_scores')"
    ).all<{ name: string }>();
    if (results.length !== 3) return json({ status: 'unavailable', service: 'Asteroids — Neon Sector', database: 'not_ready' }, 503);
    return json({ status: 'ok', service: 'Asteroids — Neon Sector', database: 'ready' });
  } catch {
    return json({ status: 'unavailable', service: 'Asteroids — Neon Sector', database: 'not_ready' }, 503);
  }
}
