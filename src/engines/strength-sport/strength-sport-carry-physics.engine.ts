/**
 * strength-sport-carry-physics.engine.ts — физика переноски (Legg et al. 2019)
 * speed = stride0 1.83 × cadence - k×load/BW, k 0.015 yoke, 0.010 farmers
 * Используется для динамической дистанции/тайминга vs EVENT_META.default
 */

export interface CarryPhysicsInput { loadKg: number; bodyweightKg: number; type: 'yoke'|'farmers'|'frame'|'husafell'|'sandbag'|'other'; distanceM?: number; }
export interface CarryPhysicsResult { speedMs: number; timeS: number; strideM: number; cadenceHz: number; feasible: boolean; note: string; }

const K_BY_TYPE: Record<string, number> = { yoke: 0.015, farmers: 0.010, frame: 0.012, husafell: 0.013, sandbag: 0.011, other: 0.012 };

export function carryPhysics(input: CarryPhysicsInput): CarryPhysicsResult | null {
  if (!input || !Number.isFinite(input.loadKg) || !Number.isFinite(input.bodyweightKg) || input.bodyweightKg <= 0) return null;
  const k = K_BY_TYPE[input.type] ?? 0.012;
  const baseStride = 1.83; // Hindle stride0
  const baseCadence = 1.6; // Hz при лёгком
  const loadRatio = input.loadKg / input.bodyweightKg;
  const stride = Math.max(0.6, baseStride * (1 - 0.32 * Math.min(2, loadRatio))); // -0.32 как в Legg
  const cadence = Math.min(2.2, baseCadence * (1 + 0.37 * Math.min(1.5, loadRatio * 0.6)));
  let speed = stride * cadence - k * input.loadKg / input.bodyweightKg * 2;
  if (!Number.isFinite(speed) || speed < 0.3) speed = 0.5;
  speed = Math.round(speed*100)/100;
  const dist = input.distanceM ?? 20;
  const timeS = Math.round(dist / speed *10)/10;
  const feasible = timeS < (input.type === 'yoke' ? 60 : 75);
  const note = `stride ${stride.toFixed(2)}м cad ${cadence.toFixed(2)}Hz speed ${speed}м/с → ${dist}м за ${timeS}с ${feasible ? '✅' : '⚠️ >cap'}`;
  return { speedMs: speed, timeS, strideM: Math.round(stride*100)/100, cadenceHz: Math.round(cadence*100)/100, feasible, note };
}

export function dynamicCarryDistance(loadKg: number, bodyweightKg: number, type: 'yoke'|'farmers'|'frame'|'husafell'|'sandbag'|'other', timeCapS: number): number {
  const phy = carryPhysics({ loadKg, bodyweightKg, type });
  if (!phy) return 20;
  const dist = Math.round(phy.speedMs * timeCapS * 0.9); // 90% cap для запаса
  return Math.max(10, Math.min(50, dist));
}
