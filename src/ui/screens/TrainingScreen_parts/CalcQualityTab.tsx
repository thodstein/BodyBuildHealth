import React, { useMemo, useState } from 'react';
import { computePlanQualityFor } from '../../../engines/manual-constructor';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { GROUP_RU } from './program-types';
import { loadTrainingProfile } from './training-profile';
import { loadUserPrograms } from '../../../engines/user-program/program-store';
import { useDataLink } from '../../../core/data-link';
import { labTrainingAdjust } from './lab-training-adjust';
import { PopupSelect, ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import { adaptForPEDs } from '../../../engines/bb/bb-ped-adaptation.engine';
import { analyzeProQuality } from '../../../engines/manual-constructor/pro-quality-analysis.engine';
import TrainingMetricsChart from '../SRCBBScreen_parts/TrainingMetricsChart';
import { calcSessionMetrics, type LMSWeekMetric } from '../../../engines/lms/lms-metrics.engine';
import { norm } from '../../../engines/norm';

const ACCENT = '#00e68a';
const ru = (g: string) => GROUP_RU[g] || g;

type Division = 'bb' | 'pl';
type LevelKey = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';

/**
 * CalcQualityTab PRO — профессиональный калькулятор качества программ.
 * Два разделения: ПЛ (сила) и ББ (гипертрофия), кнопка учета ПЕД + всех ключевых параметров,
 * живой пересчет, сравнение натурал/курс, лабораторная коррекция, детальный разбор.
 */
export const CalcQualityTab: React.FC<{ program?: UserProgram | null; level?: string; goal?: string; onBuildPlan: () => void }> = ({ program: propsProgram, level = 'intermediate', goal = 'hypertrophy', onBuildPlan }) => {
  const linked = useDataLink();
  const programs = useMemo(() => loadUserPrograms(), []);
  const [selectedId, setSelectedId] = useState<string>(() => propsProgram?.meta.id || programs[0]?.meta.id || '');
  const [division, setDivision] = useState<Division>(() => {
    const p = propsProgram || programs[0];
    if (!p) return 'bb';
    if (p.meta.direction === 'pl') return 'pl';
    if (p.meta.direction === 'bb') return 'bb';
    return 'bb';
  });
  const [levelOverride, setLevelOverride] = useState<LevelKey | ''>('');
  const [usePed, setUsePed] = useState<boolean>(() => {
    try { return !!loadTrainingProfile().onCourse; } catch { return false; }
  });
  const [courseIntensity, setCourseIntensity] = useState<'mild' | 'moderate' | 'heavy'>(() => {
    try { const c = loadTrainingProfile().courseIntensity; return (c === 'mild' || c === 'heavy' ? c : 'moderate'); } catch { return 'moderate'; }
  });
  const [useLab, setUseLab] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const selectedProgram: UserProgram | null = useMemo(() => {
    if (propsProgram && !selectedId) return propsProgram;
    if (selectedId) return programs.find(p => p.meta.id === selectedId) || propsProgram || programs[0] || null;
    return propsProgram || programs[0] || null;
  }, [propsProgram, programs, selectedId]);

  const effectiveLevel = (levelOverride || selectedProgram?.meta.level || level) as string;
  const prof = useMemo(() => loadTrainingProfile(), []);

  const labAdjust = useMemo(() => labTrainingAdjust(useLab ? (linked.labAnalysis ?? null) : null), [linked.labAnalysis, useLab]);
  const labMult = labAdjust.mrvMultiplier;

  // Подхватываем дозы ПЕД из профиля для точного расчета (если включен учет)
  const pedDoses = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('he_pl_session') || '{}');
      return raw?.pedDoses || {};
    } catch { return {}; }
  }, []);
  const peds = useMemo(() => {
    if (!usePed) return [];
    try {
      const sp = JSON.parse(localStorage.getItem('he_pl_session') || '{}');
      const list = sp?.peds as string[] | undefined;
      if (Array.isArray(list) && list.length) return list as any;
    } catch {}
    return prof.onCourse ? (['AAS'] as any) : [];
  }, [usePed, prof.onCourse]);

  const pedAdapt = useMemo(() => {
    if (!usePed || peds.length === 0) return null;
    // Базовый MRV для адаптации — берем средний MRV по группам для уровня
    const base: Record<string, number> = { chest: 20, back: 22, legs: 20, shoulders: 14, arms: 14, core: 12 };
    try { return adaptForPEDs(peds as any, base, pedDoses, courseIntensity); } catch { return null; }
  }, [usePed, peds, pedDoses, courseIntensity]);

  // Вычисляем анализ для выбранного разделения
  const analysis = useMemo(() => {
    if (!selectedProgram) return null;
    // Для PL-клонов без customWeeks — пробуем собрать синтетику из цикла для отображения (иначе пусто)
    let progForCalc: UserProgram = selectedProgram;
    if (division === 'pl' && selectedProgram.pl?.sourceCycleId && !selectedProgram.pl.customWeeks) {
      const tpl = getCycleById(selectedProgram.pl.sourceCycleId);
      if (tpl) {
        // Синтетические кастом-недели из шаблона (для оценки объема)
        const synthWeeks = (tpl.weeks && tpl.weeks.length ? tpl.weeks : [tpl.week1]).map((days, wi) => ({
          week: wi + 1,
          phase: 'accumulation' as const,
          deload: false,
          days: days.map((d, di) => ({
            name: `День ${di + 1}`,
            exercises: d.exercises.map(ex => ({
              name: ex.name,
              lift: 'accessory' as const,
              muscle: (ex as any).group || 'chest',
              sets: ex.sets.map(s => ({ pct: s.pct, reps: s.reps, sets: s.sets, rir: s.rir ?? 2 })),
            })),
          })),
        }));
        progForCalc = { ...selectedProgram, pl: { ...selectedProgram.pl, customWeeks: synthWeeks as any } } as UserProgram;
      }
    }
    // Для BB используем как есть; для PL также через тот же движок (BASE_MUSCLES 6)
    return computePlanQualityFor(progForCalc, effectiveLevel, {
      onCourse: usePed,
      courseIntensity: courseIntensity as any,
      labMult: labMult,
    });
  }, [selectedProgram, effectiveLevel, usePed, courseIntensity, labMult, division]);

  const analysisNatural = useMemo(() => {
    if (!usePed || !selectedProgram) return null;
    let progForCalc: UserProgram = selectedProgram;
    if (division === 'pl' && selectedProgram.pl?.sourceCycleId && !selectedProgram.pl.customWeeks) {
      const tpl = getCycleById(selectedProgram.pl.sourceCycleId);
      if (tpl) {
        const synthWeeks = (tpl.weeks && tpl.weeks.length ? tpl.weeks : [tpl.week1]).map((days, wi) => ({
          week: wi + 1,
          phase: 'accumulation' as const,
          deload: false,
          days: days.map((d, di) => ({
            name: `День ${di + 1}`,
            exercises: d.exercises.map(ex => ({
              name: ex.name,
              lift: 'accessory' as const,
              muscle: (ex as any).group || 'chest',
              sets: ex.sets.map(s => ({ pct: s.pct, reps: s.reps, sets: s.sets, rir: s.rir ?? 2 })),
            })),
          })),
        }));
        progForCalc = { ...selectedProgram, pl: { ...selectedProgram.pl, customWeeks: synthWeeks as any } } as UserProgram;
      }
    }
    return computePlanQualityFor(progForCalc, effectiveLevel, { onCourse: false, courseIntensity: 'moderate', labMult: useLab ? labMult : 1 });
  }, [selectedProgram, effectiveLevel, usePed, useLab, labMult, division]);

  const pro = useMemo(() => {
    if (!selectedProgram || !analysis) return null;
    try {
      const g = (selectedProgram.meta.goal || goal || 'hypertrophy') as string;
      return analyzeProQuality(selectedProgram, division, effectiveLevel, g, analysis.perMuscle);
    } catch { return null; }
  }, [selectedProgram, division, effectiveLevel, goal, analysis]);

  // ——— Графики: тоннаж/КПШ/нагрузка — полный комплект ———
  const lmsChart: LMSWeekMetric[] | null = useMemo(() => {
    if (division !== 'pl' || !selectedProgram?.pl) return null;
    try {
      const weeks: any[] = (selectedProgram.pl as any).customWeeks || [];
      let plWeeks: any[] = weeks;
      if (!plWeeks.length && (selectedProgram.pl as any).sourceCycleId) {
        const tpl = getCycleById((selectedProgram.pl as any).sourceCycleId);
        if (tpl) {
          const rawWeeks: any[] = (tpl as any).weeks && (tpl as any).weeks.length ? (tpl as any).weeks : [(tpl as any).week1];
          plWeeks = rawWeeks.map((days: any, wi: number) => ({
            week: wi + 1,
            phase: 'accumulation' as const,
            deload: false,
            days: (days as any[]).map((d: any, di: number) => ({
              name: `День ${di + 1}`,
              exercises: (d.exercises as any[]).map((ex: any) => ({
                name: ex.name,
                lift: 'accessory' as const,
                muscle: (ex as any).group || 'chest',
                sets: (ex.sets as any[]).map((s: any) => ({ pct: s.pct, reps: s.reps, sets: s.sets, rir: s.rir ?? 2 })),
              })),
            })),
          }));
        }
      }
      if (!plWeeks.length) return null;
      const workMax: any = (selectedProgram.pl as any).workMax || { squat: 140, bench: 100, dead: 160 };
      const pmMap: Record<string, number> = {
        'Присед': workMax.squat || 140,
        'Приседания со штангой': workMax.squat || 140,
        'Жим лежа': workMax.bench || 100,
        'Жим лёжа': workMax.bench || 100,
        'Становая тяга': workMax.dead || 160,
        'Тяга': workMax.dead || 160,
      };
      const fallbackPm = 80;
      const getPm = (name: string) => {
        if (pmMap[name] != null) return pmMap[name];
        const n = norm(name);
        for (const k of Object.keys(pmMap)) if (n.includes(norm(k)) || norm(k).includes(n)) return pmMap[k];
        return fallbackPm;
      };
      const chart: LMSWeekMetric[] = [];
      for (const w of plWeeks) {
        const sessions: any[] = [];
        for (const d of (w.days || [])) {
          const exs: any[] = [];
          for (const ex of (d.exercises || [])) {
            const pm = getPm(ex.name);
            const sets = (ex.sets || []).map((s: any) => ({ weight: pm * (s.pct || 0.7), reps: s.reps || 5, sets: s.sets || 3 }));
            exs.push({ name: ex.name, group: ex.muscle || 'chest', coef: 1, mnosz: 1, pm, sets });
          }
          const m = calcSessionMetrics(exs);
          sessions.push(m);
        }
        let ton = 0, kpsh = 0, relW = 0, uoiN = 0, intFB = 0;
        for (const s of sessions) { ton += s.tonnage; kpsh += s.kpsh; relW += s.relIntensity * s.kpsh; uoiN += s.uoi * s.kpsh; intFB += s.intFB; }
        const relInt = kpsh > 0 ? relW / kpsh : 0;
        const uoi = kpsh > 0 ? uoiN / kpsh : 0;
        chart.push({ week: (w as any).week || chart.length + 1, tonnage: Math.round(ton), kpsh, relInt: Math.round(relInt * 1000) / 1000, uoi: Math.round(uoi * 100) / 100, intFB: Math.round(intFB) });
      }
      return chart.length ? chart : null;
    } catch { return null; }
  }, [selectedProgram, division]);

  const bbChart = useMemo(() => {
    if (division !== 'bb' || !selectedProgram?.bb) return null;
    try {
      const per = analysis?.perMuscle || [];
      if (!per.length) return null;
      return per.map(p => ({
        muscle: ru(p.muscle),
        sets: p.peakSets,
        тяж: Math.round(p.peakSets * 0.6),
        памп: Math.round(p.peakSets * 0.4),
        mrv: p.mrv,
      }));
    } catch { return null; }
  }, [selectedProgram, division, analysis]);

  const bbExtra = useMemo(() => {
    if (division !== 'bb' || !selectedProgram?.bb) return null;
    try {
      const weeks: any[] = (selectedProgram.bb as any).weeks || [];
      if (!weeks.length) return null;
      const totalWeeks = weeks.length;
      const freq: Record<string, number> = {};
      let hardSets = 0, totalSets = 0, rirSum = 0, rirN = 0;
      for (const w of weeks) {
        for (const s of (w.sessions || [])) {
          const musclesInSess = new Set<string>();
          for (const b of (s.blocks || [])) {
            const mu = String(b.muscle || '').toLowerCase();
            if (mu) musclesInSess.add(mu);
            const sets = (b.sets?.length || 0);
            totalSets += sets;
            const rir = b.sets?.[0]?.rir ?? 2;
            if (Number.isFinite(rir) && rir < 1) hardSets += sets;
            if (Number.isFinite(rir)) { rirSum += rir * sets; rirN += sets; }
          }
          for (const mu of musclesInSess) freq[mu] = (freq[mu] || 0) + 1;
        }
      }
      const freqPerWeek: Record<string, number> = {};
      for (const [k, v] of Object.entries(freq)) freqPerWeek[k] = Math.round((v / totalWeeks) * 10) / 10;
      return { freqPerWeek, hardSets, totalSets, avgRir: rirN ? rirSum / rirN : 0 };
    } catch { return null; }
  }, [selectedProgram, division]);

  const hasData = !!(selectedProgram && (division === 'bb' ? selectedProgram.bb : selectedProgram.pl));
  const hasAnyProgram = programs.length > 0 || !!propsProgram;

  if (!hasAnyProgram) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программ — PRO</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['bb', 'pl'] as Division[]).map(d => (
            <button key={d} onClick={() => setDivision(d)} style={{ flex: 1, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 11, border: division === d ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: division === d ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: division === d ? ACCENT : '#fff' }}>{d === 'bb' ? '💪 ББ — гипертрофия' : '🏋️ ПЛ — сила'}</button>
          ))}
        </div>
        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 12, color: '#fff', marginBottom: 12, lineHeight: 1.5 }}>Нет сохранённых программ. Создайте программу в «Планировщик» → «Мои программы» — и здесь появится полный разбор: объём по группам (MEV/MAV/MRV), PED-коррекция, лабораторная коррекция, рекомендации.</div>
          <button onClick={onBuildPlan} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>📋 Перейти к построению плана</button>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программ — PRO</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['bb', 'pl'] as Division[]).map(d => (
            <button key={d} onClick={() => setDivision(d)} style={{ flex: 1, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 11, border: division === d ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)', background: division === d ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)', color: division === d ? ACCENT : '#fff' }}>{d === 'bb' ? '💪 ББ — гипертрофия' : '🏋️ ПЛ — сила'}</button>
          ))}
        </div>
        <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#fff', marginBottom: 8 }}>Разделение «{division === 'bb' ? 'ББ' : 'ПЛ'}» не содержит данных в выбранной программе «{selectedProgram?.meta.title}».</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>{division === 'bb' ? 'ББ-программа хранит недели → сессии → блоки (мышечные группы). Создайте ББ-план в ПЛ/ББ-авто или ручном конструкторе.' : 'ПЛ-программа хранит недели → дни → упражнения (присед/жим/тяга). Клонируйте СРЦ-цикл или создайте кастом.'}</div>
          <button onClick={onBuildPlan} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>📋 Открыть планировщик</button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программ — PRO</div>
        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 12, color: '#fff', marginBottom: 12 }}>Недостаточно данных для оценки. Добавьте упражнения в программу «{selectedProgram?.meta.title}».</div>
          <button onClick={onBuildPlan} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>📋 Редактировать программу</button>
        </div>
      </div>
    );
  }

  const sc = analysis.score >= 80 ? '#22c55e' : analysis.score >= 50 ? '#f59e0b' : '#ef4444';
  const pedOn = usePed;
  const programOptions = programs.map(p => ({ id: p.meta.id, label: `${p.meta.title} · ${p.meta.direction.toUpperCase()} · ${p.meta.level}`, desc: `${p.meta.weeks} нед · ${p.meta.daysPerWeek} дн/нед` }));

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, margin: '4px 0 4px' }}>🎯 Калькулятор качества программ — PRO</div>
      <div style={{ fontSize: 11, color: '#fff', marginBottom: 10, lineHeight: 1.4 }}>Два разделения: <b style={{ color: ACCENT }}>ПЛ — сила</b> (присед/жим/тяга, интенсивность, частота) и <b style={{ color: '#a78bfa' }}>ББ — гипертрофия</b> (MEV/MAV/MRV по мышцам). Кнопка учёта ПЕД + лаборатория + уровень — живой пересчёт, не «черти что».</div>

      {/* Выбор программы */}
      {programs.length > 1 && (
        <div style={{ marginBottom: 8 }}>
          <PopupSelect label="Программа" value={selectedProgram.meta.id} options={programOptions} onChange={setSelectedId} />
        </div>
      )}
      {selectedProgram && (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#fff', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span><b style={{ color: ACCENT }}>{selectedProgram.meta.title}</b> · {selectedProgram.meta.direction.toUpperCase()} · {selectedProgram.meta.level} · {selectedProgram.meta.weeks} нед</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{division === 'bb' ? 'ББ-недель: ' + (selectedProgram.bb?.weeks.length || 0) : 'ПЛ-недель: ' + (selectedProgram.pl?.customWeeks?.length || (selectedProgram.pl?.sourceCycleId ? 1 : 0))}</span>
        </div>
      )}

      {/* Разделения */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['bb', 'pl'] as Division[]).map(d => {
          const active = division === d;
          return (
            <button key={d} onClick={() => setDivision(d)} style={{
              flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 12,
              border: active ? `1px solid ${d === 'bb' ? '#a78bfa' : ACCENT}` : '1px solid rgba(255,255,255,0.08)',
              background: active ? (d === 'bb' ? 'rgba(167,139,250,0.14)' : 'rgba(0,230,138,0.14)') : 'rgba(255,255,255,0.02)',
              color: active ? (d === 'bb' ? '#a78bfa' : ACCENT) : '#fff',
            }}>{d === 'bb' ? '💪 ББ — гипертрофия' : '🏋️ ПЛ — сила'}</button>
          );
        })}
      </div>

      {/* Параметры — уровень + ПЕД + лаборатория */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <PopupSelect label="Уровень" value={effectiveLevel} options={[
          { id: 'beginner', label: 'Новичок', desc: 'MEV низкий, MRV до 15' },
          { id: 'intermediate', label: 'Средний', desc: 'MEV 8-10, MRV до 20-24' },
          { id: 'advanced', label: 'Продвинутый', desc: 'MEV 10-12, MRV до 28' },
          { id: 'enhanced', label: 'Enhanced (ПЕД)', desc: 'MRV +15% и выше' },
        ]} onChange={v => setLevelOverride(v as LevelKey)} />
        <div style={{ padding: '8px 10px', borderRadius: 12, border: `1px solid ${pedOn ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)'}`, background: pedOn ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: pedOn ? '#f87171' : '#fff' }}>{pedOn ? '💉 На курсе — ПЕД учитывается' : '🌱 Натурал — без ПЕД'}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setUsePed(false)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 800, border: !pedOn ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)', background: !pedOn ? 'rgba(34,197,94,0.15)' : 'transparent', color: !pedOn ? '#22c55e' : '#fff' }}>Натурал</button>
            <button onClick={() => setUsePed(true)} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 800, border: pedOn ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', background: pedOn ? 'rgba(239,68,68,0.14)' : 'transparent', color: pedOn ? '#f87171' : '#fff' }}>На курсе</button>
          </div>
          {pedOn && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['mild', 'moderate', 'heavy'] as const).map(k => {
                const on = courseIntensity === k;
                const label = k === 'mild' ? 'Mild' : k === 'moderate' ? 'Moderate' : 'Heavy';
                return <button key={k} onClick={() => setCourseIntensity(k)} style={{ padding: '4px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 9, fontWeight: 700, border: on ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.08)', background: on ? 'rgba(239,68,68,0.12)' : 'transparent', color: on ? '#f87171' : '#fff' }}>{label}{on ? ' ✓' : ''}</button>;
              })}
            </div>
          )}
          {pedOn && pedAdapt && (
            <div style={{ fontSize: 9, color: '#fff', lineHeight: 1.3 }}>MRV ×{pedAdapt.combinedMrvMultiplier.toFixed(2)} · Восст ×{pedAdapt.combinedRecoveryMultiplier.toFixed(2)} · {pedAdapt.periWorkoutCarbs === 'high' ? 'Углеводы высокие' : 'Углеводы умеренные'}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setUseLab(v => !v)} style={{ flex: 1, minWidth: 140, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 10, border: useLab ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', background: useLab ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.02)', color: useLab ? '#f59e0b' : '#fff' }}>{useLab ? `🧪 Лаборатория учтена ×${labMult.toFixed(2)}` : '🧪 Учитывать лабораторию'}</button>
        <button onClick={() => setShowDetails(v => !v)} style={{ padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', color: '#fff' }}>{showDetails ? 'Скрыть детали' : 'Показать детали'}</button>
      </div>
      {useLab && labAdjust.warnings.length > 0 && (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          {labAdjust.warnings.map((w, i) => <div key={i}>• {w}</div>)}
          {labAdjust.intensityNote && <div style={{ marginTop: 4, color: '#f59e0b' }}>💡 {labAdjust.intensityNote}</div>}
        </div>
      )}
      {pedOn && pedAdapt?.risks.length ? (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          {pedAdapt.risks.slice(0, 3).map((r, i) => <div key={i}>⚠ {r}</div>)}
        </div>
      ) : null}

      {/* Сравнение натурал vs курс */}
      {usePed && analysisNatural && (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, color: '#fff' }}>
          <span>Натурал: <b style={{ color: analysisNatural.score >= 80 ? '#22c55e' : analysisNatural.score >= 50 ? '#f59e0b' : '#ef4444' }}>{analysisNatural.score}/100 {analysisNatural.grade}</b></span>
          <span>С ПЕД: <b style={{ color: sc }}>{analysis.score}/100 {analysis.grade}</b></span>
          <span style={{ color: analysis.score > analysisNatural.score ? '#22c55e' : 'rgba(255,255,255,0.6)' }}>{analysis.score - analysisNatural.score > 0 ? `+${analysis.score - analysisNatural.score}` : `${analysis.score - analysisNatural.score}`} баллов</span>
        </div>
      )}

      {/* Score */}
      <div style={{ padding: 12, borderRadius: 12, background: analysis.score >= 80 ? '#22c55e08' : analysis.score >= 50 ? '#f59e0b08' : '#ef444408', border: '1px solid ' + sc + '40', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: sc }}>Оценка качества {analysis.grade} · {division === 'bb' ? 'ББ-гипертрофия' : 'ПЛ-сила'}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: sc }}>{analysis.score}<span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>/100</span></span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: analysis.score + '%', background: sc, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          Уровень <b>{effectiveLevel}</b> · {pedOn ? `ПЕД ×${pedAdapt?.combinedMrvMultiplier.toFixed(2) ?? '1.2'}` : 'Натурал'} · Лаб ×{labMult.toFixed(2)} · {division === 'bb' ? 'ББ-объём по мышцам' : 'ПЛ-объём по группам'} · {analysis.perMuscle.length} групп
        </div>
        {analysis.issues.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {analysis.issues.map((iss, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: iss.startsWith('⚠') ? '#f59e0b' : iss.startsWith('⬇') ? '#3b82f6' : '#fff' }}>
                <span style={{ fontWeight: 700 }}>{iss}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Объём по группам — {division === 'bb' ? 'ББ (гипертрофия)' : 'ПЛ (сила)'} · Сеты · MEV · MAV · MRV · %MRV</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {analysis.perMuscle.map(pm => {
          const st = pm.status === 'over' ? '#ef4444' : pm.status === 'low' ? '#3b82f6' : pm.status === 'high' ? '#f59e0b' : '#22c55e';
          const pct = pm.mrv > 0 ? Math.round((pm.peakSets / pm.mrv) * 100) : 0;
          const bar = Math.min(100, pct);
          return (
            <div key={pm.muscle} style={{ padding: '8px 10px', borderRadius: 10, background: st + '10', border: '1px solid ' + st + '30' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, color: '#fff', minWidth: 90 }}>{ru(pm.muscle)}</span>
                <span style={{ color: st, fontWeight: 800 }}>{pm.peakSets} сет</span>
                <span style={{ color: '#fff', fontSize: 10 }}>· MEV {pm.mev} · MAV {pm.mav} · MRV {pm.mrv} · {pct}%</span>
                <span style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800, background: st, color: pm.status === 'high' || pm.status === 'low' ? '#000' : '#fff' }}>{pm.status === 'over' ? 'ПЕРЕГРУЗ' : pm.status === 'low' ? 'НЕДОГРУЗ' : pm.status === 'high' ? 'ВЫСОКО' : 'ОК'}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: bar + '%', background: st }} />
              </div>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#fff' }}>
                <span>Средн/нед: {pm.avgSets} сет</span>
                <span style={{ color: pct > 100 ? '#ef4444' : 'rgba(255,255,255,0.7)' }}>{pct > 100 ? `+${pct - 100}% сверх MRV` : `${100 - pct}% запас до MRV`}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* PRO — паттерны / углы / растяжка / техника / цель */}
      {pro && (
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: pro.scoreDelta >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${pro.scoreDelta >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: pro.scoreDelta >= 0 ? '#22c55e' : '#f87171' }}>PRO-корректировка: {pro.scoreDelta >= 0 ? `+${pro.scoreDelta}` : `${pro.scoreDelta}`} баллов</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: sc }}>Итог PRO: {Math.max(0, Math.min(100, analysis.score + pro.scoreDelta))}/100</span>
            <span style={{ fontSize: 10, color: '#fff' }}>Паттерны {pro.patterns.filter(p => p.ok).length}/{pro.patterns.length} · Углы {pro.angles.filter(a => a.ok).length}/{pro.angles.length} · Растяжка {pro.stretches.filter(s => s.ok).length}/{pro.stretches.length}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🔀 Паттерны — разнообразие движений</div>
              {pro.patterns.map(p => (
                <div key={p.muscle} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, color: p.ok ? '#22c55e' : '#f59e0b', marginBottom: 2 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{ru(p.muscle)}: {p.patterns.join(', ') || '—'}</span>
                  <span style={{ color: p.ok ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{p.distinct} / {p.expected.length} {p.ok ? '✓' : '⚠'}</span>
                </div>
              ))}
              {pro.patterns.every(p => p.ok) && <div style={{ fontSize: 9, color: '#22c55e', marginTop: 4 }}>Паттерны покрыты — разнообразие достаточное для гипертрофии/силы.</div>}
            </div>

            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>📐 Углы — проработка головок/сегментов</div>
              {pro.angles.map(a => (
                <div key={a.muscle} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, color: a.ok ? '#22c55e' : '#f59e0b', marginBottom: 2 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{ru(a.muscle)}: {a.angles.join(', ') || '—'}</span>
                  <span style={{ color: a.ok ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{Math.round(a.coverage * 100)}% {a.ok ? '✓' : '⚠'}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🧘 Растяжка — stretch-фаза / удлинённая позиция</div>
              {pro.stretches.map(s => (
                <div key={s.muscle} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{ru(s.muscle)}: {s.stretchExercises.join(', ') || '—'}</span>
                  <span style={{ color: s.ok ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{s.ok ? 'есть ✓' : 'нет ✕'}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '8px 10px', borderRadius: 10, background: pro.technique.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${pro.technique.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>⚡ Техника — интенсификация</div>
              <div style={{ fontSize: 10, color: '#fff' }}>Блоков с техникой: <b style={{ color: pro.technique.ok ? '#22c55e' : '#f59e0b' }}>{pro.technique.withTechnique}/{pro.technique.totalBlocks} ({pro.technique.pct}%)</b> · distinct: {pro.technique.distinct.join(', ') || 'нет'}</div>
              {pro.technique.issue && <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 4 }}>{pro.technique.issue}</div>}
            </div>

            <div style={{ padding: '8px 10px', borderRadius: 10, background: pro.goalAlignment.ok ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${pro.goalAlignment.ok ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🎯 Привязка к цели — «{pro.goalAlignment.goal}»</div>
              <div style={{ fontSize: 10, color: '#fff' }}>Объём {pro.goalAlignment.volumePctAvg}% MRV · Техники {pro.goalAlignment.techniquePct}% · Растяжка {Math.round(pro.goalAlignment.stretchCoverage * 100)}%</div>
              {pro.goalAlignment.issue && <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 4 }}>{pro.goalAlignment.issue}</div>}
              {pro.goalAlignment.recommendation && <div style={{ fontSize: 9, color: '#22c55e', marginTop: 4 }}>💡 {pro.goalAlignment.recommendation}</div>}
            </div>

            {(pro.totalIssues.length > 0 || pro.totalRecommendations.length > 0) && (
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
                {pro.totalIssues.slice(0, 6).map((iss, i) => <div key={i} style={{ color: '#f59e0b' }}>• {iss}</div>)}
                {pro.totalRecommendations.slice(0, 6).map((r, i) => <div key={`r-${i}`} style={{ color: '#22c55e' }}>{r}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Графики — полный комплект параметров качества */}
      {division === 'pl' && lmsChart && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📈 Графики нагрузки ПЛ — тоннаж / КПШ / интенсивность (источники: Фунтиков, Черняк, Прилепин, Шейко)</div>
          <TrainingMetricsChart lms={lmsChart} />
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 6, lineHeight: 1.4 }}>
            Тоннаж = Σвес×пов×под×Множ · КПШ = Σпов×под · Ср.вес = Тоннаж/КПШ · Инт.отн = Ср.вес/(PM×Множ) · УОИ = ΣКПШ×Коэф/ΣКПШ · Инт.Ф+Б = Σk(вес/PM)×вес×пов×под×Множ×Коэф. По Прилепину: оптимум 60-70% — КПШ 18-30, 70-80% — 12-24 и т.д.
          </div>
        </div>
      )}
      {division === 'bb' && bbChart && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📊 Графики объёма ББ — тяж/памп vs MRV (Israetel, Schoenfeld, Helms)</div>
          <TrainingMetricsChart bb={bbChart} />
          {bbExtra && (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, color: '#fff' }}>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>Всего сетов/ротация: <b>{bbExtra.totalSets}</b></div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>Хард-сетов RIR&lt;1: <b style={{ color: bbExtra.hardSets > 6 ? '#ef4444' : '#fff' }}>{bbExtra.hardSets}</b></div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>Ср. RIR: <b>{bbExtra.avgRir.toFixed(1)}</b></div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>Частота/нед: <b>{Object.entries(bbExtra.freqPerWeek).slice(0, 4).map(([k, v]) => `${ru(k)} ${v}×`).join(' · ') || '—'}</b></div>
            </div>
          )}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.3 }}>Israetel: MEV/MAV/MRV по уровню; Schoenfeld: частота 2×/нед для гипертрофии; Helms: hard-cap по уровню (нач 3/ сред 6/ продв 10). Зелёный — тяж, голубой — памп, красный пунктир — MRV.</div>
        </div>
      )}

      {showDetails && (
        <ExpandableCard title="📊 Детальный разбор" icon="🔬" short="Нажмите чтобы раскрыть методологию" full={
          <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
            <div style={{ marginBottom: 6 }}><b style={{ color: ACCENT }}>Методология:</b> MEV/MAV/MRV из <i>Israetel Hypertrophy Guide</i> по уровню ({effectiveLevel}) + PED-надбавка {pedOn ? `×${pedAdapt?.combinedMrvMultiplier.toFixed(2)}` : '×1.0'} + лаб-коррекция ×{labMult.toFixed(2)}. Пик — макс недельный объём, среднее — по мезоциклу.</div>
            <div style={{ marginBottom: 6 }}><b>Статусы:</b> <span style={{ color: '#3b82f6' }}>low</span> — ниже MEV (недогруз), <span style={{ color: '#22c55e' }}>ok</span> — оптимум, <span style={{ color: '#f59e0b' }}>high</span> — ≥MAV, <span style={{ color: '#ef4444' }}>over</span> — сверх MRV (перетрен).</div>
            <div style={{ marginBottom: 6 }}><b>ПЛ vs ББ:</b> ББ — 15 групп, акцент на гипертрофию (объём сетов); ПЛ — те же 6 базовых групп, но интерпретация иная (частота приседа/жима/тяги, интенсивность %1RM). Переключатель вверху меняет интерпретацию без пересоздания программы.</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>Подсказка: для ББ держите пик 85-95% MRV, для ПЛ — 70-85% (больше интенсивности). PED поднимает MRV, но не отменяет технику/восстановление. Лаборатория снижает MRV при воспалении/печени/почках.</div>
          </div>
        } />
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onBuildPlan} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>📋 Редактировать программу</button>
        <button onClick={() => setDivision(d => d === 'bb' ? 'pl' : 'bb')} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>⇄ Переключить на {division === 'bb' ? 'ПЛ' : 'ББ'}</button>
      </div>
    </div>
  );
};

export default CalcQualityTab;
