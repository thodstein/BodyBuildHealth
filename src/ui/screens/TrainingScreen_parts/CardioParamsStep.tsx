/**
 * CardioParamsStep.tsx — шаг 1 мастера кардио. Логичный порядок секций:
 * 1) параметры пользователя, 2) выбор цели и быстрые старты, 3) горизонт,
 * 4) оборудование, 5) дни ног, 6) факторы, 7) структура фаз, 8) итог.
 * Вертикальные секции с заголовками, единый стиль (CardioUI), навигация.
 */
import React, { useMemo } from 'react';
import {
  buildCardioCycle, cardioCycleSummary, CARDIO_GOAL_LABELS, CARDIO_PRESETS,
  CARDIO_LEVEL_LABELS, CARDIO_EQUIPMENT_OPTIONS, DAY_LABELS_RU,
  type CardioCycle, type CardioGoal, type CardioLevel, type CardioEquipment,
} from '../../../engines/lms/cardio.engine';
import type { CardioCompetitionRef } from '../../../engines/lms/cardio.engine';
import {
  ROW, LABEL, HINT, BTN_SMALL, INPUT, CHIP, CHIP_ACTIVE,
  SectionCard, StatTile, GroupHeading, SectionNav, InfoBanner,
} from './CardioUI';

const GOAL_CARD: React.CSSProperties = {
  flex: '1 1 140px', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)',
};
const GOAL_CARD_ACTIVE: React.CSSProperties = {
  ...GOAL_CARD, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff',
};
const PRESET: React.CSSProperties = {
  flex: '1 1 130px', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)',
};

const GOAL_DESC: Record<CardioGoal, string> = {
  health: '3-4× Zone 2, аэробная база для здоровья ССС',
  mass: 'Минимум кардио — только восстановление, не мешает росту',
  cut: 'Прогрессия Zone 2 2×30 → 3×45 + HIIT, делоды каждые 4 нед',
  recomp: 'Умеренное Zone 2 2×25-30, здоровье без вреда для набора',
  maintenance: 'Стабильное Zone 2 2×30, поддержание ССС',
  recovery: 'Лёгкое кардио 2-3× для кровотока и мобильности',
};

export interface PhaseSplitState { auto: boolean; base: number; build: number; maintenance: number }

