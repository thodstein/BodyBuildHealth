/**
 * arm-contest-sim.engine.ts — TOP T4: contest-sim неделя (генеральная репетиция).
 *
 * Источники: WAF 2025 (set → Ready → Go → Stop; 60с на выход; 2 warnings=1 foul,
 * 2 fouls=поражение; срыв→ремень; dangerous position), GoldenGrip (30% ready-go
 * репетиция + closed-arm), GodsOfGrip (max-таблица + warmups), supermatch
 * best-of-5/6 и помост 90/96/102 (свои движки — reuse идеями, не импортами).
 *
 * Ставится ВМЕСТО обычной техники в последнюю неделю перед стартом.
 * Чистый модуль без импортов.
 */

export interface ContestSimInput {
  level?: string;
  discipline?: string; // armwrestling | armlifting | hybrid
  strapExpected?: boolean;
  foulIds?: string[]; // персональная история фолов → акцент
  targetKg?: number; // цель помоста (armlifting) → попытки
  supermatch?: boolean; // best-of формат вместо одиночных схваток
}

export interface ContestSimDay {
  day: number;
  title: string;
  steps: string[];
  volumeNote: string;
}

export interface ContestSimWeek {
  days: ContestSimDay[];
  attempts: number[]; // armlifting 90/96/102 или []
  rounds: number; // armwrestling схваток/раундов
  checklist: string[];
  note: string;
}

/** Процедура рефери WAF одной строкой (канон). */
export function refereeFlow(): string[] {
  return ['Set (закрыть ладонь, большой виден, запястье прямо)', 'Ready (замереть, локоть-якорь)', 'Go (старт без фальстарта)', 'Stop → мгновенное замирание'];
}

/** Попытки помоста 90/96/102% (паритет planAttempts, без импорта). */
export function simAttempts(targetKg: number): number[] {
  const t = Number(targetKg);
  if (!Number.isFinite(t) || t <= 0) return [];
  const r = (p: number) => Math.round(t * p * 2) / 2;
  return [r(0.9), r(0.96), r(1.02)];
}

function foulFocus(foulIds: string[] | undefined): string[] {
  const ids = (foulIds || []).map((s) => String(s).toLowerCase());
  const out: string[] = [];
  if (ids.includes('elbow_lift')) out.push('Акцент: локоть-якорь — давление через подушку, foul_freeze 3×.');
  if (ids.includes('shoulder_foul')) out.push('Акцент: кор-якорь + тяга на себя, грудь раскрыта.');
  if (ids.includes('slip_grip')) out.push('Акцент: containment + cup, ремень-сессия уже пройдена.');
  if (ids.includes('false_start') || ids.includes('early_start')) out.push('Акцент: 30% ready-go репетиция — старт только по Go.');
  return out;
}

export function buildContestSimWeek(input: ContestSimInput = {}): ContestSimWeek {
  const disc = String(input.discipline || 'armwrestling').toLowerCase();
  const isLift = disc === 'armlifting';
  const lvl = String(input.level || 'intermediate').toLowerCase();
  const heavy = lvl === 'advanced' || lvl === 'enhanced';
  const attempts = isLift ? simAttempts(Number(input.targetKg ?? NaN)) : [];
  const rounds = isLift ? 0 : input.supermatch || disc === 'hybrid' ? (heavy ? 5 : 4) : heavy ? 4 : 3;
  const flow = refereeFlow().join(' → ');
  const focus = foulFocus(input.foulIds);
  const days: ContestSimDay[] = [
    {
      day: 1,
      title: 'Процедура + 30% ready-go',
      steps: [...refereeFlow(), 'Репетиция set-позиции 5×5с (рефери-хват)', 'Лёгкие старты 30% 6×3с — только тайминг, без борьбы'],
      volumeNote: 'Объём минимальный: техника, RIR≥3.',
    },
    {
      day: 2,
      title: isLift ? 'Разминка помоста + opener' : 'Схватки 70% по процедуре',
      steps: isLift
        ? ['WU 40%×5 → 60%×3 → 75%×1', attempts.length ? `Opener ${attempts[0]} кг по команде (пауза set 3с)` : 'Opener по ощущению RPE7', 'Пауза между попытками 3+ мин']
        : [`${rounds} схватки × 10–12с @70% строго по: ${flow}`, 'Между схватками 75–90с', 'Стоп по свистку — замирание, локоть не отрывать'],
      volumeNote: isLift ? 'Только разминка + opener, без максимума.' : 'Не красная линия: short rounds с техническим намерением.',
    },
    {
      day: 3,
      title: input.strapExpected ? 'Ремень + замирания' : 'Фолы + замирания',
      steps: [
        ...(input.strapExpected ? ['Старт в ремне 4×10с изометрия @90%', 'Вектор к себе-вбок, не рвать'] : ['Работа без ремня, но ремень рядом (штатный сценарий)']),
        'foul_freeze 3× замирание по свистку',
        ...focus,
      ],
      volumeNote: 'Изометрия 10с, RIR≥2; side минимум.',
    },
  ];
  const checklist = [
    'Магнезия/канифоль + проверка стола/ремня заранее',
    '60с на выход — тайминг выхода отрепетирован',
    '2 warnings = 1 foul, 2 fouls = поражение — игра чистая',
    ...(isLift ? ['3+ мин между попытками', 'Заявки 90/96/102 записаны'] : ['Готовность к strap при срыве', 'Drain-план на поздние раунды']),
    'Стоп при потере контроля кисти (GoldenGrip) — снятие, не героизм',
  ];
  return {
    days,
    attempts,
    rounds,
    checklist,
    note: isLift
      ? `Contest-sim помоста: процедура + opener${attempts.length ? ` ${attempts.join('/')}` : ''}, без максимума до дня старта.`
      : `Contest-sim стола: ${rounds} схватки 70% по процедуре + ремень/фолы, красная линия запрещена.`,
  };
}
