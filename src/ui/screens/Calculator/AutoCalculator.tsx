import React, { useMemo, useState, useCallback } from 'react';
import type { CalculatorState, CalculatorResult, LabSlice } from '../../../engines/support-plan';
import { calculateSupportTZ, hydrateState } from '../../../engines/support-plan';
import { PHARMA_DB, PHARMA_CLASSES } from '../../../core/pharma-database';
import { getProfile } from '../../../core/profile-manager';
import { GLASS, BADGE, DEFAULT_STATE } from './Calc.types';
import type { AutoCalculatorProps } from './Calc.types';
import { Card } from './Calc.parts';
import { TzRiskCard } from './TzRiskCard';
import { MechanismView } from './Calc.result';
import { deriveStateFromLabs, labPointsToSlice } from './Calc.labs-derived';
import { db } from '../../../core/db';
import { CalcMapperCard } from './Calc.mapper';

export const AutoCalculator: React.FC<AutoCalculatorProps> = ({ onApply, embedded, courseWeek: propWeek, courseLinked, labsLinked }) => {
  const [state, setState] = useState<CalculatorState>(() => {
    const h = hydrateState();
    return { ...DEFAULT_STATE, ...h, profile: { ...DEFAULT_STATE.profile, ...(h.profile || {}) }, pharma: { ...DEFAULT_STATE.pharma, ...(h.pharma || {}) }, labs: { ...DEFAULT_STATE.labs, ...(h.labs || {}), fullPanel: h.labs?.fullPanel || DEFAULT_STATE.labs.fullPanel } };
  });
  const [fillStatus, setFillStatus] = useState('');
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
    if (!fp) { setLabDerivedFields([]); return; }
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
  }, [state.labs.fullPanel]);

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

  const fillLabs = async () => {
    try {
      let src: any[] = [];

      // ── 1. Основной источник: IndexedDB labs_log (Лабскрин) ──
      try {
        await db.init();
        const profile = getProfile();
        const pid = profile?.id || 'current-user';
        const allLabs = await db.getAll<any>('labs_log');
        const userLabs = allLabs.filter((l: any) => l.patientId === pid || !l.patientId);
        if (userLabs.length > 0) src = userLabs;
      } catch { /* IndexedDB недоступен — пробуем дальше */ }

      // ── 2. Пропс labsLinked (если передан полный массив) ──
      if (src.length === 0 && labsLinked) {
        const ll = Array.isArray(labsLinked) ? labsLinked : [labsLinked];
        if (ll.length > 0 && ll.some((l: any) => l.code && l.value != null)) src = ll;
      }

      // ── 3. localStorage he_lab_diary (дневник) ──
      if (src.length === 0) {
        try {
          const hist = JSON.parse(localStorage.getItem('he_lab_diary') || '[]');
          if (Array.isArray(hist) && hist.length > 0) {
            const last = hist[hist.length - 1];
            if (last?.markers && Array.isArray(last.markers)) src = last.markers;
            else if (last) src = [last];
          }
        } catch { /* нет данных */ }
      }

      if (src.length === 0) {
        setFillStatus('❌ Нет анализов — откройте Лабораторию и введите результаты');
        setTimeout(() => setFillStatus(''), 3000);
        return;
      }

      const slice = labPointsToSlice(src);
      if (!slice) {
        setFillStatus('❌ Не удалось распознать анализы');
        setTimeout(() => setFillStatus(''), 3000);
        return;
      }
      update('labs', { ...state.labs, fullPanel: slice });
      setFillStatus(`✅ Анализы загружены (${src.length} маркеров из Лабскрин)`);
      setTimeout(() => setFillStatus(''), 2000);
    } catch {
      setFillStatus('❌ Ошибка загрузки анализов');
      setTimeout(() => setFillStatus(''), 3000);
    }
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

      

      {/* ===== КАРТОЧКА КУРСА ААС (большая, красивая) ===== */}
      {state.pharma.aas.length > 0 && (
        <div style={{
          marginBottom: 10,
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(59,130,246,0.06))',
          border: '1.5px solid rgba(99,102,241,0.2)',
          padding: '14px 14px 12px',
          boxShadow: '0 4px 20px rgba(99,102,241,0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Декоративная полоса */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#818cf8,#6366f1)', borderTopLeftRadius:16, borderTopRightRadius:16 }} />

          {/* Заголовок */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(59,130,246,0.15))',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:18,
            }}>💉</div>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:'#818cf8', letterSpacing:'-0.3px' }}>
                Курс ААС · {state.pharma.aas.length} препарат{state.pharma.aas.length > 1 ? 'а' : ''}
              </div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:1, letterSpacing:'-0.2px' }}>
                Фаза: {state.pharma.phase} · Длительность: ~{Math.max(...state.pharma.aas.map(a => a.weeks || 12))} нед
              </div>
            </div>
          </div>

          {/* Список ААС */}
          <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:8 }}>
            {state.pharma.aas.map((a, i) => {
              const phName = (PHARMA_DB as any)[a.id]?.name || a.id;
              const phClass = (PHARMA_DB as any)[a.id]?.class || '';
              const classColor = phClass === 'testosterone' ? 'rgba(99,102,241,0.15)'
                : phClass === 'nandrolone' ? 'rgba(34,197,94,0.15)'
                : phClass === 'trenbolone' ? 'rgba(239,68,68,0.15)'
                : phClass === 'oral_17aa' ? 'rgba(245,158,11,0.15)'
                : phClass === 'dht' ? 'rgba(168,85,247,0.15)'
                : phClass === 'sarm' ? 'rgba(59,130,246,0.15)'
                : 'rgba(255,255,255,0.04)';
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'6px 10px', borderRadius:10,
                  background:'rgba(0,0,0,0.15)',
                  border:'1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    width:6, height:6, borderRadius:3,
                    background: phClass === 'testosterone' ? '#818cf8'
                      : phClass === 'nandrolone' ? '#22c55e'
                      : phClass === 'trenbolone' ? '#ef4444'
                      : phClass === 'oral_17aa' ? '#f59e0b'
                      : phClass === 'dht' ? '#a855f7'
                      : phClass === 'sarm' ? '#3b82f6'
                      : '#6b7280',
                  }} />
                  <span style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text)', letterSpacing:'-0.2px' }}>{phName}</span>
                  <span style={{ fontSize:9, fontWeight:600, color:'#00e68a' }}>{a.doseMgWeek} мг/нед</span>
                  <span style={{ fontSize:8, color:'rgba(255,255,255,0.4)', fontWeight:500 }}>{a.weeks} нед</span>
                  {phClass && (
                    <span style={{
                      fontSize:7, padding:'1px 6px', borderRadius:4,
                      background:classColor, color:'var(--text-dim)', fontWeight:600,
                    }}>
                      {phClass === 'oral_17aa' ? 'орал' : phClass.slice(0,6)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Сопутствующие препараты */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {state.pharma.hasHCG && (
              <span style={{ fontSize:8, padding:'4px 10px', borderRadius:8, background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.2)', color:'#c084fc', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                💪 ХГЧ
              </span>
            )}
            {state.pharma.hasAI && (
              <span style={{ fontSize:8, padding:'4px 10px', borderRadius:8, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.2)', color:'#fbbf24', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                ⚖️ АИ (ингибитор ароматазы)
              </span>
            )}
            {state.pharma.hasSERM && (
              <span style={{ fontSize:8, padding:'4px 10px', borderRadius:8, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.2)', color:'#4ade80', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                🛡️ SERM
              </span>
            )}
            {state.pharma.hasCaber && (
              <span style={{ fontSize:8, padding:'4px 10px', borderRadius:8, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.2)', color:'#818cf8', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                💤 Каберголин
              </span>
            )}
            {state.pharma.hasGH && (
              <span style={{ fontSize:8, padding:'4px 10px', borderRadius:8, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.2)', color:'#60a5fa', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                📈 GH
              </span>
            )}
            {state.pharma.hasInsulin && (
              <span style={{ fontSize:8, padding:'4px 10px', borderRadius:8, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.2)', color:'#fbbf24', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                💉 Инсулин
              </span>
            )}
            {state.pharma.hasSARMs && (
              <span style={{ fontSize:8, padding:'4px 10px', borderRadius:8, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.2)', color:'#60a5fa', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                🔬 SARMs
              </span>
            )}
          </div>
        </div>
      )}

      {/* Данные анализов — краткая сводка (не карточка ввода) */}
      {state.labs.fullPanel && (
        <div style={{ ...GLASS, padding: '6px 10px', marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>🧪 Анализы загружены</div>
          {labDerivedFields.length > 0 && (
            <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>
              🤖 Авто-вывод: {labDerivedFields.length} полей (печень/ССС/почки/цели/противопоказания)
            </div>
          )}
        </div>
      )}

      {/* ── РИСК: механизм-ориентированная модель (TZ) ── */}
      {result.tzSpecResult && result.tzSpecResult.organs ? (
        <TzRiskCard
          tz={result.tzSpecResult}
          before={result.overallRiskBefore}
          after={result.overallRiskAfter}
        />
      ) : result.risk.systems.filter(s => s.rawScore > 0).length > 0 ? (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 4, paddingLeft: 4 }}>📊 Риск: {result.overallRiskBefore}% → <span style={{ color: '#00e68a' }}>{result.overallRiskAfter}%</span></div>
          {result.risk.systems.filter(s => s.rawScore > 0).map(sys =>
            <div key={sys.id} style={{ ...GLASS, padding: '4px 10px', marginBottom: 3 }}>
              <MechanismView sys={sys} />
            </div>
          )}
        </div>
      ) : null}

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