export const CardioParamsStep: React.FC<{
  goal: CardioGoal;
  setGoal: (g: CardioGoal) => void;
  totalWeeks: number;
  setTotalWeeks: (n: number) => void;
  daysAvailable: number;
  setDaysAvailable: (n: number) => void;
  recoveryLow: boolean;
  setRecoveryLow: (v: boolean) => void;
  phaseSplit: PhaseSplitState;
  setPhaseSplit: (s: PhaseSplitState) => void;
  comps: CardioCompetitionRef[];
  bodyWeight: number;
  setBodyWeight: (n: number) => void;
  taperWeeks: number;
  peakWeek: boolean;
  level: CardioLevel;
  setLevel: (l: CardioLevel) => void;
  equipment: CardioEquipment[];
  setEquipment: (e: CardioEquipment[]) => void;
  lowImpact: boolean;
  setLowImpact: (v: boolean) => void;
  age: string;
  setAge: (v: string) => void;
  sex: 'male' | 'female';
  setSex: (s: 'male' | 'female') => void;
  restingHr: string;
  setRestingHr: (v: string) => void;
  legDays: number[];
  setLegDays: (d: number[]) => void;
  factorsOn: { sleep: boolean; stress: boolean; hrv: boolean; ped: boolean; joints: boolean };
  onToggleFactor: (key: keyof { sleep: boolean; stress: boolean; hrv: boolean; ped: boolean; joints: boolean }) => void;
  factorsSummary: string[];
  onReset: () => void;
}> = ({ goal, setGoal, totalWeeks, setTotalWeeks, daysAvailable, setDaysAvailable, recoveryLow, setRecoveryLow, phaseSplit, setPhaseSplit, comps, bodyWeight, setBodyWeight, taperWeeks, peakWeek, level, setLevel, equipment, setEquipment, lowImpact, setLowImpact, age, setAge, sex, setSex, restingHr, setRestingHr, legDays, setLegDays, factorsOn, onToggleFactor, factorsSummary, onReset }) => {
  const preview: { cycle: CardioCycle | null; warnings: string[] } = useMemo(() => {
    const warnings: string[] = [];
    if (totalWeeks < 4) warnings.push('Цикл короче 4 недель — базовая фаза почти отсутствует.');
    for (const c of comps) {
      if (c.week < taperWeeks + 1) warnings.push(`Старт «${c.name}» на неделе ${c.week} — taper (${taperWeeks} нед) не влезает.`);
    }
    if (lowImpact && equipment.includes('running')) {
      warnings.push('«Щадить суставы» включено, но выбран бег — бег заменяется низкоударным видом.');
    }
    const ageNum = Math.max(12, Math.min(90, Number(age) || 30));
    try {
      const cycle = buildCardioCycle({
        goal,
        totalWeeks,
        daysAvailable,
        recoveryLow,
        bodyWeight,
        competitions: comps,
        taperWeeks,
        peakWeek,
        level,
        equipment,
        lowImpact,
        age: ageNum,
        restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
        sex,
        legDays,
        phaseSplit: phaseSplit.auto ? undefined : { base: phaseSplit.base, build: phaseSplit.build, maintenance: phaseSplit.maintenance },
        source: 'auto',
      });
      return { cycle, warnings };
    } catch { return { cycle: null, warnings }; }
  }, [goal, totalWeeks, daysAvailable, recoveryLow, comps, phaseSplit, bodyWeight, taperWeeks, peakWeek, level, equipment, lowImpact, age, restingHr, sex, legDays]);

  const s = preview.cycle ? cardioCycleSummary(preview.cycle) : null;
  const applyPreset = (id: string) => {
    const p = CARDIO_PRESETS.find(x => x.id === id);
    if (!p) return;
    setGoal(p.goal);
    setTotalWeeks(p.totalWeeks);
    setDaysAvailable(p.daysAvailable);
    setRecoveryLow(p.recoveryLow);
  };

  const toggleEquipment = (e: CardioEquipment) => {
    if (equipment.includes(e)) setEquipment(equipment.filter(x => x !== e));
    else if (equipment.length < 3) setEquipment([...equipment, e]);
  };

  const NAV = [
    { id: 'sec-user', label: '👤 Пользователь' },
    { id: 'sec-goal', label: '🎯 Выбор цели' },
    { id: 'sec-start', label: '⚡ Старты' },
    { id: 'sec-horizon', label: '⏱ Горизонт' },
    { id: 'sec-equip', label: '🏃 Оборудование' },
    { id: 'sec-nog', label: '🦵 Дни ног' },
    { id: 'sec-factors', label: '📊 Факторы' },
    { id: 'sec-phases', label: '🧩 Фазы' },
    { id: 'sec-preview', label: '👁 Итог' },
  ];

  const numInput = (w: number): React.CSSProperties => ({ ...INPUT, width: w });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionNav items={NAV} />

      {/* ── 1. Параметры пользователя ── */}
      <GroupHeading icon="👤" text="Параметры пользователя" desc="Возраст, пол, вес, ЧСС покоя, уровень и восстановление — основа для пульс-зон и объёма." />
      <SectionCard id="sec-user" title="👤 Параметры пользователя">
        <div style={ROW}>
          <span style={LABEL}>Возраст</span>
          <input type="number" value={age} onChange={e => setAge(e.target.value)} inputMode="numeric" style={numInput(70)} aria-label="Возраст" />
          <span style={{ ...LABEL, marginLeft: 12 }}>Вес (кг)</span>
          <input type="number" value={bodyWeight} onChange={e => setBodyWeight(Math.max(30, Math.min(300, Number(e.target.value) || 80)))} inputMode="numeric" style={numInput(70)} aria-label="Вес" />
          <span style={{ ...LABEL, marginLeft: 12 }}>ЧСС покоя</span>
          <input type="number" value={restingHr} onChange={e => setRestingHr(e.target.value)} inputMode="numeric" style={numInput(70)} aria-label="ЧСС покоя" />
        </div>
        <div style={ROW}>
          <span style={LABEL}>Пол</span>
          <button style={sex === 'male' ? CHIP_ACTIVE : CHIP} onClick={() => setSex('male')} aria-label="Пол: мужской">♂ Мужской</button>
          <button style={sex === 'female' ? CHIP_ACTIVE : CHIP} onClick={() => setSex('female')} aria-label="Пол: женский">♀ Женский</button>
          <span style={{ ...LABEL, marginLeft: 12 }}>Уровень</span>
          {(Object.keys(CARDIO_LEVEL_LABELS) as CardioLevel[]).map(l => (
            <button key={l} style={level === l ? CHIP_ACTIVE : CHIP} onClick={() => setLevel(l)}>{CARDIO_LEVEL_LABELS[l]}</button>
          ))}
        </div>
        <div style={ROW}>
          <span style={LABEL}>Восстановление</span>
          <button style={recoveryLow ? CHIP_ACTIVE : CHIP} onClick={() => setRecoveryLow(!recoveryLow)}>
            {recoveryLow ? '🧘 Низкое (HIIT убран)' : '🟢 В норме'}
          </button>
        </div>
        <div style={HINT}>Пол и ЧСС покоя уточняют пульс-зоны (Karvonen): женщины — ЧССмакс 226−возраст. Уровень: новичок ×0.8, продвинутый ×1.15. Можно загрузить из профиля в карточке «👤» над мастером.</div>
      </SectionCard>

      {/* ── 2. Выбор цели ── */}
      <GroupHeading icon="🎯" text="Выбор цели" desc="Определяет профиль объёма (Zone 2 / HIIT / восстановление)." />
      <SectionCard id="sec-goal" title="🎯 Цель цикла">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(CARDIO_GOAL_LABELS) as CardioGoal[]).map(g => (
            <div key={g} style={goal === g ? GOAL_CARD_ACTIVE : GOAL_CARD} onClick={() => setGoal(g)} role="button" aria-label={`Цель: ${CARDIO_GOAL_LABELS[g]}`}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{CARDIO_GOAL_LABELS[g]}</div>
              <div style={{ fontSize: 10, marginTop: 3, lineHeight: 1.35, opacity: 0.75 }}>{GOAL_DESC[g]}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── 3. Быстрые старты ── */}
      <GroupHeading icon="⚡" text="Быстрые старты" desc="Готовые шаблоны — подстроят цель, горизонт и восстановление." />
      <SectionCard id="sec-start" title="Готовые пресеты">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CARDIO_PRESETS.map(p => (
            <div key={p.id} style={PRESET} onClick={() => applyPreset(p.id)} role="button" aria-label={`Пресет: ${p.name}`}>
              <div style={{ fontSize: 11, fontWeight: 800 }}>{p.icon} {p.name}</div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── 4. Горизонт ── */}
      <GroupHeading icon="⏱" text="Горизонт" desc="Длительность цикла и доступные дни в неделю." />
      <SectionCard id="sec-horizon" title="⏱ Горизонт">
        <div style={ROW}>
          <span style={LABEL}>Недель</span>
          <button style={BTN_SMALL} onClick={() => setTotalWeeks(Math.max(1, totalWeeks - 1))} aria-label="Меньше недель">−</button>
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 34, textAlign: 'center' }}>{totalWeeks}</span>
          <button style={BTN_SMALL} onClick={() => setTotalWeeks(Math.min(52, totalWeeks + 1))} aria-label="Больше недель">+</button>
          <span style={{ ...LABEL, marginLeft: 12 }}>Дней в неделю</span>
          <button style={BTN_SMALL} onClick={() => setDaysAvailable(Math.max(0, daysAvailable - 1))} aria-label="Меньше дней">−</button>
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{daysAvailable}</span>
          <button style={BTN_SMALL} onClick={() => setDaysAvailable(Math.min(7, daysAvailable + 1))} aria-label="Больше дней">+</button>
        </div>
        <div style={HINT}>Вес влияет на оценку расхода калорий кардио-сессий (задается в параметрах пользователя).</div>
      </SectionCard>

      {/* ── 5. Оборудование ── */}
      <GroupHeading icon="🏃" text="Оборудование" desc="Виды кардио и режим «щадить суставы» (низкоударные)." />
      <SectionCard id="sec-equip" title="🏃 Оборудование (до 3)">
        <div style={ROW}>
          {CARDIO_EQUIPMENT_OPTIONS.map(e => (
            <button
              key={e.id}
              style={equipment.includes(e.id) ? CHIP_ACTIVE : { ...CHIP, opacity: lowImpact && e.impact === 'high' ? 0.4 : 1 }}
              onClick={() => toggleEquipment(e.id)}
              disabled={lowImpact && e.impact === 'high'}
              aria-label={`Оборудование: ${e.label}`}
            >
              {e.icon} {e.label}
            </button>
          ))}
        </div>
        <button style={lowImpact ? CHIP_ACTIVE : CHIP} onClick={() => setLowImpact(!lowImpact)}>
          {lowImpact ? '🦴 Щадить суставы: вкл' : 'Щадить суставы: выкл'}
        </button>
        <div style={HINT}>При «щадить суставы» высокоударный бег недоступен и заменяется низкоуударным видом.</div>
      </SectionCard>

      {/* ── 6. Дни ног ── */}
      <GroupHeading icon="🦵" text="Дни тяжёлых ног" desc="Интенсивное кардио не ставится на силовые дни ног." />
      <SectionCard id="sec-nog" title="Дни тяжёлых ног">
        <div style={ROW}>
          {DAY_LABELS_RU.map((d, i) => (
            <button
              key={d}
              style={legDays.includes(i) ? CHIP_ACTIVE : CHIP}
              onClick={() => setLegDays(legDays.includes(i) ? legDays.filter(x => x !== i) : [...legDays, i])}
              aria-label={`Ноги: ${d}`}
            >
              {d}
            </button>
          ))}
        </div>
        <div style={HINT}>Zone 2 / MISS / HIIT не попадут на эти дни; recovery — в любой день.</div>
      </SectionCard>

      {/* ── 7. Факторы ── */}
      <GroupHeading icon="📊" text="Факторы восстановления и курса" desc="Из профиля: сон, стресс, HRV, PED, суставы." />
      <SectionCard id="sec-factors" title="📊 Факторы (восстановление и курс)">
        <div style={ROW}>
          <button style={factorsOn.sleep ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('sleep')} aria-label="Фактор: сон">😴 Сон</button>
          <button style={factorsOn.stress ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('stress')} aria-label="Фактор: стресс">😣 Стресс</button>
          <button style={factorsOn.hrv ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('hrv')} aria-label="Фактор: HRV">📉 HRV</button>
          <button style={factorsOn.ped ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('ped')} aria-label="Фактор: PED-курс">💉 PED</button>
          <button style={factorsOn.joints ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('joints')} aria-label="Фактор: суставы">🦴 Суставы</button>
        </div>
        {factorsSummary.length > 0 && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            {factorsSummary.map((s, i) => <div key={i}>• {s}</div>)}
          </div>
        )}
        <div style={HINT}>Сон {'<'}6 ч → ×0.9; стресс ≥7 → HIIT убран, ×0.95; низкий HRV → ×0.9; PED → ×1.05; суставы → низкоударный.</div>
      </SectionCard>

      {/* ── 8. Структура фаз ── */}
      <GroupHeading icon="🧩" text="Структура фаз" desc="Доли фаз в цикле: авто или вручную." />
      <SectionCard id="sec-phases" title="🧩 Структура фаз">
        <div style={ROW}>
          <button style={phaseSplit.auto ? CHIP_ACTIVE : CHIP} onClick={() => setPhaseSplit({ ...phaseSplit, auto: true })}>Авто (по долям)</button>
          <button style={!phaseSplit.auto ? CHIP_ACTIVE : CHIP} onClick={() => setPhaseSplit({ ...phaseSplit, auto: false })}>Вручную</button>
        </div>
        {!phaseSplit.auto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['base', 'build', 'maintenance'] as const).map(k => (
              <div key={k} style={ROW}>
                <span style={{ ...LABEL, minWidth: 120 }}>{k === 'base' ? '🌱 База' : k === 'build' ? '📈 Наращивание' : '🧘 Поддержание'}</span>
                <button style={BTN_SMALL} onClick={() => setPhaseSplit({ ...phaseSplit, [k]: Math.max(0, phaseSplit[k] - 1) })} aria-label={`Меньше ${k}`}>−</button>
                <span style={{ fontSize: 14, fontWeight: 800, minWidth: 26, textAlign: 'center' }}>{phaseSplit[k]}</span>
                <button style={BTN_SMALL} onClick={() => setPhaseSplit({ ...phaseSplit, [k]: Math.min(Math.max(1, totalWeeks - 2), phaseSplit[k] + 1) })} aria-label={`Больше ${k}`}>+</button>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>нед</span>
              </div>
            ))}
            <div style={HINT}>Итого распределено: {phaseSplit.base + phaseSplit.build + phaseSplit.maintenance} нед (сверх — поддерживающие; taper/пик задаются стартами).</div>
          </div>
        )}
      </SectionCard>

      {/* ── 9. Предпросмотр ── */}
      <GroupHeading icon="👁" text="Итог" desc="Мгновенный расчёт цикла по текущим параметрам." />
      <SectionCard id="sec-preview" accent title="👁 Предпросмотр цикла" right={
        <button style={BTN_SMALL} onClick={onReset} aria-label="Сбросить параметры">⟲ Сбросить</button>
      }>
        {s && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <StatTile label="НЕДЕЛЬ" value={String(totalWeeks)} color="#22c55e" />
            <StatTile label="МИН/НЕД" value={String(s.avgMinutesPerWeek)} color="#3b82f6" />
            <StatTile label="ККАЛ/НЕД" value={String(s.avgKcalPerWeek)} color="#f59e0b" />
            <StatTile label="HIIT-НЕД" value={String(s.hiitWeeks)} color="#a78bfa" />
            <StatTile label="ЦЕЛЬ" value={CARDIO_GOAL_LABELS[goal]} color="#94a3b8" />
          </div>
        )}
        {preview.warnings.map((w, i) => (
          <InfoBanner key={i} tone="warn">⚠ {w}</InfoBanner>
        ))}
        {s && <InfoBanner tone="ok">Собранный цикл готов — «Далее» перейдёт к стартам, затем к предпросмотру.</InfoBanner>}
      </SectionCard>
    </div>
  );
};
