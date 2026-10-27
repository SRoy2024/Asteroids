import { env } from "cloudflare:workers";
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function database() {
  if (!env.DB) throw new ApiError("The leaderboard is temporarily unavailable. Please try again.", 503);
  return env.DB;
}
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
export function failure(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  console.error("Arcade API failure", error instanceof Error ? error.message : "unknown");
  return json({ error: "The leaderboard could not be reached. Please try again." }, 503);
}
export function getPilot(request: Request) {
  return request.headers.get("cookie")?.match(/(?:^|;\s*)orbital-pilot=([a-f0-9-]{36})(?:;|$)/)?.[1] ?? null;
}
export async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("");
}
export async function body(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError("Cross-site request rejected.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError("Expected JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Missing request body.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > 150_000) { await reader.cancel(); throw new ApiError("Recording is too large.", 413); }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new ApiError("Invalid JSON."); }
}

// HTTPS portal embeds need a partitioned cookie. Origin checks and per-run
// secret tokens still protect every mutation; no cross-origin API is exposed.
export function pilotCookie(request: Request, pilot: string) {
  const policy = new URL(request.url).protocol === "https:"
    ? "SameSite=None; Secure; Partitioned" : "SameSite=Lax";
  return `orbital-pilot=${pilot}; HttpOnly; ${policy}; Path=/; Max-Age=31536000`;
}
