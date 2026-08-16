/**
 * CardioParamsStep.tsx — шаг 1 мастера кардио: цель, горизонт, восстановление,
 * быстрые старты (пресеты), ручная структура фаз и живой предпросмотр.
 */
import React, { useMemo } from 'react';
import {
  buildCardioCycle, cardioCycleSummary, CARDIO_GOAL_LABELS, CARDIO_PRESETS,
  CARDIO_LEVEL_LABELS, CARDIO_EQUIPMENT_OPTIONS,
  type CardioCycle, type CardioGoal, type CardioLevel, type CardioEquipment,
} from '../../../engines/lms/cardio.engine';
import type { CardioCompetitionRef } from '../../../engines/lms/cardio.engine';

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const BTN: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 40, whiteSpace: 'nowrap',
};
const PRESET: React.CSSProperties = {
  flex: '1 1 130px', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)',
};
const GOAL_CARD: React.CSSProperties = {
  flex: '1 1 140px', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)',
};
const GOAL_CARD_ACTIVE: React.CSSProperties = {
  ...GOAL_CARD, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff',
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
  onReset: () => void;
}> = ({ goal, setGoal, totalWeeks, setTotalWeeks, daysAvailable, setDaysAvailable, recoveryLow, setRecoveryLow, phaseSplit, setPhaseSplit, comps, bodyWeight, setBodyWeight, taperWeeks, peakWeek, level, setLevel, equipment, setEquipment, lowImpact, setLowImpact, age, setAge, sex, setSex, restingHr, setRestingHr, onReset }) => {
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
        phaseSplit: phaseSplit.auto ? undefined : { base: phaseSplit.base, build: phaseSplit.build, maintenance: phaseSplit.maintenance },
        source: 'auto',
      });
      return { cycle, warnings };
    } catch { return { cycle: null, warnings }; }
  }, [goal, totalWeeks, daysAvailable, recoveryLow, comps, phaseSplit, bodyWeight, taperWeeks, peakWeek, level, equipment, lowImpact, age, restingHr, sex]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Быстрые старты */}
      <div style={CARD}>
        <div style={LABEL}>⚡ Быстрые старты</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CARDIO_PRESETS.map(p => (
            <div key={p.id} style={PRESET} onClick={() => applyPreset(p.id)} role="button" aria-label={`Пресет: ${p.name}`}>
              <div style={{ fontSize: 11, fontWeight: 800 }}>{p.icon} {p.name}</div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={CARD}>
        <div style={LABEL}>🎯 Цель цикла</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(CARDIO_GOAL_LABELS) as CardioGoal[]).map(g => (
            <div key={g} style={goal === g ? GOAL_CARD_ACTIVE : GOAL_CARD} onClick={() => setGoal(g)} role="button" aria-label={`Цель: ${CARDIO_GOAL_LABELS[g]}`}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{CARDIO_GOAL_LABELS[g]}</div>
              <div style={{ fontSize: 10, marginTop: 3, lineHeight: 1.35, opacity: 0.75 }}>{GOAL_DESC[g]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={CARD}>
        <div style={LABEL}>⏱ Горизонт</div>
        <div style={ROW}>
          <span style={LABEL}>Недель</span>
          <button style={BTN} onClick={() => setTotalWeeks(Math.max(1, totalWeeks - 1))} aria-label="Меньше недель">−</button>
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 34, textAlign: 'center' }}>{totalWeeks}</span>
          <button style={BTN} onClick={() => setTotalWeeks(Math.min(52, totalWeeks + 1))} aria-label="Больше недель">+</button>
          <span style={{ ...LABEL, marginLeft: 12 }}>Дней в неделю</span>
          <button style={BTN} onClick={() => setDaysAvailable(Math.max(0, daysAvailable - 1))} aria-label="Меньше дней">−</button>
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{daysAvailable}</span>
          <button style={BTN} onClick={() => setDaysAvailable(Math.min(7, daysAvailable + 1))} aria-label="Больше дней">+</button>
          <span style={{ ...LABEL, marginLeft: 12 }}>Вес (кг)</span>
          <input type="number" value={bodyWeight} onChange={e => setBodyWeight(Math.max(30, Math.min(300, Number(e.target.value) || 80)))} inputMode="numeric" style={{ width: 70, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }} aria-label="Вес" />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          Вес влияет на оценку расхода калорий кардио-сессий.
        </div>
      </div>

      {/* Структура фаз */}
      <div style={CARD}>
        <div style={LABEL}>🧩 Структура фаз</div>
        <div style={ROW}>
          <button
            style={phaseSplit.auto ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : BTN}
            onClick={() => setPhaseSplit({ ...phaseSplit, auto: true })}
          >Авто (по долям)</button>
          <button
            style={!phaseSplit.auto ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : BTN}
            onClick={() => setPhaseSplit({ ...phaseSplit, auto: false })}
          >Вручную</button>
        </div>
        {!phaseSplit.auto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['base', 'build', 'maintenance'] as const).map(k => (
              <div key={k} style={ROW}>
                <span style={{ ...LABEL, minWidth: 120 }}>{k === 'base' ? '🌱 База' : k === 'build' ? '📈 Наращивание' : '🧘 Поддержание'}</span>
                <button style={BTN} onClick={() => setPhaseSplit({ ...phaseSplit, [k]: Math.max(0, phaseSplit[k] - 1) })} aria-label={`Меньше ${k}`}>−</button>
                <span style={{ fontSize: 14, fontWeight: 800, minWidth: 26, textAlign: 'center' }}>{phaseSplit[k]}</span>
                <button style={BTN} onClick={() => setPhaseSplit({ ...phaseSplit, [k]: Math.min(Math.max(1, totalWeeks - 2), phaseSplit[k] + 1) })} aria-label={`Больше ${k}`}>+</button>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>нед</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              Итого распределено: {phaseSplit.base + phaseSplit.build + phaseSplit.maintenance} нед (сверх — поддерживающие; taper/пик задаются стартами).
            </div>
          </div>
        )}
      </div>

      <div style={CARD}>
        <div style={LABEL}>🧘 Восстановление</div>
        <button
          style={recoveryLow ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : BTN}
          onClick={() => setRecoveryLow(!recoveryLow)}
        >
          {recoveryLow ? '🧘 Низкое восстановление (HIIT убран)' : '🟢 Восстановление в норме'}
        </button>
      </div>

      {/* Персонализация: уровень, оборудование, суставы, возраст */}
      <div style={CARD}>
        <div style={LABEL}>👤 Параметры пользователя</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          Возраст/пол/вес/ЧСС покоя — в карточке «👤» над мастером (кнопки «📋 Из профиля» / «💾 В профиль»).
        </div>
        <div style={ROW}>
          <span style={LABEL}>Пол</span>
          <button
            style={sex === 'male' ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : BTN}
            onClick={() => setSex('male')}
            aria-label="Пол: мужской"
          >♂ Мужской</button>
          <button
            style={sex === 'female' ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : BTN}
            onClick={() => setSex('female')}
            aria-label="Пол: женский"
          >♀ Женский</button>
          <span style={{ ...LABEL, marginLeft: 10 }}>ЧСС покоя</span>
          <input type="number" value={restingHr} onChange={e => setRestingHr(e.target.value)} inputMode="numeric" style={{ width: 70, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }} aria-label="ЧСС покоя" />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          Пол и ЧСС покоя уточняют пульс-зоны (Karvonen): женщины — ЧССмакс 226−возраст.
        </div>
      </div>

      <div style={CARD}>
        <div style={LABEL}>🎚 Уровень подготовки</div>
        <div style={ROW}>
          {(Object.keys(CARDIO_LEVEL_LABELS) as CardioLevel[]).map(l => (
            <button
              key={l}
              style={level === l ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : BTN}
              onClick={() => setLevel(l)}
            >
              {CARDIO_LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          Новичок — объём ×0.8, продвинутый — ×1.15.
        </div>
      </div>

      <div style={CARD}>
        <div style={LABEL}>🏃 Оборудование (до 3)</div>
        <div style={ROW}>
          {CARDIO_EQUIPMENT_OPTIONS.map(e => (
            <button
              key={e.id}
              style={equipment.includes(e.id) ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : { ...BTN, opacity: lowImpact && e.impact === 'high' ? 0.4 : 1 }}
              onClick={() => toggleEquipment(e.id)}
              disabled={lowImpact && e.impact === 'high'}
              aria-label={`Оборудование: ${e.label}`}
            >
              {e.icon} {e.label}
            </button>
          ))}
        </div>
        <button
          style={lowImpact ? { ...BTN, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff' } : BTN}
          onClick={() => setLowImpact(!lowImpact)}
        >
          {lowImpact ? '🦴 Щадить суставы: вкл' : 'Щадить суставы: выкл'}
        </button>
        <div style={ROW}>
          <span style={LABEL}>Возраст (пульс-зоны)</span>
          <input type="number" value={age} onChange={e => setAge(e.target.value)} inputMode="numeric" style={{ width: 70, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12 }} aria-label="Возраст" />
        </div>
      </div>

      {/* Живой предпросмотр */}
      <div style={{ ...CARD, borderColor: 'rgba(0,230,138,0.25)' }}>
        <div style={ROW}>
          <span style={LABEL}>👁 Предпросмотр цикла</span>
          <button style={{ ...BTN, minHeight: 30, padding: '4px 10px' }} onClick={onReset} aria-label="Сбросить параметры">⟲ Сбросить</button>
        </div>
        {s && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ flex: '1 1 80px', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>НЕДЕЛЬ</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#22c55e' }}>{totalWeeks}</div>
            </div>
            <div style={{ flex: '1 1 80px', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>МИН/НЕД</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#3b82f6' }}>{s.avgMinutesPerWeek}</div>
            </div>
            <div style={{ flex: '1 1 80px', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>ККАЛ/НЕД</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>{s.avgKcalPerWeek}</div>
            </div>
            <div style={{ flex: '1 1 80px', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>HIIT-НЕД</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>{s.hiitWeeks}</div>
            </div>
            <div style={{ flex: '1 1 80px', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>ЦЕЛЬ</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8' }}>{CARDIO_GOAL_LABELS[goal]}</div>
            </div>
          </div>
        )}
        {preview.warnings.map((w, i) => (
          <div key={i} style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '5px 8px' }} role="alert">⚠ {w}</div>
        ))}
      </div>
    </div>
  );
};
