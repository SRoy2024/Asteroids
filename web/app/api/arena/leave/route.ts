import { body, failure, json } from '@/lib/game/api';
import { eliminate } from '@/lib/arena/engine';
import { authorize, codeFrom, mutateRoom, ownPlayer } from '@/lib/arena/server';
export async function POST(request: Request) {
  try {
    const data = await body(request), room = codeFrom(data), auth = await authorize(request, data);
    await mutateRoom(room, (w, now) => { const p = ownPlayer(w, auth); eliminate(w, p, 'You left the arena.', now); });
    return json({ left: true });
  } catch (error) { return failure(error); }
}
