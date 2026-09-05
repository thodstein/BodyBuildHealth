/**
 * arm-matchup.engine.ts — TOP T1: матчап стилей (мой стиль vs стиль оппонента).
 *
 * Источники: TAWF/WAF (hook/toproll/press — единственные 3 техники),
 * Grokipedia EMG (pec major + pronator teres в hook; torque=force×lever),
 * Ezreal side-pressure (рука+спина сначала; tight vs open линии),
 * Mithril (cup/pron/rising раздельно + комбо), Devon drain-стратегия.
 *
 * Чистый модуль без импортов. Не меняет ядро билдера — только совет + патч объёма.
 */

export type MatchupMyStyle = 'hook' | 'toproll' | 'press' | 'balanced';
export type MatchupOppStyle = 'hook' | 'toproll' | 'press' | 'balanced' | 'unknown';
export type MatchupOppHand = 'high' | 'low' | 'neutral' | 'unknown';

export interface ArmMatchupInput {
  myTechnique?: string; // hook/toproll/press/balanced
  oppStyle?: string; // стиль оппонента (unknown = универсальная готовность)
  oppHand?: string; // high/low/neutral
  weightDeltaKg?: number; // + = оппонент тяжелее (сила), − = легче
  strapExpected?: boolean; // ожидается ремень (срыв хвата)
}

export interface ArmMatchupPlan {
  oppStyle: MatchupOppStyle;
  oppHand: MatchupOppHand;
  threat: string;
  priorityMuscles: string[]; // канон ArmMuscle, топ-4
  drills: string[]; // id упражнений каталога
  volumePatch: Record<string, number>; // множитель объёма мышцы (1.0 = без изменений)
  avoid: string[];
  gameplan: string[]; // 3-5 строк тактики
  note: string;
}

function normStyle(v: unknown): MatchupOppStyle {
  const s = String(v || 'unknown').toLowerCase();
  if (s === 'hook' || s === 'inside_hook' || s === 'хук') return 'hook';
  if (s === 'toproll' || s === 'top_roll' || s === 'outside_toproll' || s === 'топролл') return 'toproll';
  if (s === 'press' || s === 'пресс') return 'press';
  if (s === 'balanced' || s === 'баланс') return 'balanced';
  return 'unknown';
}

function normHand(v: unknown): MatchupOppHand {
  const s = String(v || 'unknown').toLowerCase();
  if (s === 'high' || s === 'высокая' || s === 'high_hand') return 'high';
  if (s === 'low' || s === 'низкая' || s === 'low_hand') return 'low';
  if (s === 'neutral' || s === 'нейтраль') return 'neutral';
  return 'unknown';
}

function normMy(v: unknown): MatchupMyStyle {
  const s = normStyle(v);
  return s === 'unknown' ? 'balanced' : (s as MatchupMyStyle);
}

/** Базовый контр-план по стилю оппонента (без учёта руки/веса). */
function baseCounter(opp: MatchupOppStyle): Pick<ArmMatchupPlan, 'threat' | 'priorityMuscles' | 'drills' | 'avoid' | 'gameplan'> {
  switch (opp) {
    case 'hook':
      return {
        threat: 'Хук: супинация+cup+back pressure, давит внутрь (риск локтевых связок при лобовой).',
        priorityMuscles: ['supinators', 'wrist_flexors', 'brachialis', 'back_pressure'],
        drills: ['supination_cable', 'hook_drag_cable', 'hammer_belt', 'lat_drag_belt'],
        avoid: ['Лобовой хук-в-хук без containment', 'side на блоке в тяжёлый день'],
        gameplan: [
          'Не отдавать cup: containment пальцев + сгибание к мизинцу/среднему.',
          'Супинация держит ладонь вверх — пронацию оппонента встречать супинацией, а не силой.',
          'Back pressure первым: тяга на себя, затем бок — не рвать вбок рано (Ezreal).',
        ],
      };
    case 'toproll':
      return {
        threat: 'Топролл: пронация+rise+атака пальцев, раскрывает кисть (эквалайзер против сильного).',
        priorityMuscles: ['pronators', 'risers', 'brachioradialis', 'back_pressure'],
        drills: ['pronation_cable', 'riser_curl', 'hammer_curl_thick', 'hook_drag_cable'],
        avoid: ['Открытая кисть (теряется leverage)', 'подъём плечом вместо rise'],
        gameplan: [
          'Rise держит высоту костяшек: нагрузка через указательную сторону (Mithril).',
          'Пронация защищает от разворота ладонью вверх — держать линию запястье-большой.',
          'Комбо pronation+rising в одной сессии: сначала раздельно, затем вместе.',
        ],
      };
    case 'press':
      return {
        threat: 'Пресс: side pressure + вес тела вперёд, финишёр (опасен при неправильном угле).',
        priorityMuscles: ['back_pressure', 'side_pressure', 'shoulder_stab', 'wrist_flexors'],
        drills: ['lat_drag_belt', 'cable_side_pressure', 'internal_rotation_band', 'isometric_table_pushdown_10s'],
        avoid: ['Ранний all-in вбок без hand control', 'открытые углы под нагрузкой'],
        gameplan: [
          'Не давать занять центр: back pressure + drag, не press в ответ.',
          'Side только поверх hand control: сначала cup/pron, затем бок (Ezreal).',
          'Держать closed-arm: кисть/локоть внутри линии плеча, глаза на кисти (GoldenGrip).',
        ],
      };
    case 'balanced':
      return {
        threat: 'Универсал: переходы hook↔toproll↔press по ходу матча.',
        priorityMuscles: ['wrist_flexors', 'pronators', 'supinators', 'back_pressure'],
        drills: ['hook_drag_cable', 'pronation_cable', 'supination_cable', 'lat_drag_belt'],
        avoid: ['Прокачка только сильнейшей линии', 'один РУ два дня подряд'],
        gameplan: [
          'Готовить переходы: pron↔sup и cup в каждой неделе (баланс ≤1.5×).',
          'Слабую линию держать по правилу взаимозависимости Кузнецова (слабые пучки тормозят сильные).',
          'Table time ≥50%: умеренная/тяжёлая/стресс недели 3/2/1.',
        ],
      };
    default:
      return {
        threat: 'Стиль неизвестен: готовим универсальную защиту руки.',
        priorityMuscles: ['wrist_flexors', 'pronators', 'risers', 'back_pressure'],
        drills: ['hook_drag_cable', 'pronation_cable', 'riser_curl', 'lat_drag_belt'],
        avoid: ['Узкая специализация до разведки'],
        gameplan: [
          'Закрыть базу: cup + pron + rising + back pressure.',
          'Первые недели — toproll-линия (новичкам hook грузит связки сильнее).',
          'Разведка: первый спарринг 70% — определить стиль, затем специализация.',
        ],
      };
  }
}

