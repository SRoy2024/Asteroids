import { ApiError, body, database, digest, failure, getPilot, json, pilotCookie } from "@/lib/game/api";
export async function POST(request: Request) {
  try {
    const data = await body(request);
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!/^[\p{L}\p{N} _.-]{2,18}$/u.test(name)) throw new ApiError("Use 2–18 letters, numbers, spaces, dots, dashes, or underscores.");
    const db = database(), pilot = getPilot(request) ?? crypto.randomUUID(), now = Date.now();
    const ip = request.headers.get("cf-connecting-ip");
    const ipHash = await digest(`${Math.floor(now / 86400000)}:${ip ?? pilot}`);
    const recent = await db.prepare("SELECT count(*) AS count FROM runs WHERE created_at > ? AND (pilot = ? OR ip_hash = ?)")
      .bind(now - 3600000, pilot, ipHash).first<{ count: number }>();
    if ((recent?.count ?? 0) >= 60) throw new ApiError("Flight limit reached. Try again in an hour.", 429);
    await db.prepare("DELETE FROM runs WHERE finished_at IS NULL AND created_at < ?").bind(now - 3600000).run();
    const id = crypto.randomUUID(), token = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0];
    await db.prepare("INSERT INTO runs (id, pilot, token_hash, name, seed, created_at, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, pilot, await digest(token), name, seed, now, ipHash).run();
    return json({ id, token, seed }, 201, { "Set-Cookie": pilotCookie(request, pilot) });
  } catch (error) { return failure(error); }
}
