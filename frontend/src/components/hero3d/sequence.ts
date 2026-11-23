/** Pure, reversible scroll choreography. No elapsed time enters this timeline. */
export const clamp = (value: number) => Math.min(1, Math.max(0, value));
export const smooth = (a: number, b: number, p: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const PARKED_X = 4.4;
export const VEHICLE_SCALE = 1.25;
export function vehicleX(p: number) {
  if (p < 0.45) {
    const t = clamp((p - 0.04) / 0.41);
    // Quintic ease has continuous velocity/acceleration at both ends.
    const travel = t * t * t * (t * (6 * t - 15) + 10);
    return 28 - (28 - PARKED_X) * travel;
  }
  if (p < 0.65) return PARKED_X;
  const t = clamp((p - 0.65) / 0.25);
  return PARKED_X - 38 * t * t * t;
}
export const logoVisibility = (p: number) => smooth(0.32, 0.46, p) * (1 - smooth(0.67, 0.79, p));
export const CHAPTERS = ["The city", "The arrival", "Your next drive", "The open road", "Discover"];
export function chapter(p: number) {
  return p < 0.2 ? 0 : p < 0.45 ? 1 : p < 0.65 ? 2 : p < 0.9 ? 3 : 4;
}
