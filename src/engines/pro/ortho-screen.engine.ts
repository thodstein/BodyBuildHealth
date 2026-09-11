/**
 * ortho-screen.engine.ts — ЕДИНЫЙ ОРТО-СКРИНИНГ (J1–J7 плана JOINTS-ORTOPEDICS-PLAN).
 *
 * Принцип: скрининг, не диагноз; кластеры, а не 1 тест; боль = стоп; маршрут к врачу.
 * Чистые функции, без UI/storage. Все пороги и sens/spec-строки — из §2 плана:
 *  - плечо: Hawkins DOR 2.86 / Neer sens 79 spec 53 (Gismervik 2017; Hegedus 2008);
 *    lag-signs (ERLS/IRLS) сильнее для cuff (Jain 2024); apprehension DOR 53.6 (нестабильность).
 *  - ТБС: FADDIR sens 80 / spec 24–26 (Pålsson 2020); IROP sens 75–91; комбинация + ROM точнее.
 *  - Колено: вальгус в cut aOR 4.64 (BMJ SEM 2024); RTS LSI ≥90% + 6/9 мес (Wright 2025; AAOS AUC 2025).
 *  - YBT-ANT >4см — ранний флаг RTS-неуспеха (Garrison, AUC 0.82–0.85).
 *  - Beighton пороги ≥6/≥5/≥4 по возрасту; сила можно (Møller; Brittain 2023).
 *  - FMS-композит как прогноз НЕ используем (AUC 0.587, Dorrel 2015).
 */

export type OrthoRoute = 'clear' | 'watch' | 'doctor' | 'urgent';

export interface OrthoFlag {
  id: string;
  joint: 'shoulder' | 'hip' | 'knee' | 'spine' | 'ankle' | 'elbow' | 'hand' | 'general';
  level: 'ok' | 'watch' | 'doctor' | 'urgent';
  label: string;
  action: string;
  evidence: string;
}

// ── J1 Плечо ────────────────────────────────────────────────────────────────

export interface ShoulderClusterInput {
  painfulArc?: boolean; // боль 60–120° при подъёме
  hawkinsPain?: boolean; // боль при провокации (врач/партнёр)
  jobeWeak?: boolean; // empty-can слабость
  dropArm?: boolean; // рука падает с 90°
  apprehension?: boolean; // страх вывиха при отведении+ротации
}

export function assessShoulderCluster(i: ShoulderClusterInput): { score: number; positive: boolean; flags: OrthoFlag[] } {
  const vals = [i.painfulArc, i.hawkinsPain, i.jobeWeak, i.dropArm, i.apprehension];
  const score = vals.filter(Boolean).length;
  const positive = score >= 2;
  // Отдельный urgent-маршрут: apprehension + dropArm = нестабильность/разрыв в дифф. ряду
  const urgent = Boolean(i.apprehension && i.dropArm);
  const flags: OrthoFlag[] = [];
  if (urgent) {
    flags.push({
      id: 'shoulder_urgent', joint: 'shoulder', level: 'urgent',
      label: '🔴 Плечо: страх вывиха + падение руки — срочно к врачу',
      action: 'Рука на паузу (жимы/рывки/подтягивания — стоп). Только безболевой ROM. Срочно к врачу/МРТ — в дифф. ряду нестабильность/разрыв cuff.',
      evidence: 'Apprehension высокоспецифичен для нестабильности (DOR 53.6); drop-arm — lag-признак cuff. Одиночные тесты слабые — решение только по кластеру + МРТ.',
    });
    return { score, positive: true, flags };
  }
  if (positive) {
    flags.push({
      id: 'shoulder_cluster_pos', joint: 'shoulder', level: 'doctor',
      label: `🟡 Плечо: кластер положительный (${score}/5) — к врачу/МРТ`,
      action: 'Жимы над головой, рывки, жим из-за головы — на паузу. Только безболевой ROM. К врачу/МРТ (импинджмент/cuff в дифф. ряду, не диагноз).',
      evidence: 'Hawkins DOR 2.86 (sens 0.58/spec 0.67), Neer sens 79/spec 53 — по одному не судят. ERLS/IRLS сильнее для cuff (Jain 2024).',
    });
  }
  return { score, positive, flags };
}

