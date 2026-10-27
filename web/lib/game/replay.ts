import { createGame, MAX_FRAMES, step } from "./engine.ts";
export type ControlEvent = [number, number];
export function verifyReplay(seed: number, frames: unknown, controls: unknown) {
  if (!Number.isInteger(frames) || (frames as number) < 1 || (frames as number) > MAX_FRAMES) throw new Error("Invalid flight length.");
  if (!Array.isArray(controls) || controls.length > (frames as number) || controls.length > MAX_FRAMES) throw new Error("Invalid control recording.");
  let previous = -1;
  for (const event of controls) {
    if (!Array.isArray(event) || event.length !== 2 || !Number.isInteger(event[0]) || event[0] <= previous ||
      event[0] < 0 || event[0] >= (frames as number) || !Number.isInteger(event[1]) || event[1] < 0 || event[1] > 31) throw new Error("Invalid control recording.");
    previous = event[0];
  }
  const state = createGame(seed);
  let input = 0, at = 0;
  for (let frame = 0; frame < (frames as number); frame++) {
    if (controls[at]?.[0] === frame) input = controls[at++][1];
    if (state.ended) throw new Error("Recording continued after the flight ended.");
    step(state, input);
  }
  return state;
}
