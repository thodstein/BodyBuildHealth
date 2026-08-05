/** Общие ограничения параметров ББ-плана. */
export function clampRir(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}