// ── J2 ТБС ──────────────────────────────────────────────────────────────────

export interface HipScreenInput {
  faddirPain?: boolean; // боль в паху при глубоком приседе/сидении
  faberPain?: boolean; // боль в FABER-позе
  iropPain?: boolean; // боль при внутренней ротации под нагрузкой
  romFlag?: boolean; // IR <20° или асимметрия
}

export function assessHipScreen(i: HipScreenInput): { score: number; level: OrthoRoute; flags: OrthoFlag[] } {
  const score = [i.faddirPain, i.faberPain, i.iropPain].filter(Boolean).length;
  const flags: OrthoFlag[] = [];
  if (score >= 2 || (score >= 1 && i.romFlag)) {
    flags.push({
      id: 'hip_cluster_pos', joint: 'hip', level: 'doctor',
      label: `🟡 ТБС: кластер положительный (${score}/3${i.romFlag ? ' + ROM-флаг' : ''}) — к врачу`,
      action: 'Глубокий присед/рывок в сед — ограничить. Золотой стандарт — МРТ-артрография/инъекция, не опросник. FAI/labrum — только в дифф. ряду.',
      evidence: 'FADDIR sens 80/spec 24–26 (Pålsson 2020); IROP sens 75–91; FABER разброс 41–97/18–100. Комбинация + ROM точнее.',
    });
    return { score, level: 'doctor', flags };
  }
  if (score === 1) {
    flags.push({
      id: 'hip_watch', joint: 'hip', level: 'watch',
      label: '🟢 ТБС: 1/3 — наблюдение',
      action: 'Ограничить глубокий присед/рывок в сед 2–3 недели, следить за пахом. При повторе — к врачу.',
      evidence: 'FADDIR один — слабый rule-in; наблюдение + лимит глубины.',
    });
    return { score, level: 'watch', flags };
  }
  return { score, level: 'clear', flags };
}

// ── J3 Колено / ACL / YBT / RTS ─────────────────────────────────────────────

export interface KneeScreenInput {
  valgusSls?: boolean; // колено внутрь от 2-го пальца в single-leg squat
  wobbleStepDown?: boolean; // шатание/вальгус в step-down
  ybtAntDiffCm?: number; // ANT-асимметрия, см (|L−R|)
}

export function assessKneeValgus(i: KneeScreenInput): { positive: boolean; flags: OrthoFlag[] } {
  const ybtFlag = typeof i.ybtAntDiffCm === 'number' && i.ybtAntDiffCm > 4;
  const positive = Boolean(i.valgusSls || i.wobbleStepDown || ybtFlag);
  const flags: OrthoFlag[] = [];
  if (!positive) return { positive, flags };
  const parts: string[] = [];
  if (i.valgusSls) parts.push('вальгус в SLS');
  if (i.wobbleStepDown) parts.push('шатание в step-down');
  if (ybtFlag) parts.push(`YBT-ANT >4см (${i.ybtAntDiffCm}см)`);
  flags.push({
    id: 'knee_valgus_pos', joint: 'knee', level: 'watch',
    label: `🟡 Колено: качественный флаг (${parts.join(' + ')})`,
    action: 'Йок/фермер/присед — темп 3-0-1-0, трекинг над 2–3 пальцем, лента; резкие смены направления — на паузу. При боли/нестабильности — к врачу.',
    evidence: 'Вальгус в cut → aOR 4.64 повторного ACL (BMJ SEM 2024). YBT-ANT >4см — ранний флаг RTS-неуспеха (Garrison, AUC 0.82–0.85).',
  });
  return { positive, flags };
}

export interface RtsChecklistInput {
  lsiMeasured?: boolean; // мерялось ли вообще (сила + hop)
  lsiPass?: boolean; // все LSI ≥90%
  monthsSinceOp?: number;
  graft?: 'btb' | 'hamstring' | 'other' | 'none';
  fear?: boolean; // страх движения / неготовность
  preventionProgram?: boolean; // есть ACL-prevention программа
}