/**
 * Профиль оппонента → контр-план.
 * Чистая функция, детерминирована.
 */
export function profileOpponent(input: ArmMatchupInput = {}): ArmMatchupPlan {
  const opp = normStyle(input.oppStyle);
  const hand = normHand(input.oppHand);
  const my = normMy(input.myTechnique);
  const base = baseCounter(opp);
  const gameplan = [...base.gameplan];
  const avoid = [...base.avoid];
  const volumePatch: Record<string, number> = {};
  for (const m of base.priorityMuscles) volumePatch[m] = 1.25;
  // Коррекция под руку оппонента (Grokipedia high vs low hand)
  if (hand === 'high') {
    gameplan.push('High-hand: выигрывает leverage — отвечать rise + пронация, не тянуться вверх плечом.');
    volumePatch['risers'] = Math.max(volumePatch['risers'] || 1, 1.25);
    volumePatch['pronators'] = Math.max(volumePatch['pronators'] || 1, 1.2);
  } else if (hand === 'low') {
    gameplan.push('Low-hand: агрессивная ротация — держать closed-arm, встречать супинацией+cup.');
    volumePatch['supinators'] = Math.max(volumePatch['supinators'] || 1, 1.25);
    volumePatch['wrist_flexors'] = Math.max(volumePatch['wrist_flexors'] || 1, 1.2);
  }
  // Вес оппонента: тяжелее → drain-стратегия Larratt (длинные сеты, изометрия), легче → скорость
  const dw = Number(input.weightDeltaKg ?? 0);
  if (Number.isFinite(dw) && dw >= 5) {
    gameplan.push(`Оппонент +${dw} кг: drain — длинные pronation+rising сеты, статика в позиции срыва, не взрывать старт.`);
    avoid.push('Взрывной старт в лоб против более тяжёлого');
  } else if (Number.isFinite(dw) && dw <= -5) {
    gameplan.push(`Оппонент ${dw} кг: скорость — быстрый старт, F100-линия, короткий пиковый цикл.`);
  }
  // Ремень: containment + strap-сессии заранее
  if (input.strapExpected) {
    gameplan.push('Ремень ожидается: containment пальцев + cup, 1 strap-сессия в неделю заранее.');
    volumePatch['risers'] = Math.max(volumePatch['risers'] || 1, 1.15);
  }
  // Мой стиль vs его: подсказка перехода
  if (my === 'hook' && opp === 'toproll') gameplan.push('Хук vs топролл: нейтрализуй leverage — супинация+cup, не давай раскрыть кисть.');
  if (my === 'toproll' && opp === 'hook') gameplan.push('Топролл vs хук: классический эквалайзер — pronation+rise поверх, атака пальцев.');
  if (my === 'press' && opp !== 'press') gameplan.push('Пресс — финиш: сначала hand+back, бок только по выигранной позиции.');
  const note = `Матчап ${my} vs ${opp}${hand !== 'unknown' ? ` (${hand}-hand)` : ''}: приоритет ${base.priorityMuscles.slice(0, 2).join('+')}.`;
  return {
    oppStyle: opp,
    oppHand: hand,
    threat: base.threat,
    priorityMuscles: base.priorityMuscles,
    drills: base.drills,
    volumePatch,
    avoid,
    gameplan: gameplan.slice(0, 5),
    note,
  };
}

/** Патч объёма для билдера: множитель мышцы (1.0 если не в приоритете). */
export function matchupVolumeFor(muscle: string, plan: ArmMatchupPlan | null | undefined): number {
  if (!plan) return 1;
  const v = plan.volumePatch[muscle];
  return Number.isFinite(v) && (v as number) > 0 ? (v as number) : 1;
}

/** Проверка: контр-план покрывает угрозу (для тестов/аудита). */
export function matchupCoversThreat(plan: ArmMatchupPlan): boolean {
  return plan.priorityMuscles.length >= 3 && plan.drills.length >= 3 && plan.gameplan.length >= 3;
}
