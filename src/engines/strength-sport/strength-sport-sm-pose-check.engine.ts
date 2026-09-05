/**
 * strength-sport-sm-pose-check.engine.ts — АВТОПРОВЕРКА УГЛОВ СТРОНГМЕНА ПО ВИДЕО (SM PRO)
 *
 * Вход — CSV углов трекера поз (t,hip,knee,ankle,shoulder): разбор и сводка через
 * общий pose-движок (read-only, без его модификации), проверка — по SM-нормам:
 *  carry (йок): hip ROM 37.9±7.8° → норма [30,46], knee ROM 53.9±10.7° → [43,65]
 *   (Hindle et al. Front.Sports 2021, n=19, 20м @85%: heel-strike hip ~24°/knee ~6°,
 *    toe-off hip ~−3°/knee ~46°). Укороченный ROM на разгоне 0-5м — вариант нормы
 *   (скорость набирается частотой), поэтому выход за низ — warn, не critical.
 *  overhead (лог-локаут): средний shoulder <150° — руки не над опорой, warn.
 * Parity с TA autoValidateAnglesFromPose (авто-валидация вместо ручных углов).
 *
 * Чистый движок (парсинг делегирован pose-движку).
 */

import {
  parsePoseAnglesCsv,
  summarizePoseAngles,
  type PoseAnglesSummary,
} from './strength-sport-pose.engine';

/** Нормы Hindle 2021 (среднее ± SD → рабочий коридор). */
export const SM_POSE_NORMS = {
  yokeHipRom: { min: 30, max: 46, mean: 37.9 },
  yokeKneeRom: { min: 43, max: 65, mean: 53.9 },
  overheadShoulderAvg: 150,
};

export interface SMPoseCheckResult {
  lift: 'yoke_walk' | 'farmers_walk' | 'log_press';
  n: number;
  verdict: 'ok' | 'warn' | 'critical';
  lines: string[];
  summary: PoseAnglesSummary;
}

const rom = (s: { min: number; max: number } | null): number | null =>
  s ? Math.round((s.max - s.min) * 10) / 10 : null;

export function diagnoseSMPoseCarry(
  summary: PoseAnglesSummary,
  lift: 'yoke_walk' | 'farmers_walk' = 'yoke_walk',
  sex?: string | null,
): SMPoseCheckResult | null {
  if (!summary || summary.n < 2) return null;
  const lines: string[] = [];
  let bad = 0;
  const female = String(sex || '').toLowerCase() === 'female';
  const hipRom = summary.hip ? rom(summary.hip) : null;
  const kneeRom = summary.knee ? rom(summary.knee) : null;
  if (hipRom == null && kneeRom == null) return null;
  const label = lift === 'yoke_walk' ? 'Йок' : 'Фермер';
  let hipLow = false;
  if (hipRom != null) {
    if (hipRom >= SM_POSE_NORMS.yokeHipRom.min && hipRom <= SM_POSE_NORMS.yokeHipRom.max) {
      lines.push(`${label} hip ROM ${hipRom}° — норма [${SM_POSE_NORMS.yokeHipRom.min},${SM_POSE_NORMS.yokeHipRom.max}] (Hindle 37.9°)`);
    } else if (hipRom < SM_POSE_NORMS.yokeHipRom.min) {
      hipLow = true;
      bad++;
      lines.push(`${label} hip ROM ${hipRom}° < ${SM_POSE_NORMS.yokeHipRom.min}° — укорочен: если это разгон 0-5м — норма (частота вместо длины), иначе добавь ROM (выпады/болгары)`);
    } else {
      bad++;
      lines.push(`${label} hip ROM ${hipRom}° > ${SM_POSE_NORMS.yokeHipRom.max}° — разболтан: укорот шаг 40-60см, взгляд вперёд`);
    }
  }
  let kneeOk = false;
  if (kneeRom != null) {
    if (kneeRom >= SM_POSE_NORMS.yokeKneeRom.min && kneeRom <= SM_POSE_NORMS.yokeKneeRom.max) {
      kneeOk = true;
      lines.push(`${label} knee ROM ${kneeRom}° — норма [${SM_POSE_NORMS.yokeKneeRom.min},${SM_POSE_NORMS.yokeKneeRom.max}] (Hindle 53.9°)`);
    } else if (kneeRom < SM_POSE_NORMS.yokeKneeRom.min) {
      bad++;
      lines.push(`${label} knee ROM ${kneeRom}° < ${SM_POSE_NORMS.yokeKneeRom.min}° — семенишь: распусти шаг к 1.1м на скорости (Hindle stride)`);
    } else {
      bad++;
      lines.push(`${label} knee ROM ${kneeRom}° > ${SM_POSE_NORMS.yokeKneeRom.max}° — глубокий сед на ходу: жёстче кор, короче шаг`);
    }
  }
  // Hindle sex×interval: у женщин укороченный hip ROM на разгоне + дольше выход на
  // макс. stride — ожидаемо; изолированный hip-low при норме колена не штрафуем.
  if (female && hipLow && kneeOk && bad <= 2) {
    bad = Math.min(bad, 1);
    lines.push('Женщины: укороченный hip ROM на разгоне 0-5м — вариант нормы (Hindle interaction), смотри полный проход 15-20м');
  }
  const verdict: SMPoseCheckResult['verdict'] = bad === 0 ? 'ok' : bad >= 2 ? 'critical' : 'warn';
  return { lift, n: summary.n, verdict, lines, summary };
}

export function diagnoseSMPoseOverhead(summary: PoseAnglesSummary): SMPoseCheckResult | null {
  if (!summary || summary.n < 2 || !summary.shoulder) return null;
  const avg = summary.shoulder.avg;
  const ok = avg >= SM_POSE_NORMS.overheadShoulderAvg;
  return {
    lift: 'log_press',
    n: summary.n,
    verdict: ok ? 'ok' : 'warn',
    lines: [
      ok
        ? `Лог-локаут shoulder ~${avg}° ≥ ${SM_POSE_NORMS.overheadShoulderAvg}° — руки над опорой`
        : `Лог-локаут shoulder ~${avg}° < ${SM_POSE_NORMS.overheadShoulderAvg}° — лог впереди: голова назад до локаута, thoracic extension (JMStrength)`,
    ],
    summary,
  };
}

/** CSV → сводка → проверка (тип лифта: yoke/farmer/log по строке; sex — female-нормы Hindle). */
export function smPoseCheckFromCsv(
  csvText: string,
  liftId: string,
  sex?: string | null,
): { summary: PoseAnglesSummary; result: SMPoseCheckResult } | null {
  const samples = parsePoseAnglesCsv(csvText);
  if (!samples) return null;
  const summary = summarizePoseAngles(samples);
  if (!summary) return null;
  const low = String(liftId || '').toLowerCase();
  let result: SMPoseCheckResult | null = null;
  if (low.includes('log') || low.includes('лог') || low.includes('press') || low.includes('axle')) {
    result = diagnoseSMPoseOverhead(summary);
  } else {
    result = diagnoseSMPoseCarry(summary, low.includes('farmer') || low.includes('фермер') ? 'farmers_walk' : 'yoke_walk', sex);
  }
  if (!result) return null;
  return { summary, result };
}