export function assessRts(i: RtsChecklistInput): { ready: boolean; status: string; flags: OrthoFlag[] } {
  if (!i.lsiMeasured) {
    return {
      ready: false, status: 'not_measured',
      flags: [{
        id: 'rts_not_measured', joint: 'knee', level: 'watch',
        label: '⚪ RTS: не измерено — не готово',
        action: 'Без силы + hop (LSI) готовность не оценивается. Нужны: сила квадрицепс/хамстринг + hop-тесты + срок + псих-готовность + prevention-программа.',
        evidence: 'Wright 2025: LSI ≥90% — де-факто стандарт, но без измерения — только «не измерено» (AAOS AUC 2025 — многофакторно).',
      }],
    };
  }
  const minMonths = i.graft === 'hamstring' ? 7 : 6;
  const timeOk = typeof i.monthsSinceOp === 'number' && i.monthsSinceOp >= minMonths;
  const ready = Boolean(i.lsiPass && timeOk && !i.fear && i.preventionProgram);
  const missing: string[] = [];
  if (!i.lsiPass) missing.push('LSI <90%');
  if (!timeOk) missing.push(`срок <${minMonths} мес`);
  if (i.fear) missing.push('страх движения');
  if (!i.preventionProgram) missing.push('нет prevention-программы');
  if (ready) return { ready, status: 'ready', flags: [] };
  return {
    ready, status: 'not_ready',
    flags: [{
      id: 'rts_not_ready', joint: 'knee', level: 'watch',
      label: `🟡 RTS: не готов (${missing.join('; ')})`,
      action: 'Возврат — после закрытия всех пунктов. LSI переоценивает при детренированной здоровой ноге — смотреть абсолютные цифры тоже.',
      evidence: 'AAOS AUC 2025: стабильность + симптомы + сила + баланс + симметрия + время + псих-готовность + prevention.',
    }],
  };
}

// ── J4 Минимум: позвоночник / ахилл / локоть / кисть ────────────────────────

export interface SpineMinInput {
  slrPain?: boolean; // боль по задней ноге при подъёме прямой <60°
  morningStiffnessLong?: boolean; // скованность + утренняя >30мин
}

export function assessSpineMin(i: SpineMinInput): OrthoFlag[] {
  const flags: OrthoFlag[] = [];
  if (i.slrPain) flags.push({
    id: 'spine_slr', joint: 'spine', level: 'doctor',
    label: '🟡 Поясница: SLR-боль — к врачу',
    action: 'Осевая нагрузка и наклоны — на паузу. Без «диагноза грыжи» — к врачу/МРТ.',
    evidence: 'SLR — скрининг корешковой боли, не диагноз уровня.',
  });
  if (i.morningStiffnessLong) flags.push({
    id: 'spine_stiff', joint: 'spine', level: 'doctor',
    label: '🟡 Скованность >30мин утром — к ревматологу в дифф. ряд',
    action: 'К ревматологу (воспалительный ритм — в дифф. ряду). Тренировки — безболевой ROM.',
    evidence: 'Длительная утренняя скованность — маркер воспалительного ритма.',
  });
  return flags;
}

export interface AchillesInput {
  popSound?: boolean; // хлопок в икре
  cantHeelRaise?: boolean; // невозможность встать на носок
}

export function assessAchilles(i: AchillesInput): OrthoFlag[] {
  if (i.popSound && i.cantHeelRaise) return [{
    id: 'achilles_rupture', joint: 'ankle', level: 'urgent',
    label: '🔴 Ахилл: хлопок + нет подъёма на носок — срочно к врачу',
    action: 'Стопу не грузить, срочно к врачу (разрыв ахилла в дифф. ряду). Самому Thompson-тест с силой не делать.',
    evidence: 'Классическая пара признаков разрыва ахилла — только врач/УЗИ.',
  }];
  if (i.popSound || i.cantHeelRaise) return [{
    id: 'achilles_watch', joint: 'ankle', level: 'doctor',
    label: '🟡 Ахилл: один признак — к врачу',
    action: 'Прыжки/икры — на паузу. К врачу/УЗИ.',
    evidence: 'По одному признаку не судят — нужна очная проверка.',
  }];
  return [];
}

