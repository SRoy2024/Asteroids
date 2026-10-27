import { ApiError, body, database, digest, failure, getPilot, json } from "@/lib/game/api";
import { verifyReplay } from "@/lib/game/replay";
type Run = { id: string; pilot: string; token_hash: string; seed: number; created_at: number;
  finished_at: number | null; score: number | null; frames: number | null; hits: number | null };
export async function POST(request: Request) {
  try {
    const data = await body(request), pilot = getPilot(request);
    if (!pilot || typeof data.id !== "string" || typeof data.token !== "string" || data.id.length > 40 || data.token.length > 40)
      throw new ApiError("Flight credentials are missing. Start a new flight.", 401);
    const db = database();
    const run = await db.prepare("SELECT * FROM runs WHERE id = ? AND pilot = ?").bind(data.id, pilot).first<Run>();
    if (!run || run.token_hash !== await digest(data.token)) throw new ApiError("Flight credentials are invalid.", 403);
    if (run.finished_at !== null) return json({ score: run.score, frames: run.frames, hits: run.hits, saved: true });
    const elapsed = Date.now() - run.created_at;
    if (elapsed > 3600000) throw new ApiError("This flight has expired. Start a new one.", 410);
    if (typeof data.frames !== "number" || data.frames / 60 * 1000 > elapsed + 3000) throw new ApiError("Flight recording is ahead of real time.");
    let state;
    try { state = verifyReplay(run.seed, data.frames, data.controls); }
    catch (error) { throw new ApiError(error instanceof Error ? error.message : "Invalid recording."); }
    const saved = await db.prepare("UPDATE runs SET score = ?, frames = ?, hits = ?, finished_at = ? WHERE id = ? AND finished_at IS NULL RETURNING score, frames, hits")
      .bind(state.score, state.frame, state.hits, Date.now(), run.id).first();
    if (!saved) return json({ ...await db.prepare("SELECT score, frames, hits FROM runs WHERE id = ?").bind(run.id).first(), saved: true });
    return json({ ...saved, saved: true });
  } catch (error) { return failure(error); }
}
