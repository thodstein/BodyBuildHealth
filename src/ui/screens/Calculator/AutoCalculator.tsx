import React, { useMemo, useState, useCallback } from 'react';
import type { CalculatorState, CalculatorResult, LabSlice } from '../../../engines/support-plan';
import { calculateSupportTZ, hydrateState } from '../../../engines/support-plan';
import { PHARMA_DB, PHARMA_CLASSES } from '../../../core/pharma-database';
import { getProfile } from '../../../core/profile-manager';
import { GLASS, BADGE, DEFAULT_STATE } from './Calc.types';
import type { AutoCalculatorProps } from './Calc.types';
import { Card } from './Calc.parts';
import { MechanismView } from './Calc.result';
import { deriveStateFromLabs } from './Calc.labs-derived';
import { CalcMapperCard } from './Calc.mapper';

export const AutoCalculator: React.FC<AutoCalculatorProps> = ({ onApply, embedded, courseWeek: propWeek, courseLinked, labsLinked }) => {
  const [state, setState] = useState<CalculatorState>(() => {
    const h = hydrateState();
    return { ...DEFAULT_STATE, ...h, profile: { ...DEFAULT_STATE.profile, ...(h.profile || {}) }, pharma: { ...DEFAULT_STATE.pharma, ...(h.pharma || {}) }, labs: { ...DEFAULT_STATE.labs, ...(h.labs || {}), fullPanel: h.labs?.fullPanel || DEFAULT_STATE.labs.fullPanel } };
  });
  const [fillStatus, setFillStatus] = useState('');
  const [autoFromLabs, setAutoFromLabs] = useState(true);
  const [labDerivedFields, setLabDerivedFields] = useState<string[]>([]);
  const [labSyncFlash, setLabSyncFlash] = useState(false);
  const lastFullPanelRef = React.useRef<string>('');

  const effectiveWeek = propWeek || Math.min(state.goals.cycleWeeks || 12, Math.max(1, ...state.pharma.aas.map(a => a.weeks || 12), 6));

  const result = useMemo<CalculatorResult>(() => calculateSupportTZ({ ...state, courseWeek: effectiveWeek }), [state, effectiveWeek]);

  React.useEffect(() => {
    try {
      localStorage.setItem('he_autocalc_state', JSON.stringify(state));
    } catch {}
  }, [state]);

  React.useEffect(() => {
    if (!courseLinked || courseLinked.length === 0) return;
    const aasClasses = ['testosterone','nandrolone','trenbolone','oral_17aa','dht','sarm'];
    const linkedAas = courseLinked
      .filter(c => {
        const ph = (PHARMA_DB as any)[c.substanceId];
        return ph?.class && aasClasses.includes(ph.class);
      })
      .map(c => ({
        id: c.substanceId,
        doseMgWeek: (c.doseValue || 0) * (c.frequency || 1),
        weeks: (c.endWeek || 12) - (c.startWeek || 0),
        startWeek: c.startWeek || 1,
        endWeek: c.endWeek || 12,
      }));
    if (linkedAas.length === 0) return;
    setState(s => {
      const existingIds = new Set(s.pharma.aas.map(a => a.id));
      const newAas = linkedAas.filter(a => !existingIds.has(a.id));
      if (newAas.length === 0) return s;
      return { ...s, pharma: { ...s.pharma, aas: [...s.pharma.aas, ...newAas] } };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseLinked]);

  React.useEffect(() => {
    const fp = state.labs.fullPanel;
    if (!fp || !autoFromLabs) { setLabDerivedFields([]); return; }
    const fpStr = JSON.stringify(fp);
    if (fpStr === lastFullPanelRef.current) return;
    lastFullPanelRef.current = fpStr;
    const derived = deriveStateFromLabs(fp);
    if (derived.derivedFields.length === 0) { setLabDerivedFields([]); return; }
    setState(s => ({
      ...s,
      hepatobiliary: { ...s.hepatobiliary, ...derived.hepatobiliary },
      cardio: { ...s.cardio, ...derived.cardio },
      urinary: { ...s.urinary, ...derived.urinary },
      goals: { ...s.goals, ...derived.goals },
      contraindications: { ...s.contraindications, ...derived.contraindications },
    }));
    setLabDerivedFields(derived.derivedFields);
    setLabSyncFlash(true);
    setTimeout(() => setLabSyncFlash(false), 1800);
  }, [state.labs.fullPanel, autoFromLabs]);

  const update = <K extends keyof CalculatorState>(key: K, val: CalculatorState[K]) => setState(s => ({ ...s, [key]: val }));
  const uProf = (v: Partial<CalculatorState['profile']>) => setState(s => ({ ...s, profile: { ...s.profile, ...v } }));
  const uPharm = (v: Partial<CalculatorState['pharma']>) => setState(s => ({ ...s, pharma: { ...s.pharma, ...v } }));
  const uGoals = (v: Partial<CalculatorState['goals']>) => setState(s => ({ ...s, goals: { ...s.goals, ...v } }));

  const fillProfile = () => {
    try {
      const p = getProfile();
      const s = p?.settings || (p as any);
      uProf({
        weight: s.weight ?? 80,
        age: s.age ?? 30,
        sex: (s.sex === 'female' ? 'female' : 'male') as any,
        workoutsPerWeek: s.workoutsPerWeek ?? 3,
        avgWorkoutMinutes: s.avgWorkoutMinutes ?? 60,
      });
      const goalMap: Record<string, string> = { 'bulk':'mass','mass':'mass','hypertrophy':'mass','strength':'mass','cut':'cut','maintenance':'maintenance','support':'maintenance','endurance':'endurance','recomposition':'mass' };
      const goalRaw = s.trainingCycleGoal || s.primaryGoal || s.goal || 'mass';
      uGoals({
        trainingCycle: (goalMap[goalRaw] || 'mass') as any,
        cycleWeeks: s.cycleWeeks ?? 12,
        previousCycles: s.previousCycles ?? 0,
        timeSinceLastCycle: (s.timeSinceLastCycle || 'none') as any,
      });
      setFillStatus('✅ Профиль и цели заполнены'); setTimeout(() => setFillStatus(''), 2000);
    } catch { setFillStatus('❌ Нет данных профиля'); setTimeout(() => setFillStatus(''), 2000); }
  };

  const fillPharma = () => {
    try {
      if (!courseLinked || courseLinked.length === 0) { setFillStatus('❌ Нет активного курса'); setTimeout(() => setFillStatus(''), 2000); return; }
      const aasClasses = ['testosterone','nandrolone','trenbolone','oral_17aa','dht','sarm'];
      const linkedAas = courseLinked.filter(c => { const ph = (PHARMA_DB as any)[c.substanceId]; return ph?.class && aasClasses.includes(ph.class); }).map(c => ({ id: c.substanceId, doseMgWeek: (c.doseValue || 0) * (c.frequency || 1), weeks: (c.endWeek || 12) - (c.startWeek || 0), startWeek: c.startWeek || 1, endWeek: c.endWeek || 12 }));
      const hasHCG = !!courseLinked.find(c => c.substanceId === 'hcg');
      const hasAI = !!courseLinked.find(c => ['anastrozole','letrozole','exemestane'].includes(c.substanceId));
      const hasSERM = !!courseLinked.find(c => ['tamoxifen','clomiphene','enclomiphene'].includes(c.substanceId));
      uPharm({ aas: linkedAas, hasHCG: hasHCG || state.pharma.hasHCG, hasAI: hasAI || state.pharma.hasAI, hasSERM: hasSERM || state.pharma.hasSERM, phase: 'course' as any });
      setFillStatus(`✅ Курс: ${linkedAas.length} ААС`); setTimeout(() => setFillStatus(''), 2000);
    } catch { setFillStatus('❌ Ошибка курса'); setTimeout(() => setFillStatus(''), 2000); }
  };

  const fillLabs = () => {
    try {
      let src: any = labsLinked as any;
      if (!src) {
        try { src = JSON.parse(localStorage.getItem('he_labs_history') || '[]')[0]; } catch { src = null; }
      }
      if (!src) { setFillStatus('❌ Нет анализов'); setTimeout(() => setFillStatus(''), 2000); return; }
      if (src.panelBiochem || src.panelSex || src.panelHematology) {
        update('labs', { ...state.labs, fullPanel: src });
        setFillStatus('✅ Анализы загружены'); setTimeout(() => setFillStatus(''), 2000);
      } else { setFillStatus('❌ Неверный формат'); setTimeout(() => setFillStatus(''), 2000); }
    } catch { setFillStatus('❌ Ошибка анализов'); setTimeout(() => setFillStatus(''), 2000); }
  };

  return (
    <div style={embedded ? {} : { padding: '0 12px 80px', maxWidth: 600, margin: '0 auto' }}>
      {!embedded && <div style={{ marginBottom: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🧮 Калькулятор поддержки</div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight:1.4 }}>Механизм-ориентированная модель ТЗ-28: лабы → 28 механизмов → отбор веществ по k×breadth → фаза → guardrails → бустеры</div>
      </div>}

      {/* Автозаполнение — карточка как у старого калькулятора */}
      <Card icon="⚡" title="Автозаполнение" defaultOpen={true} cols={3}>
        <button onClick={fillProfile} style={{
          background: 'var(--bg-primary)',
          border: '2px solid rgba(0,230,138,0.2)',
          borderRadius: 10,
          padding: '10px 6px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          minHeight: 64,
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 18 }}>👤</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)' }}>Сведения</span>
          <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>из профиля</span>
        </button>
        <button onClick={fillPharma} style={{
          background: 'var(--bg-primary)',
          border: '2px solid rgba(0,230,138,0.2)',
          borderRadius: 10,
          padding: '10px 6px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          minHeight: 64,
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 18 }}>💉</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)' }}>Фарма курс</span>
          <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>из активного курса</span>
        </button>
        <button onClick={fillLabs} style={{
          background: 'var(--bg-primary)',
          border: '2px solid rgba(0,230,138,0.2)',
          borderRadius: 10,
          padding: '10px 6px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          minHeight: 64,
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: 18 }}>🧪</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)' }}>Анализы</span>
          <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>из лаборатории</span>
        </button>
      </Card>
      {fillStatus && <div style={{ fontSize:9, color:'#00e68a', textAlign:'center', marginBottom:6, fontWeight: 700 }}>{fillStatus}</div>}

      {/* Тоггл авто из анализов */}
      <div style={{ ...GLASS, padding: '6px 10px', marginBottom: 6, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <button onClick={() => setAutoFromLabs(!autoFromLabs)}
          style={{ padding:'4px 10px', borderRadius:16, fontSize:9, fontWeight:700, cursor:'pointer',
            background: autoFromLabs ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${autoFromLabs ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: autoFromLabs ? '#00e68a' : 'var(--text-dim)' }}>
          🤖 Авто из анализов: {autoFromLabs ? 'ВКЛ' : 'ВЫКЛ'}
        </button>
        {labDerivedFields.length > 0 && <span style={{ fontSize:8, color:'#00e68a' }}>✓ {labDerivedFields.length} полей синхр.</span>}
        {labSyncFlash && <span style={{ fontSize:8, color:'#00e68a', fontWeight:700 }}>✓ Применено</span>}
      </div>

      {/* Данные курса — краткая сводка (не карточка ввода) */}
      {state.pharma.aas.length > 0 && (
        <div style={{ ...GLASS, padding: '6px 10px', marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>💉 Курс: {state.pharma.aas.length} ААС · фаза: {state.pharma.phase}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {state.pharma.aas.map((a, i) => {
              const phName = (PHARMA_DB as any)[a.id]?.name || a.id;
              return <span key={i} style={BADGE('rgba(99,102,241,0.1)')}>{phName} {a.doseMgWeek}мг/{a.weeks}н</span>;
            })}
            {state.pharma.hasHCG && <span style={BADGE('rgba(168,85,247,0.1)')}>ХГЧ</span>}
            {state.pharma.hasAI && <span style={BADGE('rgba(245,158,11,0.1)')}>АИ</span>}
            {state.pharma.hasSERM && <span style={BADGE('rgba(34,197,94,0.1)')}>СЕРМ</span>}
          </div>
        </div>
      )}

      {/* Данные анализов — краткая сводка (не карточка ввода) */}
      {state.labs.fullPanel && (
        <div style={{ ...GLASS, padding: '6px 10px', marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>🧪 Анализы загружены</div>
          {labDerivedFields.length > 0 && autoFromLabs && (
            <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>
              🤖 Авто-вывод: {labDerivedFields.length} полей (печень/ССС/почки/цели/противопоказания)
            </div>
          )}
        </div>
      )}

      {/* РИСК — только карточки с механизмами (без дублирующей общей) */}
      {result.risk.systems.filter(s => s.rawScore > 0).length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 4, paddingLeft: 4 }}>📊 Риск: {result.overallRiskBefore}% → <span style={{ color: '#00e68a' }}>{result.overallRiskAfter}%</span></div>
          {result.risk.systems.filter(s => s.rawScore > 0).map(sys =>
            <div key={sys.id} style={{ ...GLASS, padding: '4px 10px', marginBottom: 3 }}>
              <MechanismView sys={sys} />
            </div>
          )}
        </div>
      )}

      {/* EZ-1 КАЛЬКУЛЯТОР — TZ-Mapper (единственный) */}
      <CalcMapperCard state={state} onApply={(rec) => {
        const subIds = rec.subs.map(s => s.substanceId);
        onApply({ level: rec.level, subs: subIds, tzRec: rec });
      }} />

      {result.contraindicationAlerts.length > 0 && (
        <div style={{ ...GLASS, padding: 8, marginTop: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>⚠ Противопоказания</div>
          {result.contraindicationAlerts.map((a, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text)', marginBottom: 2 }}>{a}</div>)}
        </div>
      )}
    </div>
  );
};

export default AutoCalculator;