export interface HandScreenInput {
  finkelsteinPain?: boolean; // боль со стороны большого пальца при сжатии
  phalenNumbness?: boolean; // онемение при согнутых запястьях
  tinelTingle?: boolean; // покалывание при постукивании
}

export function assessHand(i: HandScreenInput): OrthoFlag[] {
  const n = [i.finkelsteinPain, i.phalenNumbness, i.tinelTingle].filter(Boolean).length;
  if (n === 0) return [];
  return [{
    id: 'hand_cluster', joint: 'hand', level: 'doctor',
    label: `🟡 Кисть: ${n}/3 — к врачу`,
    action: 'Нагрузка на кисть — пауза/шина, без самолечения. Де Кервена/карпальный — только в дифф. ряду.',
    evidence: 'Finkelstein/Phalen/Tinel — скрининг, подтверждение у врача.',
  }];
}

export function assessElbowValgus(valgusPain?: boolean): OrthoFlag[] {
  if (!valgusPain) return [];
  return [{
    id: 'elbow_valgus', joint: 'elbow', level: 'watch',
    label: '🟡 Локоть: медиальная боль при броске/жиме — пауза вальгусных',
    action: 'Броски/французские/узкие жимы — на паузу 2–3 недели. При повторе — к врачу (UCL в дифф. ряду).',
    evidence: 'Вальгусная боль — скрининг UCL-напряжения, не диагноз.',
  }];
}

// ── J5 Beighton ─────────────────────────────────────────────────────────────

export interface BeightonInput {
  pinkyL?: boolean; pinkyR?: boolean;
  thumbL?: boolean; thumbR?: boolean;
  elbowL?: boolean; elbowR?: boolean;
  kneeL?: boolean; kneeR?: boolean;
  trunk?: boolean; // ладони на пол без сгиба колен
  age?: number;
  fivePQ?: number; // 0–5 положительных ответов при пограничном
}

export function scoreBeighton(i: BeightonInput): number {
  return [i.pinkyL, i.pinkyR, i.thumbL, i.thumbR, i.elbowL, i.elbowR, i.kneeL, i.kneeR, i.trunk].filter(Boolean).length;
}

export function beightonCutoff(age?: number): number {
  if (typeof age === 'number') {
    if (age < 18) return 6;
    if (age > 50) return 4;
  }
  return 5;
}

export function assessBeighton(i: BeightonInput): { score: number; cutoff: number; positive: boolean; flags: OrthoFlag[] } {
  const score = scoreBeighton(i);
  const cutoff = beightonCutoff(i.age);
  let positive = score >= cutoff;
  if (!positive && score === cutoff - 1 && typeof i.fivePQ === 'number' && i.fivePQ >= 2) positive = true;
  if (!positive) return { score, cutoff, positive, flags: [] };
  return {
    score, cutoff, positive,
    flags: [{
      id: 'beighton_pos', joint: 'general', level: 'watch',
      label: `🟡 Гипермобильность: Beighton ${score}/9 (порог ${cutoff}) — щадящий режим`,
      action: 'Closed-chain + proprioception-приоритет; запрет end-range под нагрузкой и high-impact/contact; темп 3-1-1-0, RIR≥2, прогрессия ≤10%/нед. Сила НЕ запрещена.',
      evidence: 'Møller: тяжёлая силовая при EDS — feasible; Brittain 2023: therapeutic exercise + motor training — efficacious.',
    }],
  };
}

// ── Yellow flags + teen ─────────────────────────────────────────────────────

export interface YellowInput { badSleep?: boolean; highStress?: boolean; fearOfMovement?: boolean }

export function assessYellow(i: YellowInput): OrthoFlag[] {
  const n = [i.badSleep, i.highStress, i.fearOfMovement].filter(Boolean).length;
  if (n === 0) return [];
  return [{
    id: 'yellow_flags', joint: 'general', level: 'watch',
    label: `🟡 Жёлтые флаги: ${n}/3 (сон/стресс/страх движения)`,
    action: 'Снизить объём ×0.85, RIR+1, добавить сон/стресс-протокол. Боль при страхе движения — не «терпеть».',
    evidence: 'Психосоциальные флаги модифицируют боль и возврат; страх = неготовность (AAOS).',
  }];
}

