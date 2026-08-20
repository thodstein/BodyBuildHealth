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
  cardioFitnessForecast,
  type CardioCycle, type CardioGoal, type CardioLevel, type CardioEquipment,
} from '../../../engines/lms/cardio.engine';
import type { CardioCompetitionRef, CardioPhase } from '../../../engines/lms/cardio.engine';
import {
  ROW, LABEL, HINT, BTN_SMALL, INPUT, CHIP, CHIP_ACTIVE, PHASE_COLOR,
  SectionCard, StatTile, GroupHeading, SectionNav, InfoBanner,
  NumberInput, SelectInput, Stepper,
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
  bb_prep: 'Прогрессия Zone 2 + MISS/HIIT на дефиците — подготовка ББ к шоу',
  pl_prep: 'Умеренный Zone 2 + MISS, без HIIT — не утомлять ЦНС к старту',
  bb_taper: '4 нед плавного снижения объёма (0.85→0.4) — тапер ББ к шоу',
};

export interface PhaseSplitState { auto: boolean; base: number; build: number; maintenance: number }

export interface CardioPreviewFactors {
  sleepHours?: number;
  stressLevel?: number;
  hrvMs?: number;
  enhanced?: boolean;
  autoLowImpact?: boolean;
  jointIssues?: boolean;
}

