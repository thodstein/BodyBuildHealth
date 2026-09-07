// Механизм-ориентированная модель риска — UI (качественное оформление)
// Данные курса → из linked.course (Фарма), анализы → из linked.labs, поддержка → из калькулятора
import React, { useState, useEffect, useMemo } from 'react';
import { calculateTzSpecRisk, DRUG_CLASSES, getCategoryLabel, type TzSpecInput, type TzSpecResult, type TzSpecOrganResult, type TzSpecMechanismResult } from '../../../engines/risk-engine-tz-spec';
import { buildTzInputCore, normalizeFlatLabs } from '../../../engines/support-plan/engine-helpers';
import { useDataLink } from '../../../core/data-link';
import { PHARMA_DB } from '../../../core/pharma-database';
import { resolvePedAlias } from '../../../data/ped-alias-map';
import { TZRisk3DModel } from './TZRisk3DModel';
import { RiskVerificationList } from './RiskVerificationList';

const ACCENT = '#00e68a';

const SYSTEM_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  cardio:       { accent: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.20)' },
  hepatic:      { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.20)' },
  renal:        { accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.20)' },
  cns:          { accent: '#a855f7', bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.20)' },
  reproductive: { accent: '#ec4899', bg: 'rgba(236,72,153,0.08)',  border: 'rgba(236,72,153,0.20)' },
  hematologic:  { accent: '#14b8a6', bg: 'rgba(20,184,166,0.08)',  border: 'rgba(20,184,166,0.20)' },
};

const riskColor = (pct: number): string => {
  if (pct < 25) return '#22c55e';
  if (pct < 50) return '#eab308';
  if (pct < 75) return '#f97316';
  return '#ef4444';
};

const riskLabel = (pct: number): string => {
  if (pct < 25) return 'Низкий';
  if (pct < 50) return 'Умеренный';
  if (pct < 75) return 'Высокий';
  return 'Очень высокий';
};

const CARD: React.CSSProperties = {
  padding: 16, borderRadius: 18,
  background: 'rgba(20,22,30,0.55)',
  border: '1px solid rgba(255,255,255,0.09)',
  boxShadow: '0 12px 30px rgba(0,0,0,0.20)',
  marginBottom: 12,
};

const GlassChip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  fontSize: 11, fontWeight: 600,
};

// ── Круговой gauge ──
const ArcGauge: React.FC<{ value: number; size?: number; stroke?: number; label?: string }> = ({ value, size = 100, stroke = 8, label }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circ - (clamped / 100) * circ * 0.7; // 0.7 = 252° arc (not full circle)
  const color = riskColor(clamped);
  const cx = size / 2;
  const cy = size / 2;
  return (
    <div style={{ position: 'relative', width: size, height: size + 20, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="40%" stopColor="#eab308" />
            <stop offset="70%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${circ * 0.7}`} strokeDashoffset={offset}
          transform={`rotate(135 ${cx} ${cy})`} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: size * 0.28, fontWeight: 800, color, lineHeight: 1 }}>{Math.round(clamped)}</div>
        <div style={{ fontSize: size * 0.11, color: '#fff', marginTop: 2 }}>{label || '%'}</div>
      </div>
    </div>
  );
};