export function teenGate(ageBand?: string): OrthoFlag[] {
  if (ageBand !== 'teen_14_15') return [];
  return [{
    id: 'teen_gate', joint: 'general', level: 'watch',
    label: '🟡 Подросток 14–15: без отказа, без максимумов',
    action: 'RIR≥2, без синглов/соревновательных попыток, техника > вес. Как BB/ARM-гейты.',
    evidence: 'Паритет BB/ARM teen-гейтов; TA/STRONG — тот же режим.',
  }];
}

// ── J6 Честность поддержки ──────────────────────────────────────────────────

export type SupportEvidence = 'proven' | 'moderate' | 'weak' | 'investigational';

export interface SupportRank { id: string; label: string; evidence: SupportEvidence; note: string; timing?: string }

export function rankJointSupport(): SupportRank[] {
  return [
    { id: 'collagen_hydro', label: 'Гидролизат коллагена 15–30г + VitC 50мг', evidence: 'proven', timing: 'за 30–60мин ДО тренировки с прыжками/верёвкой', note: 'Nulty 2025: CSA/stiffness/modulus выше vs тренировка alone; Shaw-протокол — база. VitC — кофактор гидроксилирования.' },
    { id: 'uc2', label: 'UC-II 40мг', evidence: 'moderate', timing: 'утро натощак, отдельно от гидролизата', note: 'Lugo 2013 / Crowley 2016: WOMAC и безболевой период лучше; эффект умеренный, механизм — оральная толерантность.' },
    { id: 'vitC', label: 'Витамин C (кофактор)', evidence: 'proven', note: 'Без VitC синтез коллагена останавливается (пролил/лизил-гидроксилазы).' },
    { id: 'omega3', label: 'Omega-3 3–5г (EPA>2г)', evidence: 'moderate', note: 'Резолвины синовиальной жидкости; противовоспалительный фон, не ремонт.' },
    { id: 'boswellia', label: 'Босвеллия (AKBA)', evidence: 'moderate', note: '5-LOX путь; боль при ОА −40–50% в RCT, гетерогенность высокая.' },
    { id: 'msm', label: 'MSM 2–3г', evidence: 'moderate', note: 'Сера дисульфидных мостиков; боль −25–40%, ЖКТ-лимит.' },
    { id: 'glucosamine', label: 'Глюкозамин 1500мг', evidence: 'weak', note: 'При adequate concealment пользы по боли/WOMAC нет (мета 20 RCT). Опция, не база.' },
    { id: 'chondroitin', label: 'Хондроитин 800–1200мг', evidence: 'weak', note: 'То же: слабый сигнал, только сульфатные формы в части RCT.' },
    { id: 'bpc_tb', label: 'BPC-157 / TB-500', evidence: 'investigational', note: 'Сильный preclinical (Fmax, коллаген I/III), ноль human efficacy RCT на 2026 (только pilot безопасности n=2). TB-500 — WADA-лист. Онко-предосторожность (VEGF). Только стерильно.' },
  ];
}

// ── J7 Агрегатор + гарды + профиль + экспорт ────────────────────────────────

export interface OrthoScreenInput {
  shoulder?: ShoulderClusterInput;
  hip?: HipScreenInput;
  knee?: KneeScreenInput;
  rts?: RtsChecklistInput;
  spine?: SpineMinInput;
  achilles?: AchillesInput;
  hand?: HandScreenInput;
  elbowValgusPain?: boolean;
  beighton?: BeightonInput;
  yellow?: YellowInput;
  ageBand?: string;
}

export interface OrthoScreenResult {
  flags: OrthoFlag[];
  clusterShoulder: boolean;
  clusterHipDoctor: boolean;
  kneeFlag: boolean;
  beightonPositive: boolean;
  hasUrgent: boolean;
  hasDoctor: boolean;
  summary: string;
}