const PHASE_ORDER: { phase: CardioPhase; label: string }[] = [
  { phase: 'base', label: 'База' },
  { phase: 'build', label: 'Наращивание' },
  { phase: 'contest_prep', label: 'Prep' },
  { phase: 'maintenance', label: 'Поддержание' },
  { phase: 'taper', label: 'Taper' },
  { phase: 'peak', label: 'Пик' },
  { phase: 'transition', label: 'Переход' },
];

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
  setTaperWeeks: (n: number) => void;
  taperEnabled: boolean;
  setTaperEnabled: (v: boolean) => void;
  peakWeek: boolean;
  setPeakWeek: (v: boolean) => void;
  previewFactors?: CardioPreviewFactors;
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
  onFromProfile: () => void;
  onSaveProfile: () => void;
  onFromDiaryHr: () => void;
  onReset: () => void;
}> = ({ goal, setGoal, totalWeeks, setTotalWeeks, daysAvailable, setDaysAvailable, recoveryLow, setRecoveryLow, phaseSplit, setPhaseSplit, comps, bodyWeight, setBodyWeight, taperWeeks, setTaperWeeks, taperEnabled, setTaperEnabled, peakWeek, setPeakWeek, previewFactors, level, setLevel, equipment, setEquipment, lowImpact, setLowImpact, age, setAge, sex, setSex, restingHr, setRestingHr, legDays, setLegDays, factorsOn, onToggleFactor, factorsSummary, onFromProfile, onSaveProfile, onFromDiaryHr, onReset }) => {
  const preview: { cycle: CardioCycle | null; warnings: string[] } = useMemo(() => {
    const warnings: string[] = [];
    if (totalWeeks < 4) warnings.push('Цикл короче 4 недель — базовая фаза почти отсутствует.');
    for (const c of comps) {
      if (taperEnabled && c.week < taperWeeks + 1) warnings.push(`Старт «${c.name}» на неделе ${c.week} — taper (${taperWeeks} нед) не влезает.`);
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
        taper: taperEnabled,
        peakWeek,
        level,
        equipment,
        lowImpact,
        age: ageNum,
        restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
        sex,
        legDays,
        ...previewFactors,
        phaseSplit: phaseSplit.auto ? undefined : { base: phaseSplit.base, build: phaseSplit.build, maintenance: phaseSplit.maintenance },
        source: 'auto',
      });
      if (daysAvailable > 0 && daysAvailable < 7) {
        const cutWeeks = cycle.weeks.filter(w => w.rationale.some(r => r.includes('сессии урезаны')));
        if (cutWeeks.length > 0) {
          warnings.push(`Дней в неделю (${daysAvailable}) меньше запрошенной частоты — сессии урезаны на ${cutWeeks.length} нед.`);
        }
      }
      return { cycle, warnings };
    } catch { return { cycle: null, warnings }; }
  }, [goal, totalWeeks, daysAvailable, recoveryLow, comps, phaseSplit, bodyWeight, taperWeeks, taperEnabled, peakWeek, previewFactors, level, equipment, lowImpact, age, restingHr, sex, legDays]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionNav items={NAV} />

      {/* ── 1. Параметры пользователя ── */}
      <GroupHeading icon="👤" text="Параметры пользователя" desc="Возраст, пол, вес, ЧСС покоя, уровень и восстановление — основа для пульс-зон и объёма." />
      <SectionCard id="sec-user" title="👤 Параметры пользователя" right={
        <div style={ROW}>
          <button style={BTN_SMALL} onClick={onFromProfile} title="Загрузить возраст/вес/пол/ЧСС покоя из профиля" aria-label="Из профиля">📋 Из профиля</button>
          <button style={BTN_SMALL} onClick={onFromDiaryHr} title="ЧСС покоя из последней записи дневника АД" aria-label="Из дневника АД">❤️ Из дневника АД</button>
          <button style={{ ...BTN_SMALL, borderColor: 'rgba(0,230,138,0.5)', color: '#00e68a' }} onClick={onSaveProfile} title="Сохранить возраст/вес/пол/ЧСС покоя в профиль" aria-label="В профиль">💾 В профиль</button>
        </div>
      }>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <NumberInput
            label="Возраст"
            value={age}
            onChange={setAge}
            min={12}
            max={90}
            step={1}
            placeholder="30"
            ariaLabel="Возраст"
            width={90}
            suffix="лет"
          />
          <NumberInput
            label="Вес (кг)"
            value={String(bodyWeight)}
            onChange={v => setBodyWeight(Math.max(30, Math.min(300, Number(v) || 80)))}
            min={30}
            max={300}
            step={0.5}
            placeholder="80"
            ariaLabel="Вес"
            width={100}
            suffix="кг"
          />
          <NumberInput
            label="ЧСС покоя"
            value={restingHr}
            onChange={setRestingHr}
            min={30}
            max={120}
            step={1}
            placeholder="60"
            ariaLabel="ЧСС покоя"
            width={100}
            suffix="уд/мин"
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <div style={ROW}>
            <span style={LABEL}>Пол</span>
            <button style={sex === 'male' ? CHIP_ACTIVE : CHIP} onClick={() => setSex('male')} aria-label="Пол: мужской">♂ Мужской</button>
            <button style={sex === 'female' ? CHIP_ACTIVE : CHIP} onClick={() => setSex('female')} aria-label="Пол: женский">♀ Женский</button>
          </div>
          <div style={ROW}>
            <span style={LABEL}>Уровень</span>
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
        </div>
        <div style={HINT}>Пол и ЧСС покоя уточняют пульс-зоны (Karvonen): женщины — ЧССмакс 226−возраст. Уровень: новичок ×0.8, продвинутый ×1.15.</div>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Stepper
            label="Недель"
            value={totalWeeks}
            min={1}
            max={52}
            step={1}
            onChange={setTotalWeeks}
            ariaPrefix="Недель"
            suffix="нед"
            width={50}
          />
          <Stepper
            label="Дней в неделю"
            value={daysAvailable}
            min={0}
            max={7}
            step={1}
            onChange={setDaysAvailable}
            ariaPrefix="Дней"
            suffix="дн"
            width={50}
          />
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
        <div style={HINT}>При «щадить суставы» высокоударный бег недоступен и заменяется низкоударным видом.</div>
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
          <span style={{ flex: 1 }} />
          <button style={taperEnabled ? CHIP_ACTIVE : CHIP} onClick={() => setTaperEnabled(!taperEnabled)} aria-label="Taper перед стартом">
            {taperEnabled ? '📉 Taper: вкл' : 'Taper: выкл'}
          </button>
          <button style={peakWeek ? CHIP_ACTIVE : CHIP} onClick={() => setPeakWeek(!peakWeek)} aria-label="Пик-неделя старта">
            {peakWeek ? '🏔 Пик-неделя: вкл' : 'Пик-неделя: выкл'}
          </button>
        </div>
        {taperEnabled && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
            <Stepper
              label="Недель taper"
              value={taperWeeks}
              min={1}
              max={4}
              step={1}
              onChange={setTaperWeeks}
              ariaPrefix="Недель taper"
              suffix="нед"
              width={50}
            />
          </div>
        )}
        {!phaseSplit.auto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {(['base', 'build', 'maintenance'] as const).map(k => (
              <div key={k} style={ROW}>
                <span style={{ ...LABEL, minWidth: 120 }}>{k === 'base' ? '🌱 База' : k === 'build' ? '📈 Наращивание' : '🧘 Поддержание'}</span>
                <Stepper
                  value={phaseSplit[k]}
                  min={0}
                  max={Math.max(1, totalWeeks - 2)}
                  step={1}
                  onChange={v => setPhaseSplit({ ...phaseSplit, [k]: v })}
                  ariaPrefix={k}
                  suffix="нед"
                  width={50}
                />
              </div>
            ))}
            {(() => {
              const sum = phaseSplit.base + phaseSplit.build + phaseSplit.maintenance;
              const compWeeks = comps.reduce((s, c) => s + Math.max(0, taperWeeks), 0);
              const available = Math.max(0, totalWeeks - compWeeks);
              if (sum > available) {
                return (
                  <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 8px' }} role="alert">
                    ⚠ Сумма фаз ({sum} нед) больше доступных недель цикла ({available} нед
                    {compWeeks > 0 ? `, из них ${compWeeks} нед занято taper/пиком стартов` : ''}). Цикл будет короче — сократите фазы или увеличьте горизонт.
                  </div>
                );
              }
              if (sum < available && available > 0) {
                return (
                  <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '6px 8px' }} role="status">
                    ⚠ Распределено {sum} нед из {available} — оставшиеся {available - sum} нед будут поддержанием.
                  </div>
                );
              }
              return null;
            })()}
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
            {preview.cycle && (
              <StatTile label="+VO2MAX" value={`+${cardioFitnessForecast(preview.cycle).vo2GainPct}%`} color="#60a5fa" />
            )}
          </div>
        )}
        {preview.cycle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={ROW}>
              <span style={LABEL}>🗺 Фазы по неделям</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: taperEnabled ? '#eab308' : 'rgba(255,255,255,0.6)', fontWeight: 800 }}>
                {taperEnabled ? `📉 taper ${taperWeeks} нед${peakWeek ? ' + пик' : ''}` : 'без taper'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 2, flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {preview.cycle.weeks.map(w => (
                <div key={w.week} style={{ flex: '1 0 10px', minWidth: 8, height: 18, borderRadius: 3, background: PHASE_COLOR[w.phase] ?? '#888', opacity: w.deload ? 0.55 : 1 }} title={`Нед ${w.week} · ${w.phase}${w.deload ? ' · делод' : ''}${w.taper ? ' · taper' : ''}`} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PHASE_ORDER.filter(p => (s?.phaseWeeks[p.phase] ?? 0) > 0).map(p => (
                <span key={p.phase} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: PHASE_COLOR[p.phase] }} />
                  {p.label} · {s?.phaseWeeks[p.phase]}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(96,165,250,0.8)', lineHeight: 1.4 }}>
              📈 Прогноз адаптации: +{cardioFitnessForecast(preview.cycle).vo2GainPct}% VO2max за цикл ({cardioFitnessForecast(preview.cycle).effectiveWeeks} рабочих нед) — ориентир, зависит от выполнения.
            </div>
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
