/**
 * CardioParamsStep.tsx — шаг 1 мастера кардио v3.
 * Progressive disclosure: 3 слоя — Основное (открыто), Расширенное (свёрнуто), Итог (hero).
 * 5 аккордеонов вместо 9, sticky сводка, объединённые секции.
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
  ROW, LABEL, HINT_SM, BTN_SMALL, CHIP, CHIP_ACTIVE, PHASE_COLOR, TYPE_COLOR,
  SectionCard, StatTile, SectionNav, InfoBanner, Accordion, Badge, HeroCard,
  NumberInput, Stepper, CARD_HERO,
} from './CardioUI';

const GOAL_CARD: React.CSSProperties = {
  flex: '1 1 140px', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)', color: '#fff',
  transition: 'all 0.15s ease',
};
const GOAL_CARD_ACTIVE: React.CSSProperties = {
  ...GOAL_CARD, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.12)', color: '#fff',
  boxShadow: '0 0 12px rgba(0,230,138,0.14)',
};
const PRESET: React.CSSProperties = {
  flex: '0 0 152px', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)', color: '#fff',
  transition: 'all 0.15s ease',
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
    { id: 'sec-goal', label: '🎯 Цель' },
    { id: 'sec-horizon', label: '⏱ Горизонт и фазы' },
    { id: 'sec-equip', label: '🏃 Оборудование' },
    { id: 'sec-factors', label: '📊 Факторы' },
    { id: 'sec-preview', label: '👁 Итог' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionNav items={NAV} />
      {!preview.cycle && comps.length === 0 && (
        <InfoBanner tone="info">👋 Подсказка: выберите цель (например, Сушка) → пресет «Сушка 16 нед» → проверьте предпросмотр → «Далее» и соберите цикл.</InfoBanner>
      )}

      {/* ── 1. Пользователь — открыт ── */}
      <Accordion id="sec-user" title="Параметры пользователя" icon="👤" defaultOpen badge={<span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{age}л · {bodyWeight}кг · {CARDIO_LEVEL_LABELS[level]}</span>}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={BTN_SMALL} onClick={onFromProfile} title="Загрузить из профиля">📋 Из профиля</button>
          <button style={BTN_SMALL} onClick={onFromDiaryHr} title="ЧСС покоя из дневника АД">❤️ Из АД</button>
          <button style={{ ...BTN_SMALL, borderColor: 'rgba(0,230,138,0.45)', color: '#00e68a' }} onClick={onSaveProfile} title="Сохранить в профиль">💾 В профиль</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <NumberInput label="Возраст" value={age} onChange={setAge} min={12} max={90} step={1} placeholder="30" ariaLabel="Возраст" width={90} suffix="лет" />
          <NumberInput label="Вес (кг)" value={String(bodyWeight)} onChange={v => setBodyWeight(Math.max(30, Math.min(300, Number(v) || 80)))} min={30} max={300} step={0.5} placeholder="80" ariaLabel="Вес" width={100} suffix="кг" />
          <NumberInput label="ЧСС покоя" value={restingHr} onChange={setRestingHr} min={30} max={120} step={1} placeholder="60" ariaLabel="ЧСС покоя" width={100} suffix="уд/мин" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
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
              {recoveryLow ? '🧘 Низкое' : '🟢 В норме'}
            </button>
          </div>
        </div>
        <div style={HINT_SM}>Karvonen: ЧССмакс 220−возраст (жен. 226−). Уровень меняет объём: новичок ×0.8 / продвинутый ×1.15.</div>
      </Accordion>

      {/* ── 2. Цель + пресеты — открыто ── */}
      <Accordion id="sec-goal" title="Цель цикла и быстрые старты" icon="🎯" defaultOpen badge={<Badge bg={TYPE_COLOR[goal] ? TYPE_COLOR[goal] + '22' : undefined} border={TYPE_COLOR[goal] ? TYPE_COLOR[goal] + '44' : undefined} color={TYPE_COLOR[goal] ?? '#fff'}>{CARDIO_GOAL_LABELS[goal]}</Badge>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 8 }}>
          {(Object.keys(CARDIO_GOAL_LABELS) as CardioGoal[]).map(g => (
            <div key={g} style={goal === g ? GOAL_CARD_ACTIVE : GOAL_CARD} onClick={() => setGoal(g)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGoal(g); } }} aria-pressed={goal === g} aria-label={`Цель: ${CARDIO_GOAL_LABELS[g]}`}>
              <div style={{ fontSize: 12, fontWeight: 850, letterSpacing: -0.1 }}>{CARDIO_GOAL_LABELS[g]}</div>
              <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.4, color: 'rgba(255,255,255,0.62)' }}>{GOAL_DESC[g]}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginTop: 4 }}>⚡ Быстрые старты</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin' }}>
          {CARDIO_PRESETS.map(p => (
            <div key={p.id} style={PRESET} onClick={() => applyPreset(p.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyPreset(p.id); } }} aria-label={`Пресет: ${p.name}`}>
              <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{p.icon} {p.name}</div>
              <div style={{ fontSize: 10, marginTop: 3, color: 'rgba(255,255,255,0.62)', lineHeight: 1.35 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </Accordion>

      {/* ── 3. Горизонт и фазы — открыто ── */}
      <Accordion id="sec-horizon" title="Горизонт и Структура фаз" icon="⏱" defaultOpen>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <Stepper label="Недель" value={totalWeeks} min={1} max={52} step={1} onChange={setTotalWeeks} ariaPrefix="Недель" suffix="нед" width={50} />
          <Stepper label="Дней/нед" value={daysAvailable} min={0} max={7} step={1} onChange={setDaysAvailable} ariaPrefix="Дней" suffix="дн" width={50} />
        </div>
        <div style={HINT_SM}>Дней в неделю ограничивает частоту — приоритет zone2 → recovery → miss → hiit.</div>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Stepper label="Недель taper" value={taperWeeks} min={1} max={4} step={1} onChange={setTaperWeeks} ariaPrefix="Недель taper" suffix="нед" width={50} />
          </div>
        )}
        {!phaseSplit.auto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['base', 'build', 'maintenance'] as const).map(k => (
              <div key={k} style={ROW}>
                <span style={{ ...LABEL, minWidth: 120 }}>{k === 'base' ? '🌱 База' : k === 'build' ? '📈 Наращивание' : '🧘 Поддержание'}</span>
                <Stepper value={phaseSplit[k]} min={0} max={Math.max(1, totalWeeks - 2)} step={1} onChange={v => setPhaseSplit({ ...phaseSplit, [k]: v })} ariaPrefix={k} suffix="нед" width={50} />
              </div>
            ))}
            {(() => {
              const sum = phaseSplit.base + phaseSplit.build + phaseSplit.maintenance;
              const compWeeks = comps.reduce((s, c) => s + Math.max(0, taperWeeks), 0);
              const available = Math.max(0, totalWeeks - compWeeks);
              if (sum > available) {
                return (
                  <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 8px' }} role="alert">
                    ⚠ Сумма фаз ({sum} нед) &gt; доступно {available} нед{compWeeks > 0 ? `, из них ${compWeeks} нед taper/пик` : ''} — сократите фазы или увеличьте горизонт.
                  </div>
                );
              }
              if (sum < available && available > 0) {
                return (
                  <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '6px 8px' }} role="status">
                    Распределено {sum} нед из {available} — оставшиеся {available - sum} нед поддержание.
                  </div>
                );
              }
              return null;
            })()}
            <div style={HINT_SM}>Итого распределено: {phaseSplit.base + phaseSplit.build + phaseSplit.maintenance} нед.</div>
          </div>
        )}
      </Accordion>

      {/* ── 4. Оборудование и дни ног — всегда открыт для юзабилити ── */}
      <SectionCard title="🏃 Оборудование и ограничения" id="sec-equip">
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>Оборудование</div>
        <div style={ROW}>
          {CARDIO_EQUIPMENT_OPTIONS.map(e => (
            <button key={e.id} style={equipment.includes(e.id) ? CHIP_ACTIVE : { ...CHIP, opacity: lowImpact && e.impact === 'high' ? 0.35 : 1 }} onClick={() => toggleEquipment(e.id)} disabled={lowImpact && e.impact === 'high'} aria-label={`Оборудование: ${e.label}`}>
              {e.icon} {e.label}
            </button>
          ))}
        </div>
        <button style={lowImpact ? CHIP_ACTIVE : CHIP} onClick={() => setLowImpact(!lowImpact)}>
          {lowImpact ? '🦴 Щадить суставы: вкл' : 'Щадить суставы: выкл'}
        </button>
        <div style={HINT_SM}>Низкоударный режим убирает бег и меняет ккал/мин (ходьба ×0.44, вело ×0.77).</div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>🦵 Дни тяжёлых ног</div>
        <div style={ROW}>
          {DAY_LABELS_RU.map((d, i) => (
            <button key={d} style={legDays.includes(i) ? CHIP_ACTIVE : CHIP} onClick={() => setLegDays(legDays.includes(i) ? legDays.filter(x => x !== i) : [...legDays, i])} aria-label={`Ноги: ${d}`}>
              {d}
            </button>
          ))}
        </div>
        <div style={HINT_SM}>Zone2/MISS/HIIT не ставятся на эти дни; recovery — можно. {legDays.length > 0 ? `Выбрано: ${legDays.map(i => DAY_LABELS_RU[i]).join(', ')}` : ''}</div>
      </SectionCard>

      {/* ── 5. Факторы — свёрнуто ── */}
      <Accordion id="sec-factors" title="Факторы восстановления и курса" icon="📊" badge={factorsSummary.length > 0 ? <Badge bg="rgba(96,165,250,0.13)" border="rgba(96,165,250,0.28)" color="#60a5fa">{factorsSummary.length} активно</Badge> : undefined}>
        <div style={ROW}>
          <button style={factorsOn.sleep ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('sleep')} aria-label="Фактор: сон">😴 Сон</button>
          <button style={factorsOn.stress ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('stress')} aria-label="Фактор: стресс">😣 Стресс</button>
          <button style={factorsOn.hrv ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('hrv')} aria-label="Фактор: HRV">📉 HRV</button>
          <button style={factorsOn.ped ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('ped')} aria-label="Фактор: PED-курс">💉 PED</button>
          <button style={factorsOn.joints ? CHIP_ACTIVE : CHIP} onClick={() => onToggleFactor('joints')} aria-label="Фактор: суставы">🦴 Суставы</button>
        </div>
        {factorsSummary.length > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
            {factorsSummary.map((sm, i) => <div key={i}>• {sm}</div>)}
          </div>
        )}
        <div style={HINT_SM}>Сон &lt;6ч ×0.9 · стресс ≥7 ×0.95+noHIIT · HRV&lt;25 ×0.9 · PED ×1.05 · суставы → lowImpact.</div>
      </Accordion>

      {/* ── Hero Итог — всегда открыт ── */}
      <div style={CARD_HERO} id="sec-preview">
        <div style={ROW}>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>👁 Предпросмотр цикла</span>
          <span style={{ flex: 1 }} />
          <button style={BTN_SMALL} onClick={onReset} aria-label="Сбросить параметры">⟲ Сбросить</button>
        </div>
        {s ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <StatTile label="НЕДЕЛЬ" value={String(totalWeeks)} color="#22c55e" />
            <StatTile label="МИН/НЕД" value={String(s.avgMinutesPerWeek)} color="#3b82f6" />
            <StatTile label="ККАЛ/НЕД" value={String(s.avgKcalPerWeek)} color="#f59e0b" />
            <StatTile label="HIIT-НЕД" value={String(s.hiitWeeks)} color="#a78bfa" />
            <StatTile label="ЦЕЛЬ" value={CARDIO_GOAL_LABELS[goal]} color="#94a3b8" />
            {preview.cycle && <StatTile label="+VO2MAX" value={`+${cardioFitnessForecast(preview.cycle).vo2GainPct}%`} color="#60a5fa" sub={`${cardioFitnessForecast(preview.cycle).effectiveWeeks} нед`} />}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)' }}>Заполните параметры — появится сводка.</div>
        )}
        {preview.cycle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={ROW}>
              <span style={LABEL}>🗺 Фазы по неделям</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: taperEnabled ? '#eab308' : 'rgba(255,255,255,0.72)', fontWeight: 800 }}>
                {taperEnabled ? `📉 taper ${taperWeeks} нед${peakWeek ? ' + пик' : ''}` : 'без taper'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 2, flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0' }}>
              {preview.cycle.weeks.map(w => (
                <div key={w.week} style={{ flex: '1 0 10px', minWidth: 8, height: 18, borderRadius: 4, background: PHASE_COLOR[w.phase] ?? '#888', opacity: w.deload ? 0.5 : 1, boxShadow: w.deload ? 'inset 0 0 0 1px rgba(255,255,255,0.18)' : 'none' }} title={`Нед ${w.week} · ${w.phase}${w.deload ? ' · делод' : ''}${w.taper ? ' · taper' : ''}`} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PHASE_ORDER.filter(p => (s?.phaseWeeks[p.phase] ?? 0) > 0).map(p => (
                <span key={p.phase} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: PHASE_COLOR[p.phase] }} />
                  {p.label} · {s?.phaseWeeks[p.phase]}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(96,165,250,0.9)', lineHeight: 1.45, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.14)', borderRadius: 8, padding: '6px 8px' }}>
              📈 Прогноз адаптации: +{cardioFitnessForecast(preview.cycle).vo2GainPct}% VO2max за {cardioFitnessForecast(preview.cycle).effectiveWeeks} рабочих нед — Прогноз адаптации VO2max
            </div>
          </div>
        )}
        {preview.warnings.map((w, i) => <InfoBanner key={i} tone="warn">⚠ {w}</InfoBanner>)}
        {s && <InfoBanner tone="ok">Готово — «Далее» → старты, затем предпросмотр детально.</InfoBanner>}
      </div>
    </div>
  );
};