export const RiskSpecMethod: React.FC<{ subTab?: string }> = ({ subTab }) => {
  const linked = useDataLink();
  const course = linked.course || [];
  const labs = linked.labs || [];
  const [forceNoLabs, setForceNoLabs] = useState(false);
  const [supportIds, setSupportIds] = useState<string[]>([]);
  const [expandedOrgan, setExpandedOrgan] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showInputs, setShowInputs] = useState(false);

  useEffect(() => {
    const loadSupport = () => {
      try {
        const sr = JSON.parse(localStorage.getItem('he_support_risk') || 'null');
        if (sr && Array.isArray(sr.subs)) {
          const subs = sr.subs.map((id: string) => id.toLowerCase());
          const procs = Array.isArray(sr.procedures) ? sr.procedures.map((id: string) => id.toLowerCase()) : [];
          setSupportIds([...subs, ...procs]);
        }
      } catch {}
    };
    loadSupport();
    // Живое обновление: калькулятор может пересчитать поддержку ПОСЛЕ монтирования
    // вкладки — слушаем storage-события и возврат фокуса на окно.
    window.addEventListener('storage', loadSupport);
    window.addEventListener('focus', loadSupport);
    return () => {
      window.removeEventListener('storage', loadSupport);
      window.removeEventListener('focus', loadSupport);
    };
  }, []);

  const courseSummary = useMemo(() => {
    if (!course.length) return null;
    const totalDose = course.reduce((s, c) => s + (c.doseValue || 0), 0);
    const totalWeeks = course.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0);
    const ids = course.map(c => (c.substanceId || '').toLowerCase());
    const hasAAS = ids.some(id => !id.includes('gh') && !id.includes('growth') && !id.includes('insulin') && !id.includes('igf') && !id.includes('ghrp') && !id.includes('cjc') && !id.includes('ipa'));
    const hasGH = ids.some(id => id.includes('gh') || id.includes('growth') || id.includes('igf') || id.includes('ghrp') || id.includes('cjc') || id.includes('ipa') || id.includes('tese') || id.includes('soma'));
    const hasInsulin = ids.some(id => id.includes('insulin') || id.includes('novor') || id.includes('aktrap') || id.includes('lantus'));
    const drugClasses: string[] = [];
    if (hasAAS) drugClasses.push('aas');
    if (hasGH) drugClasses.push('gh');
    if (hasInsulin) drugClasses.push('insulin');
    let drugClass: 'aas' | 'gh' | 'insulin' = 'aas';
    if (drugClasses.length === 1) drugClass = drugClasses[0] as any;
    else if (hasAAS) drugClass = 'aas';
    else if (hasGH) drugClass = 'gh';
    else if (hasInsulin) drugClass = 'insulin';
    const avgDose = course.length > 0 ? Math.round(totalDose / course.length) : 500;
    const form: 'inject' | 'oral' = ids.some(id => id.includes('oxand') || id.includes('stan') || id.includes('meth') || id.includes('oxym') || id.includes('turin') || id.includes('superdrol') || id.includes('sarm')) ? 'oral' : 'inject';
    return { drugClass, avgDose, totalWeeks: Math.max(1, totalWeeks), form, combos: drugClasses.length, count: course.length, classes: drugClasses };
  }, [course]);

  const labMap = useMemo(() => normalizeFlatLabs(labs), [labs]);
  const labCount = Object.keys(labMap).length;
  const REQUIRED_LAB_CODES = ['LDL','HDL','TG','HCT','ALT','AST','GGT','CREATININE','eGFR','GLU','LH','FSH','TT','E2','K','Na'];
  const presentCount = REQUIRED_LAB_CODES.filter(c => labMap[c] !== undefined).length;
  const rawDcov = labCount > 0 ? presentCount / REQUIRED_LAB_CODES.length : 0.1;
  const dCov = forceNoLabs ? 0.1 : Math.max(0.1, rawDcov);

  // ── Авто-расчёт (useMemo) — результат вычисляется при изменении любых входных данных ──
  // ЕДИНЫЙ строитель входа (buildTzInputCore) с калькулятором поддержки: та же
  // нормализация анализов, тот же phase-множитель, те же nutrition/training.
  // Если калькулятор открыт — его snapshot (he_calc_tz_input) даёт полную идентичность.
  const readCalcSnapshot = (): TzSpecInput | null => {
    try {
      const raw = localStorage.getItem('he_calc_tz_input');
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d?.input || Date.now() - (d.ts || 0) > 24 * 60 * 60 * 1000) return null;
      return d.input as TzSpecInput;
    } catch { return null; }
  };
  // NOTE: state + storage/focus, а не useMemo([]): калькулятор может сохранить
  // свежий снапшот ПОСЛЕ монтирования вкладки — иначе «идентичные цифры»
  // молча оставались вчерашними (снапшот имел приоритет над живыми данными).
  const [calcSnapshot, setCalcSnapshot] = useState<TzSpecInput | null>(() => readCalcSnapshot());
  useEffect(() => {
    const reload = () => setCalcSnapshot(readCalcSnapshot());
    window.addEventListener('storage', reload);
    window.addEventListener('focus', reload);
    return () => {
      window.removeEventListener('storage', reload);
      window.removeEventListener('focus', reload);
    };
  }, []);
  const buildInputs = useMemo((): TzSpecInput | null => {
    if (calcSnapshot) return calcSnapshot;
    if (!courseSummary) return null;
    const drugs = course.length > 0 ? course.map(c => {
      const id = (c.substanceId || '').toLowerCase();
      const isAAS = !id.includes('gh') && !id.includes('growth') && !id.includes('insulin') && !id.includes('igf');
      return {
        drugClass: isAAS ? 'aas' as const : id.includes('insulin') ? 'insulin' as const : 'gh' as const,
        drugName: resolvePedAlias(id) || id || 'unknown',
        dose: c.doseValue || 250,
        form: (id.includes('oxand') || id.includes('stan') || id.includes('meth') ? 'oral' : 'inject') as 'inject' | 'oral',
        startWeek: c.startWeek,
        endWeek: c.endWeek,
      };
    }) : [];
    if (drugs.length === 0) return null;
    const prof: any = linked.profile?.settings || {};
    const training = prof?.lifestyle ? {
      hasHIIT: (prof.lifestyle.workoutsPerWeek || 3) >= 4,
      weeklyMinutes: (prof.lifestyle.workoutsPerWeek || 3) * (prof.lifestyle.avgWorkoutMinutes || 60),
      volumeTonnes: 8000,
      lissMinutesPerWeek: 60,
    } : undefined;
    const nutrition = prof?.nutrition ? {
      proteinPerKg: prof.nutrition.proteinGPerKg || 1.8,
      fiberG: prof.nutrition.fiberG || 25,
      omega3G: prof.nutrition.omega3 ? 1.5 : 0.5,
      sodiumG: (prof.nutrition.sodiumMg || 3000) / 1000,
      potassiumG: (prof.nutrition.potassiumMg || 3000) / 1000,
      waterL: prof.nutrition.waterL || 2,
      calories: prof.nutrition.calories || 2500,
    } : undefined;
    return buildTzInputCore({
      drugs,
      duration: courseSummary.totalWeeks,
      labs: forceNoLabs ? {} : labMap,
      phaseKey: 'course',
      training,
      nutrition,
    }, supportIds);
  }, [courseSummary, course, dCov, forceNoLabs, labMap, supportIds, calcSnapshot, linked.profile]);

  const result = useMemo<TzSpecResult | null>(() => {
    if (!buildInputs) return null;
    return calculateTzSpecRisk(buildInputs);
  }, [buildInputs]);

  // ── Понедельная динамика ──
  const weeklyData = useMemo(() => {
    if (!course.length || !result || !courseSummary) return null;
    const weeks = Math.max(course.reduce((m, c) => Math.max(m, (c.endWeek || 12)), 0) + 4, 8);
    const data: { week: number; risk: number }[] = [];
    for (let w = 0; w <= weeks; w++) {
      const weeklyDrugs = course.map(c => {
        const sw = c.startWeek || 0; const ew = c.endWeek || 12;
        const hl = (PHARMA_DB as any)?.[(c.substanceId || '').toLowerCase()]?.pk?.halfLifeHours ?? 168;
        const hlWeeks = hl / 168;
        let effDose = 0;
        if (w >= sw && w <= ew) {
          const weeksOn = w - sw + 1;
          const accum = 1 - Math.pow(0.5, weeksOn / Math.max(hlWeeks, 0.1));
          effDose = (c.doseValue || 0) * accum;
        } else if (w > ew) {
          const weeksOff = w - ew;
          const lastDose = (c.doseValue || 0) * (1 - Math.pow(0.5, Math.max(1, ew - sw + 1) / Math.max(hlWeeks, 0.1)));
          effDose = lastDose * Math.pow(0.5, weeksOff / Math.max(hlWeeks, 0.1));
        }
        const id = (c.substanceId || '').toLowerCase();
        const isAAS = !id.includes('gh') && !id.includes('growth') && !id.includes('insulin') && !id.includes('igf');
        return {
          drugClass: isAAS ? 'aas' as const : id.includes('insulin') ? 'insulin' as const : 'gh' as const,
          drugName: id || 'unknown', dose: Math.max(0, Math.round(effDose)),
          form: (id.includes('oxand') || id.includes('stan') || id.includes('meth') ? 'oral' : 'inject') as 'inject' | 'oral',
        };
      }).filter(d => d.dose > 0);
      const wi: TzSpecInput = {
        drugClass: courseSummary.drugClass, drugName: 'weekly', dose: 1, duration: Math.max(w, 1),
        form: courseSummary.form, combinations: courseSummary.combos,
        labCoverage: dCov, labValues: forceNoLabs ? {} : labMap, supportSubstances: supportIds,
        drugs: weeklyDrugs.length > 0 ? weeklyDrugs : undefined,
      };
      data.push({ week: w, risk: calculateTzSpecRisk(wi).overallAfter });
    }
    return data;
  }, [course, courseSummary, result, dCov, forceNoLabs, labMap, supportIds]);

  // ── Анализы (верификация) — не зависит от курса ──
  if (subTab === 'analyses') {
    return (
      <div>
        {/* Тот же набор анализов, что у движка (снапшот калькулятора приоритетнее) — иначе
            цифры верификации во вкладке расходятся с карточкой «верифицировано анализами» */}
        <RiskVerificationList labMap={buildInputs?.labValues || labMap} result={result} />
      </div>
    );
  }

  // ── 3D sub-tab ──
  if (subTab === 'tz_3d') {
    if (!result) {
      return <div style={{ textAlign: 'center', padding: 60, color: '#fff', fontSize: 13, lineHeight: 1.5 }}>
        Сначала загрузите данные курса во вкладке «Обзор»
      </div>;
    }
    return (
      <div>
        <div style={CARD}>
          <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, marginBottom: 4 }}>🧊 3D модель рисков</div>
          <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.5 }}>
            Визуализация риска по 6 системам на анатомической модели · Цвет = уровень риска системы
          </div>
        </div>
        <div style={{ minHeight: 400 }}><TZRisk3DModel tzResult={result} /></div>
      </div>
    );
  }

  // ── Нет курса ──
  if (!courseSummary) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.6 }}>🧬</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Механизм-ориентированная модель</div>
        <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.55, maxWidth: 320, margin: '0 auto' }}>
          Добавьте препараты во вкладке «Фарма» → «Курс», чтобы увидеть интегральный риск по 6 системам и 28 механизмам
        </div>
      </div>
    );
  }

  return (
    <div className="risk-spec" style={{ padding: '4px 0 80px' }}>

      {/* ── HERO CARD: интегральный риск ── */}
      <div style={{
        ...CARD,
        padding: '20px 16px',
        background: `linear-gradient(135deg, ${riskColor(result?.overallAfter || 0)}0d 0%, rgba(24,24,27,0.20) 100%)`,
        border: `1px solid ${riskColor(result?.overallAfter || 0)}18`,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Интегральный риск
          </div>
          <div style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace', lineHeight: 1.4 }}>
            R = Σ(w × m × E × U × Π(1−k*)) · агрегация: union (нелинейно)
          </div>
          {calcSnapshot && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#fff', fontWeight: 700, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.22)', borderRadius:8, padding:'6px 10px' }}>
              ⚡ Цифры идентичны калькулятору поддержки (единый вход: поддержка, фаза, анализы, питание)
            </div>
          )}
          {!calcSnapshot && supportIds.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#fff', fontWeight: 700, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.24)', borderRadius:8, padding:'6px 10px' }}>
              ⚠ Поддержка не выбрана — «с поддержкой» = «без поддержки». Откройте калькулятор поддержки, чтобы учесть план.
            </div>
          )}
        </div>

        {result && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center', minWidth: 110, flex:1, padding:'12px 8px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>Без поддержки</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: riskColor(result.overallRaw), lineHeight: 1 }}>
                  {Math.round(result.overallRaw)}
                  <span style={{ fontSize: 16, fontWeight: 400, color:'#fff' }}>%</span>
                </div>
              </div>
              <div style={{ fontSize: 22, color: '#fff', fontWeight: 800 }}>→</div>
              <div style={{ textAlign: 'center', minWidth: 110, flex:1, padding:'12px 8px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>С поддержкой</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: riskColor(result.overallAfter), lineHeight: 1 }}>
                  {Math.round(result.overallAfter)}
                  <span style={{ fontSize: 16, fontWeight: 400, color:'#fff' }}>%</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                padding: '6px 16px', borderRadius: 20,
                background: riskColor(result.overallAfter) + '18',
                border: `1px solid ${riskColor(result.overallAfter)}33`,
                fontSize: 12, fontWeight: 700, color: riskColor(result.overallAfter),
              }}>
                {riskLabel(result.overallAfter)} · Kp = {result.k_protect_overall}%
              </div>
            </div>

            <div style={{ marginTop: 12, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, #22c55e, ${riskColor(result.overallAfter)})`,
                width: `${Math.min(100, result.overallAfter)}%`, transition: 'width 0.6s ease' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 10, fontSize: 12, color: '#fff', flexWrap:'wrap', fontWeight:600 }}>
              <span style={{ padding:'4px 10px', borderRadius:999, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>D_cov: {result.d_cov.toFixed(1)}</span>
              <span style={{ padding:'4px 10px', borderRadius:999, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>U: ×{result.u_i.toFixed(2)}</span>
              <span style={{ padding:'4px 10px', borderRadius:999, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>Поддержка: {result.supportCount} веществ</span>
            </div>

            {result.overallVerification !== undefined && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '10px 12px', borderRadius: 12, minHeight:44,
                background: result.overallVerification >= 0.5 ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.10)',
                border: `1px solid ${result.overallVerification >= 0.5 ? 'rgba(34,197,94,0.24)' : 'rgba(245,158,11,0.28)'}`,
                fontSize: 12, color: '#fff', fontWeight:700, lineHeight:1.4,
              }}>
                {result.overallVerification >= 0.5 ? '🔬' : '⚠'} Индекс риска · верифицировано анализами: {Math.round(result.overallVerification * 100)}% систем
                {result.overallVerification < 0.5 && <span style={{ color: '#fff' }}>— оценка по фармакологии, сдайте анализы</span>}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── СИСТЕМЫ: ключевые карточки + быстрая навигация ── */}
      {result && (
        <div className="risk-systems" style={CARD}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 4, height: 20, borderRadius: 2, background: ACCENT, display: 'inline-block' }} />
            Риск по системам
            <span style={{ marginLeft:'auto', fontSize:12, fontWeight:700, color:'#fff', padding:'4px 10px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)' }}>{result.organs.length} систем</span>
          </div>
          <div className="risk-systems-nav" style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 2px 10px', scrollbarWidth:'none' }}>
            {result.organs.map((o: TzSpecOrganResult) => (
              <button key={o.id} onClick={() => setExpandedOrgan(expandedOrgan === o.id ? null : o.id)} aria-label={o.name} style={{ flexShrink:0, minHeight:44, padding:'8px 14px', borderRadius:999, fontSize:13, fontWeight:800, cursor:'pointer', background: expandedOrgan===o.id ? `${riskColor(o.afterPercent)}26` : 'rgba(255,255,255,0.06)', border: expandedOrgan===o.id ? `1px solid ${riskColor(o.afterPercent)}66` : '1px solid rgba(255,255,255,0.10)', color:'#fff', display:'flex', alignItems:'center', gap:6 }}>
                <span>{o.icon}</span> {Math.round(o.afterPercent)}%
              </button>
            ))}
          </div>

          {result.organs.map((organ: TzSpecOrganResult) => {
            const sc = SYSTEM_COLORS[organ.id] || { accent: ACCENT, bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' };
            const isExpanded = expandedOrgan === organ.id;
            const delta = organ.rawPercent - organ.afterPercent;
            const protectedMechs = organ.mechanisms.filter(m => m.k_used > 0).length;
            const totalMechs = organ.mechanisms.length;

            return (
              <div key={organ.id} className="risk-system-card" data-system={organ.id} style={{
                marginBottom: 10, borderRadius: 16, overflow: 'hidden',
                border: `1px solid ${sc.border}`,
                background: sc.bg, boxShadow:'0 8px 22px rgba(0,0,0,0.16)',
              }}>
                {/* Header — тач 56px */}
                <div onClick={() => setExpandedOrgan(isExpanded ? null : organ.id)} role="button" tabIndex={0} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setExpandedOrgan(isExpanded ? null : organ.id); }}} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px', minHeight:64,
                  cursor: 'pointer', userSelect: 'none',
                }}>
                  <span style={{ width:44, height:44, borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize: 22, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)' }}>{organ.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight:1.2 }}>{organ.name}</div>
                    <div style={{ fontSize: 12, color: '#fff', marginTop: 3, lineHeight:1.35 }}>
                      {totalMechs} мех. · защищено {protectedMechs}/{totalMechs}
                      {delta > 0 && <span style={{ color: '#4ade80', marginLeft: 6, fontWeight:800 }}>↓{Math.round(delta)}%</span>}
                      {organ.verification !== undefined && organ.verification < 0.5 && (
                        <span style={{ color: '#fff', marginLeft: 6, fontWeight:700 }}>⚠ не верифицировано</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink:0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: riskColor(organ.afterPercent), lineHeight:1 }}>
                      {Math.round(organ.afterPercent)}<span style={{ fontSize: 12, fontWeight: 400, color:'#fff' }}>%</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#fff', marginTop:2 }}>
                      raw {Math.round(organ.rawPercent)}%
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#fff', marginLeft: 2, width:32, height:32, borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', flexShrink:0 }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', margin: '0 12px', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.min(100, organ.afterPercent)}%`,
                    background: sc.accent, borderRadius: 999, transition: 'width 0.5s ease',
                  }} />
                </div>

                {/* Expanded mechanisms */}
                {isExpanded && (
                  <div style={{ padding: '10px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 8 }}>
                    {organ.mechanisms.map((m: TzSpecMechanismResult) => {
                      const reduction = Math.round(m.raw - m.afterSupport);
                      const hasProtection = m.k_used > 0;
                      return (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
                          borderRadius: 12, marginBottom: 6,
                          background: hasProtection ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.03)',
                          border: hasProtection ? '1px solid rgba(0,230,138,0.16)' : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>
                              {m.name}
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap:'wrap' }}>
                              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700, ...GlassChip, padding: '4px 9px' }}>
                                w={m.weight}
                              </span>
                              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700, ...GlassChip, padding: '4px 9px' }}>
                                m={m.m_i}
                              </span>
                              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700, ...GlassChip, padding: '4px 9px' }}>
                                E={m.E_i.toFixed(1)}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flexShrink:0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: hasProtection ? '#4ade80' : '#f87171' }}>
                              {m.rawPercent}% → {m.afterPercent}%
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', marginTop:2 }}>
                              {Math.round(m.raw)} → {Math.round(m.afterSupport)} баллов
                            </div>
                            {hasProtection && (
                              <div style={{ fontSize: 11, color: '#fff', fontWeight: 700, marginTop:2 }}>
                                ↓{m.k_used}% · Q={m.q_label}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {organ.floors && organ.floors.length > 0 && (
                      <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.24)' }}>
                        {organ.floors.map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#fff', lineHeight: 1.5, fontWeight:600 }}>
                            ⚓ {f.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ПОНЕДЕЛЬНАЯ ДИНАМИКА ── */}
      {weeklyData && weeklyData.length > 0 && (
        <div className="risk-weekly" style={CARD}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 4, height: 20, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} />
            Динамика риска по неделям
          </div>
          <WeeklyRiskChartSVG data={weeklyData} />
        </div>
      )}

      {/* ── ВХОДНЫЕ ДАННЫЕ (сворачиваемые) — APK PRO: 44px, белый ── */}
      <div className="risk-inputs" style={CARD}>
        <div onClick={() => setShowInputs(!showInputs)} role="button" tabIndex={0} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setShowInputs(!showInputs); }}} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight:48,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
            📋 Входные данные расчёта
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, fontSize: 12, fontWeight:700 }}>
              <span style={{ color: '#fff', padding:'4px 9px', borderRadius:999, background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.22)' }}>{courseSummary.count} преп.</span>
              <span style={{ color: '#fff', padding:'4px 9px', borderRadius:999, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.22)' }}>{labCount} марк.</span>
              <span style={{ color: '#fff', padding:'4px 9px', borderRadius:999, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.22)' }}>{supportIds.length} поддерж.</span>
            </div>
            <span style={{ fontSize: 12, color: '#fff', width:32, height:32, borderRadius:999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)' }}>{showInputs ? '▲' : '▼'}</span>
          </div>
        </div>

        {showInputs && (
          <div style={{ marginTop: 12 }}>
            {/* Курс */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>💉 Курс</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {[
                  { label: 'Класс', value: `${DRUG_CLASSES[courseSummary.drugClass]?.icon || ''} ${courseSummary.classes.join(' + ') || '—'}`, color: '#fff' },
                  { label: 'Препаратов', value: `${courseSummary.count} шт`, color: '#fff' },
                  { label: 'Средняя доза', value: `${courseSummary.avgDose} ${DRUG_CLASSES[courseSummary.drugClass]?.doseLabel || ''}`, color: '#fff' },
                  { label: 'Длительность', value: `${courseSummary.totalWeeks} нед`, color: '#fff' },
                  { label: 'Форма', value: courseSummary.form === 'oral' ? 'Перорально' : 'Инъекции', color: '#fff' },
                  { label: 'Комбинаций', value: `${courseSummary.combos}`, color: '#fff' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '10px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 11, color: '#fff' }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: item.color, marginTop:2 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Лаборатория */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>🧪 Лаборатория</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setForceNoLabs(!forceNoLabs)} style={{
                  minHeight:44, padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  background: forceNoLabs ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.10)',
                  border: forceNoLabs ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(59,130,246,0.28)',
                  color: '#fff',
                }}>
                  {forceNoLabs ? 'Штраф активирован' : 'Без анализов'}
                </button>
                <span style={{ fontSize: 12, color: '#fff', fontWeight:600 }}>
                  {labCount} маркеров · Покрытие {Math.round(dCov * 100)}%
                </span>
              </div>
              {labCount > 0 && !forceNoLabs && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {Object.entries(labMap).slice(0, 16).map(([code, val]) => (
                    <span key={code} style={{ ...GlassChip, fontSize: 12, fontWeight:700, padding:'6px 10px', background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.22)', color: '#fff' }}>
                      {code}: {val}
                    </span>
                  ))}
                  {Object.keys(labMap).length > 16 && (
                    <span style={{ fontSize: 12, color: '#fff', padding: '6px 0' }}>
                      +{Object.keys(labMap).length - 16} ещё
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Поддержка */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>💊 Поддержка</div>
              <div style={{ fontSize: 12, color: '#fff', lineHeight:1.5 }}>
                {supportIds.length > 0
                  ? `Активна: ${supportIds.join(', ')} (${supportIds.length} веществ)`
                  : 'Нет активной поддержки. Добавьте в «Поддержка» → «Калькулятор».'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ОБОСНОВАНИЕ ── */}
      {result && (
        <div style={CARD}>
          <button onClick={() => setShowExplanation(!showExplanation)} style={{
            width: '100%', minHeight:48, padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
            background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.20)',
            color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: 0.3,
          }}>
            {showExplanation ? '▲ Скрыть обоснование' : '▼ Пошаговое обоснование расчёта'}
          </button>
          {showExplanation && (
            <div style={{
              marginTop: 8, padding: 14, borderRadius: 12,
              background: 'rgba(0,0,0,0.30)', border: '1px solid rgba(255,255,255,0.07)',
              fontSize: 12, color: '#fff', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', fontFamily: 'monospace',
            }}>
              {result.explanation}
            </div>
          )}
        </div>
      )}

      {/* ── МЕТОДОЛОГИЯ ── */}
      <div style={{ ...CARD, border: '1px solid rgba(0,230,138,0.20)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 8 }}>📐 Методология</div>
        <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.65 }}>
          <b>R = Σ(w × m × E × U × Π(1−k*))</b><br />
          <b>w</b> (1–4) — вес механизма · <b>m</b> (0–3) — выраженность · <b>E</b> = D×T×F×C — экспозиция<br />
          <b>U</b> — штраф за неполноту лабораторных данных · <b>k*</b> — скорректированная защита поддержкой<br />
          Категории: <span style={{ color: '#fff', fontWeight:700 }}>0–24% низкий</span> · <span style={{ color: '#fff', fontWeight:700 }}>25–49% умеренный</span> · <span style={{ color: '#fff', fontWeight:700 }}>50–74% высокий</span> · <span style={{ color: '#fff', fontWeight:700 }}>75–100% очень высокий</span>
        </div>
      </div>
    </div>
  );
};

// ── SVG Chart Component ──
const WeeklyRiskChartSVG: React.FC<{ data: { week: number; risk: number }[] }> = ({ data }) => {
  const chartH = 120;
  const chartW = 320;
  const pad = { t: 16, r: 8, b: 28, l: 32 };
  const plotW = chartW - pad.l - pad.r;
  const plotH = chartH - pad.t - pad.b;
  const maxRisk = Math.max(...data.map(d => d.risk), 20);
  const maxW = data.length > 0 ? data[data.length - 1].week : 12;

  const pathD = data.map((d, i) => {
    const x = pad.l + (d.week / Math.max(1, maxW)) * plotW;
    const y = pad.t + (1 - d.risk / maxRisk) * plotH;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaD = pathD + ` L ${pad.l + plotW} ${pad.t + plotH} L ${pad.l} ${pad.t + plotH} Z`;

  const yTicks = [0, 25, 50, 75, 100].filter(v => v <= maxRisk * 1.1);

  return (
    <div>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={riskColor(data[data.length - 1]?.risk || 30)} stopOpacity="0.20" />
            <stop offset="100%" stopColor={riskColor(data[data.length - 1]?.risk || 30)} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map(v => {
          const y = pad.t + (1 - v / maxRisk) * plotH;
          const color = riskColor(v);
          return (
            <g key={v}>
              <line x1={pad.l} y1={y} x2={pad.l + plotW} y2={y} stroke={color} strokeOpacity={0.12} strokeWidth={0.5} strokeDasharray="4,4" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fill={color} fillOpacity={0.6} fontSize={8}>{v}%</text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#areaGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={riskColor(data[Math.floor(data.length / 2)]?.risk || 30)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 16)) === 0 || i === 0 || i === data.length - 1).map(d => {
          const x = pad.l + (d.week / Math.max(1, maxW)) * plotW;
          const y = pad.t + (1 - d.risk / maxRisk) * plotH;
          return (
            <g key={d.week}>
              <circle cx={x} cy={y} r={3} fill={riskColor(d.risk)} stroke="#fff" strokeWidth={0.5} />
              <text x={x} y={pad.t + plotH + 14} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={700}>
                {d.week}н
              </text>
            </g>
          );
        })}

        {/* X axis */}
        <line x1={pad.l} y1={pad.t + plotH} x2={pad.l + plotW} y2={pad.t + plotH} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 }}>
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 12)) === 0).map(d => (
          <span key={d.week} style={{
            fontSize: 12, fontWeight: 800, color: '#fff',
            padding: '6px 12px', borderRadius: 999,
            background: riskColor(d.risk) + '22',
            border: `1px solid ${riskColor(d.risk)}44`,
          }}>
            Нед {d.week}: {Math.round(d.risk)}%
          </span>
        ))}
      </div>
    </div>
  );
};
