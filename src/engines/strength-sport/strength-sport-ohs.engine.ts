/**
 * strength-sport-ohs.engine.ts — OHS MOBILITY PRO (6-сегментный скрининг)
 *
 * Наследует идеологию FMS 0-3 + NASM OSA + Rabin 2017 + PoinT GO 2024.
 * 6 сегментов: ankle/heels, knees, hips depth, trunk angle, arms, lumbar.
 * Norms: ankle 35-38° dorsiflexion, knee-to-wall ≥12см, hip 120°/35°IR, thoracic 40-45°, shoulder 180°.
 * Heel-raise re-test 2.5см дифференцирует ankle vs thoracic.
 */

export type OHSSegment = 'ankle' | 'knee' | 'hip' | 'trunk' | 'arm' | 'lumbar';
export interface OHSSegmentResult { segment: OHSSegment; pass: boolean; fault?: string; driver?: string; }

export interface OHSInput {
  heelsFlat: boolean;
  kneeValgus: boolean;
  hipBelowParallel: boolean;
  trunkUpright: boolean; // торс параллельно голеням или вертикальнее
  armsOverMidfoot: boolean;
  lumbarNeutral: boolean;
  kneeToWallCm?: number | null; // опционально точный замер
  ankleDorsiflexDeg?: number | null;
  shoulderFlexionDeg?: number | null;
  heelRaiseRetest?: boolean | null; // true = с подкладкой стало лучше
}

export interface OHSResult {
  totalScore: number; // 0-6
  passed: number;
  failed: number;
  level: 'ok' | 'warn' | 'critical';
  segments: OHSSegmentResult[];
  primaryDriver: string | null;
  recommendation: string;
  needsPhysio: boolean;
}

const SEGMENT_LABELS: Record<OHSSegment, string> = {
  ankle: 'Голеностоп (пятки)',
  knee: 'Колени',
  hip: 'Таз/глубина',
  trunk: 'Корпус',
  arm: 'Руки',
  lumbar: 'Поясница',
};

export function assessOHS(input: OHSInput): OHSResult {
  const segments: OHSSegmentResult[] = [
    { segment: 'ankle', pass: input.heelsFlat, fault: input.heelsFlat ? undefined : 'Пятки отрываются', driver: 'ankle dorsiflexion <35°' },
    { segment: 'knee', pass: !input.kneeValgus, fault: input.kneeValgus ? 'Вальгус коленей' : undefined, driver: 'hip abductor weakness / ankle pronation' },
    { segment: 'hip', pass: input.hipBelowParallel, fault: input.hipBelowParallel ? undefined : 'Недостаточная глубина', driver: 'hip capsule / hamstring' },
    { segment: 'trunk', pass: input.trunkUpright, fault: input.trunkUpright ? undefined : 'Чрезмерный наклон вперед', driver: 'ankle + thoracic kyphosis' },
    { segment: 'arm', pass: input.armsOverMidfoot, fault: input.armsOverMidfoot ? undefined : 'Руки падают вперед', driver: 'lat tightness / thoracic extension' },
    { segment: 'lumbar', pass: input.lumbarNeutral, fault: input.lumbarNeutral ? undefined : 'Потеря нейтрали', driver: 'hip flexor shortness / core' },
  ];
  const passed = segments.filter(s => s.pass).length;
  const failed = 6 - passed;
  const totalScore = passed;
  let level: OHSResult['level'] = 'ok';
  if (failed >= 3) level = 'critical';
  else if (failed >= 1) level = 'warn';

  // Knee-to-wall норма ≥12см (PoinT GO) / ≥9см Rabin cutoff
  // Анкл норма 35-38°
  let ankleNote = '';
  if (input.kneeToWallCm != null) {
    if (input.kneeToWallCm < 9) ankleNote = `Knee-to-wall ${input.kneeToWallCm}см <9 — выраженный дефицит`;
    else if (input.kneeToWallCm < 12) ankleNote = `Knee-to-wall ${input.kneeToWallCm}см 9-12 — погранично`;
    else ankleNote = `Knee-to-wall ${input.kneeToWallCm}см ≥12 — норма`;
  } else if (input.ankleDorsiflexDeg != null) {
    if (input.ankleDorsiflexDeg < 35) ankleNote = `Ankle ${input.ankleDorsiflexDeg}° <35° — дефицит`;
    else ankleNote = `Ankle ${input.ankleDorsiflexDeg}° — норма`;
  }

  // Driver: heel-raise re-test — самый быстрый дифференциал
  let primaryDriver: string | null = null;
  let recommendation = '';
  if (input.heelRaiseRetest === true) primaryDriver = 'Голеностоп (ретест с подкладкой улучшил)';
  else if (input.heelRaiseRetest === false) primaryDriver = 'Выше голеностопа (таз/грудной)';
  else if (!input.heelsFlat) primaryDriver = 'Голеностоп — проверить heel-raise retest 2.5см';
  else if (!input.armsOverMidfoot) primaryDriver = 'Грудной отдел / широчайшие';
  else if (input.kneeValgus) primaryDriver = 'Ягодичные / отводящие';

  if (level === 'critical') recommendation = 'Не нагружать оверхед до коррекции; 8-10мин мобильности в разминке; рескрининг 4-6нед. ' + ankleNote;
  else if (level === 'warn') recommendation = 'Целенаправленная коррекция 1-2 сегментов; heel-raise retest подтвердит драйвер. ' + ankleNote;
  else recommendation = 'Движение компетентно; поддерживать текущий уровень. ' + ankleNote;

  const needsPhysio = (input.kneeToWallCm != null && input.kneeToWallCm < 7) || (failed >= 4);

  return { totalScore, passed, failed, level, segments, primaryDriver, recommendation, needsPhysio };
}

export function ohsSegmentFailedCount(input: OHSInput): number {
  return assessOHS(input).failed;
}

export const OHS_SEGMENT_LABELS = SEGMENT_LABELS;
export const OHS_NORMS = {
  kneeToWallCm: { optimal: 12, cutoff: 9, severe: 7 },
  ankleDeg: { optimal: 35, range: '35-38°' },
  hipFlexion: 120,
  hipIR: 35,
  thoracicExtension: '40-45°',
  shoulderFlexion: 180,
};
