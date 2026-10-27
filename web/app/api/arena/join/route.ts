import { ApiError, body, database, digest, failure, getPilot, json, pilotCookie } from '@/lib/game/api';
import { addPlayer, makeWorld, ROOM_LIMIT, snapshot, type World } from '@/lib/arena/engine';
import { mutateRoom } from '@/lib/arena/server';
export async function POST(request: Request) {
  try {
    const data = await body(request), now = Date.now();
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!/^[\p{L}\p{N} _.-]{2,18}$/u.test(name)) throw new ApiError('Choose a callsign with 2–18 letters or numbers.');
    if (!Number.isInteger(data.color) || data.color < 0 || data.color > 5) throw new ApiError('Choose a valid ship color.');
    let code = typeof data.room === 'string' ? data.room.trim().toUpperCase() : '';
    if (code && !/^[A-Z0-9]{6}$/.test(code)) throw new ApiError('Room codes contain six letters or numbers.');
    const db = database(), pilot = getPilot(request) ?? crypto.randomUUID();
    if (!code && !data.newRoom) {
      const { results } = await db.prepare('SELECT id, state FROM arena_rooms WHERE updated_at > ? ORDER BY updated_at DESC LIMIT 12').bind(now - 10000).all<{ id: string; state: string }>();
      code = results.find(row => {
        const w: World = JSON.parse(row.state);
        return w.players.filter(p => p.alive && now - p.lastSeen < 10000).length < ROOM_LIMIT;
      })?.id ?? '';
    }
    if (!code) {
      const count = await db.prepare('SELECT count(*) AS total FROM arena_rooms WHERE updated_at > ?').bind(now - 120000).first<{ total: number }>();
      if ((count?.total ?? 0) >= 30) throw new ApiError('The arena is full right now. Please try again shortly.', 429);
      await db.prepare('DELETE FROM arena_rooms WHERE updated_at < ?').bind(now - 86400000).run();
      for (let n = 0; n < 5; n++) {
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        code = Array.from(bytes, b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
        const w = makeWorld(crypto.getRandomValues(new Uint32Array(1))[0], now);
        const inserted = await db.prepare('INSERT OR IGNORE INTO arena_rooms (id, state, version, updated_at) VALUES (?, ?, 0, ?) RETURNING id').bind(code, JSON.stringify(w), now).first();
        if (inserted) break;
        code = '';
      }
      if (!code) throw new ApiError('Could not create a room. Please try again.', 503);
    }
    const id = crypto.randomUUID(), token = crypto.randomUUID(), tokenHash = await digest(token);
    const world = await mutateRoom(code, (w, current) => {
      if (w.players.filter(p => p.alive).length >= ROOM_LIMIT) throw new ApiError('This room is full. Create another room.', 409);
      if (w.players.filter(p => p.alive && p.pilot === pilot).length >= 2) throw new ApiError('You already have two active pilots in this room. Leave one or wait ten seconds.', 429);
      addPlayer(w, { id, pilot, tokenHash, name, color: data.color }, current);
      return snapshot(w, code, id);
    });
    return json({ id, token, room: code, world }, 201, { 'Set-Cookie': pilotCookie(request, pilot) });
  } catch (error) { return failure(error); }
}
