/**
 * armlift-diagnosis.engine.ts — диагноз слабого звена армлифтинга (PRO-5 D1).
 * Вход: снаряд + точка срыва + фолы техники + тест-батарея + мобильность + боль/асимметрия.
 * Выход: слабое звено + причина + уверенность + кью. Чистая функция.
 * Приоритет (как в arm-weak-cause): боль > техника (>=2 фола) > асимметрия > мобильность > тесты > точка срыва.
 */

export type ArmliftWeakLink =
  | 'thumb'
  | 'fingers'
  | 'wrist_ext'
  | 'support_endurance'
  | 'crush'
  | 'technique'
  | 'asymmetry'
  | 'conditioning';

export type ArmliftCause = 'pain' | 'technique' | 'asymmetry' | 'mobility' | 'strength' | 'endurance' | 'fatigue';

export interface ArmliftDiagInput {
  implement?: string;
  failurePoint?: string;
  faultIds?: string[];
  pinchHoldSec?: number | null;
  farmerHoldSec?: number | null;
  wristExtWeak?: boolean;
  asymmetryPct?: number | null;
  thumbStiff?: boolean;
  wristExtLimited?: boolean;
  wristFlexLimited?: boolean;
  hipHingePoor?: boolean;
  pain?: boolean;
  painNote?: string;
}

export interface ArmliftDiagnosis {
  weakLink: ArmliftWeakLink;
  cause: ArmliftCause;
  confidence: 'high' | 'med' | 'low';
  title: string;
  cues: string[];
  ruleNote: string;
}

const TITLES: Record<ArmliftWeakLink, string> = {
  thumb: 'Слабое звено: большой палец (pinch)',
  fingers: 'Слабое звено: сгибатели пальцев (support)',
  wrist_ext: 'Слабое звено: разгибатели запястья',
  support_endurance: 'Слабое звено: выносливость удержания',
  crush: 'Слабое звено: дробление (crush)',
  technique: 'Слабое звено: техника (фолы правил)',
  asymmetry: 'Слабое звено: асимметрия рук',
  conditioning: 'Стоп: боль — сначала к врачу, не грузить',
};

function num(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) && (v as number) > 0 ? (v as number) : null;
}