export function screenOrtho(i: OrthoScreenInput): OrthoScreenResult {
  const flags: OrthoFlag[] = [];
  const sh = assessShoulderCluster(i.shoulder ?? {});
  flags.push(...sh.flags);
  const hip = assessHipScreen(i.hip ?? {});
  flags.push(...hip.flags);
  const kn = assessKneeValgus(i.knee ?? {});
  flags.push(...kn.flags);
  if (i.rts) {
    const r = assessRts(i.rts);
    flags.push(...r.flags);
  }
  flags.push(...assessSpineMin(i.spine ?? {}));
  flags.push(...assessAchilles(i.achilles ?? {}));
  flags.push(...assessHand(i.hand ?? {}));
  flags.push(...assessElbowValgus(i.elbowValgusPain));
  const bei = assessBeighton(i.beighton ?? {});
  flags.push(...bei.flags);
  flags.push(...assessYellow(i.yellow ?? {}));
  flags.push(...teenGate(i.ageBand));
  const hasUrgent = flags.some(f => f.level === 'urgent');
  const hasDoctor = flags.some(f => f.level === 'doctor');
  const summary = flags.length === 0
    ? '✅ Орто-скрининг чистый: кластеры отрицательные. Работаем по плану.'
    : `${hasUrgent ? '🔴' : hasDoctor ? '🟡' : '⚪'} Флагов: ${flags.length} — ` + flags.map(f => f.label).join(' · ');
  return {
    flags,
    clusterShoulder: sh.positive,
    clusterHipDoctor: hip.level === 'doctor',
    kneeFlag: kn.positive,
    beightonPositive: bei.positive,
    hasUrgent, hasDoctor, summary,
  };
}

export interface OrthoGuards {
  pauseOverhead: boolean; // жимы над головой/рывки на паузу
  limitDeepSquat: boolean; // ограничить глубину приседа/сед
  yokeGate: boolean; // йок/фермер гейт при вальгусе
  closedChainOnly: boolean; // Beighton+: только закрытая цепь
  noEndRangeLoaded: boolean;
  blockedPatterns: string[]; // для orthopedicBlockedPatterns
  mobilityAdd: string[]; // для mobilityRestrictions
  rationale: string[];
}

export function orthoGuardsForPlan(r: OrthoScreenResult): OrthoGuards {
  const g: OrthoGuards = {
    pauseOverhead: false, limitDeepSquat: false, yokeGate: false,
    closedChainOnly: false, noEndRangeLoaded: false,
    blockedPatterns: [], mobilityAdd: [], rationale: [],
  };
  if (r.clusterShoulder) {
    g.pauseOverhead = true;
    g.blockedPatterns.push('vertical_push');
    g.mobilityAdd.push('shoulder');
    g.rationale.push('Плечевой кластер+ → vertical_push на паузу, только безболевой ROM.');
  }
  if (r.clusterHipDoctor) {
    g.limitDeepSquat = true;
    g.mobilityAdd.push('hip');
    g.rationale.push('ТБС-кластер+ → лимит глубины приседа/седа, к врачу.');
  }
  if (r.kneeFlag) {
    g.yokeGate = true;
    g.limitDeepSquat = true;
    g.mobilityAdd.push('knee');
    g.rationale.push('Коленный флаг → йок/фермер гейт + трекинг/лента.');
  }
  if (r.beightonPositive) {
    g.closedChainOnly = true;
    g.noEndRangeLoaded = true;
    g.rationale.push('Beighton+ → закрытая цепь, без end-range под нагрузкой, RIR≥2.');
  }
  if (r.hasUrgent) g.rationale.push('Есть urgent-флаг — нагрузку зоны не даём до врача.');
  g.blockedPatterns = Array.from(new Set(g.blockedPatterns));
  g.mobilityAdd = Array.from(new Set(g.mobilityAdd));
  return g;
}

const ORTHO_STORE_KEY = 'he_ortho_screen_v1';

export function saveOrthoFlags(flags: OrthoFlag[]): void {
  try {
    localStorage.setItem(ORTHO_STORE_KEY, JSON.stringify({ at: new Date().toISOString(), flags }));
  } catch { /* quota — молча, скрининг не должен ронять UI */ }
}

