/**
 * cardio-goal-templates.ts — генераторные шаблоны под цели конструктора.
 * Покрывают все 9 CardioGoal: health/mass/cut/recomp/maintenance/recovery/
 * bb_prep/pl_prep/bb_taper. Строятся движком buildCardioCycle из preset —
 * volumes, делоды, taper и пульс-зоны калибруются под атлета автоматически.
 */
import type { CardioCycleTemplate } from './cardio-cycle-types';
import type { CardioGoal } from '../../engines/lms/cardio.engine';

interface G {
  id: string;
  title: string;
  goal: CardioGoal;
  weeks: number;
  days: number;
  level: Array<'beginner' | 'intermediate' | 'advanced'>;
  sport: 'mixed' | 'run';
  period: 'base' | 'build' | 'mixed' | 'taper' | 'recovery';
  equipment: Array<'running' | 'cycling' | 'rowing' | 'elliptical' | 'walking' | 'swimming'>;
  lowImpact: boolean;
  desc: string;
  how: string;
  tags: string[];
  source: string;
}

const GEN: G[] = [
  {
    id: 'cardio-gen-health-8', title: 'Здоровье · 8 недель (3-4 д/нед)', goal: 'health', weeks: 8, days: 4,
    level: ['beginner', 'intermediate'], sport: 'mixed', period: 'base', equipment: ['walking', 'cycling'], lowImpact: true,
    desc: 'ССС и аэробная база без ударной нагрузки: ходьба/вело Zone 2.',
    how: 'Zone 2 3-4×/нед с прогрессией +4%/нед; суставы щадятся.',
    tags: ['health', 'base', 'low-impact'], source: 'Конструктор: пресет health-8, расширенный',
  },
  {
    id: 'cardio-gen-cut-16', title: 'Сушка · 16 недель (5 д/нед)', goal: 'cut', weeks: 16, days: 5,
    level: ['intermediate', 'advanced'], sport: 'mixed', period: 'build', equipment: ['running', 'cycling'], lowImpact: false,
    desc: 'Максимальный расход с сохранением мышц: Zone 2 + HIIT, делоды каждые 4 нед.',
    how: 'Zone 2 3×45 мин + HIIT 15 мин; объём +4%/нед до капа ×1.3.',
    tags: ['cut', 'fat-loss', 'hiit'], source: 'Конструктор: пресет cut-16, расширенный',
  },
  {
    id: 'cardio-gen-mass-12', title: 'Масса · 12 недель (1-2 д/нед)', goal: 'mass', weeks: 12, days: 2,
    level: ['beginner', 'intermediate', 'advanced'], sport: 'mixed', period: 'recovery', equipment: ['walking', 'cycling'], lowImpact: true,
    desc: 'Только восстановление: кровоток без конкуренции с ростом.',
    how: 'Recovery 20 мин 1-2×/нед; объём фиксирован (без прогрессии).',
    tags: ['mass', 'recovery', 'low-volume'], source: 'Конструктор: пресет mass-12, расширенный',
  },
  {
    id: 'cardio-gen-recomp-12', title: 'Рекомпозиция · 12 недель (3 д/нед)', goal: 'recomp', weeks: 12, days: 3,
    level: ['beginner', 'intermediate'], sport: 'mixed', period: 'mixed', equipment: ['running', 'cycling', 'rowing'], lowImpact: false,
    desc: 'Умеренный Zone 2 для ССС и восстановления без дефицита.',
    how: 'Zone 2 30 мин 2-3×/нед; баланс расхода и восстановления.',
    tags: ['recomp', 'base'], source: 'Конструктор: цель recomp, расширенная',
  },
  {
    id: 'cardio-gen-maintenance-12', title: 'Поддержание · 12 недель (3 д/нед)', goal: 'maintenance', weeks: 12, days: 3,
    level: ['beginner', 'intermediate', 'advanced'], sport: 'mixed', period: 'mixed', equipment: ['running', 'cycling', 'swimming'], lowImpact: false,
    desc: 'Форма круглый год: Zone 2 + эпизодический темп.',
    how: 'Zone 2 2-3×/нед; MISS в build-фазе для аэробной выносливости.',
    tags: ['maintenance', 'year-round'], source: 'Конструктор: цель maintenance, расширенная',
  },
  {
    id: 'cardio-gen-recovery-4', title: 'Восстановление · 4 недели (3 д/нед)', goal: 'recovery', weeks: 4, days: 3,
    level: ['beginner', 'intermediate', 'advanced'], sport: 'mixed', period: 'recovery', equipment: ['walking', 'swimming', 'cycling'], lowImpact: true,
    desc: 'Лёгкий кровоток после тяжёлого блока: HIIT убран.',
    how: 'Recovery 30 мин 3×/нед; фиксированный лёгкий объём.',
    tags: ['recovery', 'deload'], source: 'Конструктор: пресет recovery-4, расширенный',
  },
  {
    id: 'cardio-gen-bb-prep-12', title: 'Подготовка ББ · 12 недель (4 д/нед)', goal: 'bb_prep', weeks: 12, days: 4,
    level: ['intermediate', 'advanced'], sport: 'mixed', period: 'build', equipment: ['cycling', 'running'], lowImpact: false,
    desc: 'Прогрессия Zone 2 + MISS/HIIT на дефиците; собирается и из prep-плана кнопкой «Из prep».',
    how: 'Zone 2 растёт к шоу; финальная taper-кривая; белок ≥2.2 г/кг.',
    tags: ['bb', 'prep', 'cut'], source: 'Конструктор: пресет bb-prep-12, расширенный',
  },
  {
    id: 'cardio-gen-pl-prep-8', title: 'Подготовка ПЛ · 8 недель (3 д/нед)', goal: 'pl_prep', weeks: 8, days: 3,
    level: ['intermediate', 'advanced'], sport: 'mixed', period: 'build', equipment: ['cycling', 'rowing'], lowImpact: true,
    desc: 'Умеренный Zone 2 + MISS без утомления ЦНС к помосту.',
    how: 'Zone 2 30 мин + MISS 20 мин; HIIT нет; taper к старту.',
    tags: ['pl', 'prep', 'cns-friendly'], source: 'Конструктор: пресет pl-prep-8, расширенный',
  },
  {
    id: 'cardio-gen-bb-taper-4', title: 'Тапер ББ · 4 недели (3 д/нед)', goal: 'bb_taper', weeks: 4, days: 3,
    level: ['beginner', 'intermediate', 'advanced'], sport: 'mixed', period: 'taper', equipment: ['walking', 'cycling'], lowImpact: true,
    desc: 'Плавное снижение 0.9 → 0.6 к шоу: лёгкое Zone 2, привычка движения.',
    how: 'Кривая BB_CARDIO_TAPER_CURVE (step/exponential на выбор).',
    tags: ['bb', 'taper', 'peak-week'], source: 'Конструктор: пресет bb-taper-4, расширенный',
  },
];

export const CARDIO_GOAL_TEMPLATES: CardioCycleTemplate[] = GEN.map(g => ({
  meta: {
    id: g.id, title: g.title, goal: g.goal, weeks: g.weeks, sessionsPerWeek: g.days,
    level: g.level, sport: g.sport, period: g.period, equipment: g.equipment,
    lowImpact: g.lowImpact, kind: 'generator',
    description: g.desc, howItWorks: g.how,
    conditions: [`${g.days} д/нед`], tags: g.tags, sourceLabel: g.source,
  },
  preset: {
    goal: g.goal, totalWeeks: g.weeks, daysAvailable: g.days,
    level: g.level[0] === 'beginner' && g.level.length > 1 ? 'intermediate' : g.level[0],
    equipment: g.equipment, lowImpact: g.lowImpact,
  },
}));
