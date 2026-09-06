/**
 * arm-humerus-axis.engine.ts — ось кисть–локоть–плечо (спиральный перелом).
 *
 * Источник: Öğümsöğütlü & Özcan 2026, видео-анализ 74 переломов диафиза
 * плеча: ротация корпуса в сторону атаки (p<0.001) + разрыв оси
 * кисть–локоть–плечо и запястье позади плеча (81.1%, p<0.001) + 62.2% в
 * защите; механизм — торсия при внутренней ротации плеча на фоне
 * гиперактивности брахиорадиалиса + дорсифлексии кисти. Холод и отсутствие
 * разминки повышают риск (ретроспектива AMC 2023, n=27, средний возраст ~25).
 *
 * Движок чек-листа техники/позиции: вход — флаги из самоотчёта или разбора
 * видео; выход — warnings (только предупреждения, valid не трогаем) +
 * процедурные строки. Чистый модуль без импортов.
 */

export interface HumerusAxisInput {
  trunkRotatedTowardAttack?: boolean;
  wristElbowShoulderAligned?: boolean; // true = ось держится
  wristBehindShoulder?: boolean;
  fightingFromDefense?: boolean;
  wristExtendedDorsally?: boolean; // кисть разогнута назад под нагрузкой
  coldNoWarmup?: boolean;
  sideMaxAttempt?: boolean; // идёт макс бокового
}

export interface HumerusAxisResult {
  risk: 'low' | 'guarded' | 'high';
  score: number; // 0–5 красных флагов
  warnings: string[];
  cues: string[];
}

export function checkHumerusAxis(input: HumerusAxisInput = {}): HumerusAxisResult {
  let score = 0;
  const warnings: string[] = [];
  const cues: string[] = [];
  if (input.trunkRotatedTowardAttack) {
    score++;
    warnings.push('Ось: ротация корпуса в сторону атаки — главный фактор перелома 2026 (p<0.001). Давить ногами/кором без скрута.');
  }
  if (input.wristElbowShoulderAligned === false) {
    score++;
    warnings.push('Ось: разрыв линии кисть–локоть–плечо (81% переломов) — вернуть локоть-якорь и плечо в линию.');
  }
  if (input.wristBehindShoulder) {
    score++;
    warnings.push('Ось: запястье позади плеча — торсия плечевой кости растёт; подтянуть кисть в створ плеча.');
  }
  if (input.wristExtendedDorsally) {
    score++;
    warnings.push('Кисть разогнута назад под нагрузкой — пик брахиорадиалиса/тремор → держать cup, не отдавать запястье.');
  }
  if (input.coldNoWarmup) {
    score++;
    warnings.push('Холод без разминки — фактор переломов (ретроспектива): разминка кисти/локтя/плеча 10–15 мин обязательна.');
  }
  if (input.fightingFromDefense && input.sideMaxAttempt) {
    score++;
    warnings.push('Защита (62% переломов) + макс бокового — не рвать: изометрия/ремень, стоп при потере cup.');
  } else if (input.fightingFromDefense) {
    cues.push('Защита: терпеть позицией (cup + pron), не скручиваться — ждать ошибки, не героить.');
  }
  cues.push('База: локоть-якорь, плечо в линии, давление ногами — side только после cup/pron.');
  const risk = score >= 3 ? 'high' : score >= 1 ? 'guarded' : 'low';
  return { risk, score, warnings, cues };
}
