import { ApiError, body, failure, json } from '@/lib/game/api';
import { snapshot } from '@/lib/arena/engine';
import { authorize, codeFrom, mutateRoom, ownPlayer } from '@/lib/arena/server';
export async function POST(request: Request) {
  try {
    const data = await body(request), room = codeFrom(data), auth = await authorize(request, data);
    if (!Number.isInteger(data.seq) || data.seq < 0 || data.seq > 1e9 || typeof data.angle !== 'number' || !Number.isFinite(data.angle) || Math.abs(data.angle) > Math.PI * 2 || ![-1, 0, 1].includes(data.turn) || typeof data.boost !== 'boolean') throw new ApiError('Invalid arena controls.');
    const world = await mutateRoom(room, (w, now) => {
      const p = ownPlayer(w, auth);
      if (p.alive && data.seq > p.seq) {
        if (now - p.lastSeen < 100) throw new ApiError('Please slow down arena updates.', 429);
        p.seq = data.seq; p.target = data.angle; p.turn = data.turn; p.boost = data.boost; p.lastSeen = now;
      }
      return snapshot(w, room, p.id);
    });
    return json({ world });
  } catch (error) { return failure(error); }
}