export function diagnoseArmlift(i: ArmliftDiagInput): ArmliftDiagnosis {
  const faults = Array.isArray(i.faultIds) ? i.faultIds.filter(Boolean) : [];
  const impl = String(i.implement || 'rolling_thunder');
  const fp = String(i.failurePoint || '');
  const asym = num(i.asymmetryPct);
  const pinch = num(i.pinchHoldSec);
  const farmer = num(i.farmerHoldSec);

  // P0: боль — стоп, как red-flags в арм-хабе.
  if (i.pain) {
    return {
      weakLink: 'conditioning', cause: 'pain', confidence: 'high', title: TITLES.conditioning,
      cues: ['Хват не чиним через нагрузку при боли', 'Проверь: локоть (эпикондилит), запястье, большой палец', 'Вернись к диагностике без боли'],
      ruleNote: 'Скрининг, не диагноз. Боль ≥4 или отёк/онемение — к врачу.',
    };
  }
  // P1: техника — 2+ фола (прецедент arm-weak-cause).
  if (faults.length >= 2) {
    return {
      weakLink: 'technique', cause: 'technique', confidence: 'high', title: TITLES.technique,
      cues: faults.slice(0, 3).map((f) => `Убрать фол: ${f}`),
      ruleNote: 'Замер с фолами — тренировочный, не зачётный (IronMind/AUSA).',
    };
  }
  // P2: асимметрия >15% (клинический порог щипка, Mathiowetz-практика).
  if (asym != null && asym > 15) {
    return {
      weakLink: 'asymmetry', cause: 'asymmetry', confidence: 'high', title: TITLES.asymmetry,
      cues: ['Слабая рука первой в неделе, +1 подход слабой', 'Симметрия — тот же снаряд, та же рука-позиция'],
      ruleNote: `Межручная разница ${asym}% — выше фона 5–10%, слабая рука лимитирует.`,
    };
  }
  // P3: мобильность под снаряд.
  const pinchImpl = impl === 'saxon_bar' || impl === 'hub' || impl === 'pinch_block' || impl === 'anvil' || impl === 'grandfather_clock';
  if (pinchImpl && i.thumbStiff) {
    return {
      weakLink: 'thumb', cause: 'mobility', confidence: 'med', title: TITLES.thumb,
      cues: ['Раскрытие большого: мягкий мяч 2×20, без боли', 'Щипок широким хватом — только после свободного сведения'],
      ruleNote: 'Жёсткий большой палец режет pinch раньше силы (NSCA).',
    };
  }
  if (i.wristExtLimited || i.wristFlexLimited) {
    return {
      weakLink: 'wrist_ext', cause: 'mobility', confidence: 'med', title: TITLES.wrist_ext,
      cues: ['Нейтраль запястья: экстензия с резинкой 2×15', 'Кистевой роллер лёгкий, без провала в сгиб'],
      ruleNote: 'Позиция запястья меняет длину FDP/FDS (SBS 2024).',
    };
  }
  // P4: тест-батарея (пороги из синтеза: pinch-hold и farmer-hold).
  if (i.wristExtWeak) {
    return {
      weakLink: 'wrist_ext', cause: 'strength', confidence: 'med', title: TITLES.wrist_ext,
      cues: ['Разгибатели: резинка 3×15–25 + роллер', 'На каждый сет сгибателей — сет экстензии (баланс 4:2)'],
      ruleNote: 'Слабые ECRL/ECRB/ECU → включается EDC и открывает пальцы (SBS 2024).',
    };
  }
  if (pinch != null && pinch < 10) {
    return {
      weakLink: 'thumb', cause: 'strength', confidence: 'med', title: TITLES.thumb,
      cues: ['Plate pinch 3×20–30с, 2–3×/нед, шаг +2.5–5%', 'Hub-подъёмы лёгкие 3×5 — аддуктор большого'],
      ruleNote: `Pinch-hold ${pinch}с < 10с — пиковая сила большого (ожидание +15–30% за 8–12 нед).`,
    };
  }
  if (farmer != null && farmer < 20) {
    return {
      weakLink: 'support_endurance', cause: 'endurance', confidence: 'med', title: TITLES.support_endurance,
      cues: ['Farmer 3×20–40м + вис 3×30–45с', 'Толстый гриф после тяг, не до (NSCA)'],
      ruleNote: `Farmer-hold ${farmer}с < 20с — support выносливость, не пик.`,
    };
  }
  if (pinch != null && pinch < 20) {
    return {
      weakLink: 'thumb', cause: 'endurance', confidence: 'low', title: TITLES.thumb,
      cues: ['Pinch-серии 3×30с + flips лёгкие', 'Шаг объёма +5–10%/нед, сухожилия 8–12 нед'],
      ruleNote: `Pinch-hold ${pinch}с — середина: держит, но плывёт.`,
    };
  }
  // P5: точка срыва как fallback (без тестов — низкая уверенность).
  // D9: crush-снаряды идут своим звеном, а не щипком/поддержкой.
  const crushLike = impl === 'coc_gripper' || impl === 'silver_bullet';
  if (fp === 'off_floor' || fp === 'close_fail') {
    if (crushLike) {
      return {
        weakLink: 'crush', cause: 'strength', confidence: 'low', title: TITLES.crush,
        cues: ['CoC: warm 10–12 → work 5–7 до отказа 1–3 сета → негативы'],
        ruleNote: 'Не закрыл — пик crush (нужен уровень CoC для уверенности).',
      };
    }
    return {
      weakLink: pinchImpl ? 'thumb' : 'fingers', cause: 'strength', confidence: 'low',
      title: pinchImpl ? TITLES.thumb : TITLES.fingers,
      cues: pinchImpl
        ? ['Макс-щипок: блок 5×3 тяж + холд 10с']
        : ['Макс-support: RT/axle 5×3 + DOH-тяги без лямок до 85%'],
      ruleNote: 'Срыв внизу — пик силы (нужна тест-батарея для уверенности).',
    };
  }
  if (fp === 'hold_short' || fp === 'hold_long' || fp === 'mid') {
    if (crushLike) {
      return {
        weakLink: 'crush', cause: 'endurance', confidence: 'low', title: TITLES.crush,
        cues: ['Silver-hold на время + work-подходы CoC'],
        ruleNote: 'Срыв в удержании эспандера — crush-выносливость.',
      };
    }
    return {
      weakLink: 'support_endurance', cause: 'endurance', confidence: 'low', title: TITLES.support_endurance,
      cues: ['Холды 30–60с + carries 20–50м', 'Отдых 90–120с между хватовыми сетами'],
      ruleNote: 'Срыв в удержании — выносливость (подтверди farmer/pinch-hold).',
    };
  }
  if (fp === 'lockout') {
    return {
      weakLink: 'support_endurance', cause: 'strength', confidence: 'low', title: TITLES.support_endurance,
      cues: ['Локаут: стойка прямо, 1с фиксация каждый подход', 'Hip hinge: таз дожимает, хват не тянет один'],
      ruleNote: 'Падает на стойке — связка хват + hinge (проверь hipHingePoor).',
    };
  }
  if (faults.length === 1) {
    return {
      weakLink: 'technique', cause: 'technique', confidence: 'med', title: TITLES.technique,
      cues: [`Убрать фол: ${faults[0]}`],
      ruleNote: 'Один фол — чинится кью за сессию.',
    };
  }
  return {
    weakLink: 'fingers', cause: 'fatigue', confidence: 'low', title: TITLES.fingers,
    cues: ['Данных мало: вбей точку срыва + 1 холд-тест', 'Делод хвату 50% на неделю при застое'],
    ruleNote: 'Без точки срыва и тестов — только общий support-объём.',
  };
}
