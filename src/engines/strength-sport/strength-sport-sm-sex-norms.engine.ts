/**
 * strength-sport-sm-sex-norms.engine.ts — ПОЛОВЫЕ НОРМЫ СТРОНГА (SM PRO P2)
 *
 * Hindle et al. 2021 (камень, PeerJ, n=20: 8Ж/12М): у женщин больше сгибание таза
 * в начале 1-й тяги, коленей и 2-й тяги + короче 2-я тяга (антропометрия).
 * Hindle et al. 2021 (йок, Frontiers, n=19): у женщин при той же скорости больше наклон
 * корпуса вперёд + выше темп (компенсация короткого шага); sex×interval: укороченный
 * hip ROM на разгоне 0–5 м + дольше выход на макс. шаг — ожидаемо.
 * Пол берётся из профиля (не только из видео): poseSex приоритетнее, затем профиль.
 *
 * Чистый движок, без UI/storage.
 */

export type SMSex = 'male' | 'female';

export const SM_SEX_YOKE_HIP_MIN = 30;
export const SM_SEX_STONE_PULL2_MAX_S: Record<SMSex, number> = { male: 3.5, female: 2.8 };

export interface SMSexYokeVerdict {
  verdict: 'ok' | 'warn';
  lines: string[];
}

/** Йок hip ROM с учётом пола: укорочение у женщин на разгоне — вариант нормы. */
export function diagnoseYokeRomForSex(
  hipRomDeg: number | null | undefined,
  kneeRomDeg: number | null | undefined,
  sex: SMSex | null | undefined,
): SMSexYokeVerdict | null {
  if (hipRomDeg == null || !Number.isFinite(hipRomDeg)) return null;
  const female = sex === 'female';
  const lines: string[] = [];
  if (hipRomDeg >= SM_SEX_YOKE_HIP_MIN) {
    lines.push(`Йок hip ROM ${hipRomDeg}° — норма ≥${SM_SEX_YOKE_HIP_MIN}°`);
    return { verdict: 'ok', lines };
  }
  if (female) {
    lines.push(
      `Йок hip ROM ${hipRomDeg}° < ${SM_SEX_YOKE_HIP_MIN}° — у женщин на разгоне вариант нормы (Hindle sex×interval), смотри полный проход 15–20 м`,
    );
    return { verdict: 'ok', lines };
  }
  lines.push(`Йок hip ROM ${hipRomDeg}° < ${SM_SEX_YOKE_HIP_MIN}° — укорочен: выпады/болгары + шаг к 1.1 м`);
  void kneeRomDeg;
  return { verdict: 'warn', lines };
}

export interface SMSexStoneVerdict {
  verdict: 'ok' | 'warn';
  lines: string[];
}

/** 2-я тяга камня: у женщин короче (Hindle) — та же длительность судится строже. */
export function diagnoseStoneSecondPullForSex(
  secondPullS: number | null | undefined,
  sex: SMSex | null | undefined,
): SMSexStoneVerdict | null {
  if (secondPullS == null || !Number.isFinite(secondPullS) || secondPullS <= 0) return null;
  const s: SMSex = sex === 'female' ? 'female' : 'male';
  const cap = SM_SEX_STONE_PULL2_MAX_S[s];
  if (secondPullS <= cap) {
    return { verdict: 'ok', lines: [`2-я тяга ${secondPullS} с ≤ ${cap} с (${s === 'female' ? 'жен' : 'муж'} норма)`] };
  }
  return {
    verdict: 'warn',
    lines: [`2-я тяга ${secondPullS} с > ${cap} с (${s === 'female' ? 'жен' : 'муж'} норма) — взрыв таза: прыжки/толчки + RFD-пик`],
  };
}

/** Пол атлета: явный выбор в хабе приоритетнее, затем профиль. */
export function resolveAthleteSex(
  poseSex: string | null | undefined,
  profileSex: string | null | undefined,
): SMSex | null {
  const norm = (v: string | null | undefined): SMSex | null => {
    const s = String(v || '').toLowerCase();
    if (s === 'female' || s === 'f' || s === 'ж' || s === 'жен' || s === 'женский') return 'female';
    if (s === 'male' || s === 'm' || s === 'м' || s === 'муж' || s === 'мужской') return 'male';
    return null;
  };
  return norm(poseSex) ?? norm(profileSex) ?? null;
}

export function athleteSexLabel(sex: SMSex | null): string {
  if (sex === 'female') return 'Женский (нормы Hindle Ж)';
  if (sex === 'male') return 'Мужской (нормы Hindle М)';
  return 'Не указан (общие нормы)';
}
