import { ApiError, database, digest, getPilot } from '../game/api';
import { advanceWorld, type ArenaPlayer, type World } from './engine';
type Row = { id: string; state: string; version: number; updated_at: number };
export async function mutateRoom<T>(code: string, change: (world: World, now: number) => T) {
  const db = database();
  for (let attempt = 0; attempt < 6; attempt++) {
    const row = await db.prepare('SELECT * FROM arena_rooms WHERE id = ?').bind(code).first<Row>();
    if (!row) throw new ApiError('Room not found. Check the code or create a new room.', 404);
    const world: World = JSON.parse(row.state), now = Date.now();
    advanceWorld(world, now);
    const result = change(world, now);
    const updated = await db.prepare('UPDATE arena_rooms SET state = ?, version = ?, updated_at = ? WHERE id = ? AND version = ? RETURNING version')
      .bind(JSON.stringify(world), row.version + 1, now, code, row.version).first();
    if (!updated) continue;
    // Idempotent score inserts: dead players remain in room state for retry recovery.
    const ended = world.players.filter(p => !p.alive && !p.bot);
    if (ended.length) await db.batch(ended.map(p => db.prepare('INSERT OR IGNORE INTO arena_scores (id, pilot, name, score, kills, duration, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(p.id, p.pilot, p.name, Math.floor(p.energy), p.kills, Math.max(0, p.ended - p.joined), p.ended)));
    return result;
  }
  throw new ApiError('The room is busy. Reconnecting…', 409);
}
export function codeFrom(data: Record<string, unknown>) {
  if (typeof data.room !== 'string' || !/^[A-Z0-9]{6}$/.test(data.room)) throw new ApiError('Enter a valid six-character room code.');
  return data.room;
}
export async function authorize(request: Request, data: Record<string, unknown>) {
  if (typeof data.id !== 'string' || typeof data.token !== 'string' || data.id.length !== 36 || data.token.length !== 36) throw new ApiError('Arena credentials are missing.', 401);
  const pilot = getPilot(request);
  if (!pilot) throw new ApiError('Your pilot cookie is missing. Rejoin the room.', 401);
  return { id: data.id, pilot, hash: await digest(data.token) };
}
export function ownPlayer(world: World, auth: { id: string; pilot: string; hash: string }): ArenaPlayer {
  const p = world.players.find(p => p.id === auth.id && p.pilot === auth.pilot && p.tokenHash === auth.hash);
  if (!p) throw new ApiError('This arena session has ended. Join again.', 410);
  return p;
}