export function loadOrthoFlags(): OrthoFlag[] {
  try {
    const raw = localStorage.getItem(ORTHO_STORE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p.flags) ? p.flags : [];
  } catch { return []; }
}

/** Пишет флаги в профиль (health.orthoFlags + mobilityRestrictions merge, без затирания). */
export function applyOrthoToProfile(flags: OrthoFlag[]): { orthoFlags: OrthoFlag[]; mobilityAdd: string[] } {
  const mobilityAdd = Array.from(new Set(flags.flatMap(f => {
    if (f.id === 'shoulder_cluster_pos' || f.id === 'shoulder_urgent') return ['shoulder'];
    if (f.id === 'hip_cluster_pos' || f.id === 'hip_watch') return ['hip'];
    if (f.id === 'knee_valgus_pos' || f.id === 'rts_not_ready') return ['knee'];
    return [];
  })));
  try {
    const raw = localStorage.getItem('he_profile_v2');
    if (!raw) return { orthoFlags: flags, mobilityAdd };
    const p = JSON.parse(raw);
    const s = p.settings ?? p;
    s.health = s.health ?? {};
    (s.health as any).orthoFlags = flags;
    const prevH: string[] = Array.isArray((s.health as any).mobilityRestrictions) ? (s.health as any).mobilityRestrictions : [];
    (s.health as any).mobilityRestrictions = Array.from(new Set([...prevH, ...mobilityAdd]));
    s.training = s.training ?? {};
    const prevT: string[] = Array.isArray((s.training as any).mobilityRestrictions) ? (s.training as any).mobilityRestrictions : [];
    (s.training as any).mobilityRestrictions = Array.from(new Set([...prevT, ...mobilityAdd]));
    localStorage.setItem('he_profile_v2', JSON.stringify(p.settings ? { ...p, settings: s } : s));
  } catch { /* битый профиль — не трогаем */ }
  return { orthoFlags: flags, mobilityAdd };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildOrthoHtml(r: OrthoScreenResult): string {
  const rows = r.flags.map(f => `<tr><td>${esc(f.joint)}</td><td>${esc(f.level)}</td><td>${esc(f.label)}</td><td>${esc(f.action)}</td></tr>`).join('');
  return `<h3>🦴 Орто-скрининг (J1–J5): скрининг, не диагноз</h3><p>${esc(r.summary)}</p>` +
    (r.flags.length ? `<table border="1" cellpadding="4"><tr><th>Зона</th><th>Уровень</th><th>Флаг</th><th>Действие</th></tr>${rows}</table>` : '<p>Флагов нет.</p>');
}

export function buildOrthoCsv(r: OrthoScreenResult): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ['joint,level,label,action'];
  for (const f of r.flags) lines.push([q(f.joint), q(f.level), q(f.label), q(f.action)].join(','));
  return '﻿' + lines.join('\n');
}

export function orthoBridgePayload(r: OrthoScreenResult, guards: OrthoGuards): Record<string, unknown> {
  const teen = r.flags.some(f => f.id === 'teen_gate');
  return {
    orthoFlags: r.flags,
    orthoSummary: r.summary,
    orthoGuards: {
      pauseOverhead: guards.pauseOverhead,
      limitDeepSquat: guards.limitDeepSquat,
      yokeGate: guards.yokeGate,
      closedChainOnly: guards.closedChainOnly,
      blockedPatterns: guards.blockedPatterns,
      mobilityAdd: guards.mobilityAdd,
    },
    // Живой контур в ПЛ-авто: SRCBBScreen (kind weakpoints) читает orthopedic.blockedPatterns
    // → orthopedicBlockedPatterns → lms-builder фильтрует паттерны (плечо+ реально ставит vertical_push на паузу).
    orthopedic: { blockedPatterns: guards.blockedPatterns, source: 'ortho-screen' },
    // Живой контур в ББ-авто: приёмник читает teenNote → he_bb_last_teen (показ teen-режима).
    teenNote: teen ? 'Подросток 14–15 (орто-скрининг): без отказа, без максимумов, RIR≥2.' : null,
  };
}
