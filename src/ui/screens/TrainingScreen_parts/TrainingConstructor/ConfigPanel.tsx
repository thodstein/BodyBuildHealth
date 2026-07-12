import React, { useMemo, useState } from 'react';
import { PopupSelect } from '../../SRCBBScreen_parts/TrainingPopups';
import { TRAINING_SPLITS } from '../../../../engines/training.engine';
import { LMS_CYCLES, normalizeCycleDirection } from '../../../../data/lms-cycles/lms-cycle-index';
import { FULL_PROGRAM_LIBRARY } from '../../../../engines/complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from '../programs-data';
import { getMethodsByCategory, type TrainingMethod } from '../../../../engines/training-methodology.engine';
import { SPLIT_PATTERNS } from '../../../../engines/bb/bb-split-patterns';
import { ACCENT, DIM, CONFIG_LABELS } from './types';
import { DIRECTION_METHOD_MAP, getRecommendedMethods, getRecommendedMethodsForSplit } from '../../../../engines/cycle-method-map';

type DirFilter = 'all' | 'strength' | 'bodybuilding';

interface Props {
  manualCfg: Record<string, string>;
  setManual: (k: string, v: string) => void;
  onLoadProgram: (programId: string) => void;
  targetTonnage: Record<string, number>;
  setTargetTonnage: (g: string, v: number) => void;
}

const ConfigSection: React.FC<{ title: string; color: string; children: React.ReactNode }> = ({ title, color, children }) => (
  <div style={{
    background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, marginBottom: 6,
    border: '1px solid rgba(255,255,255,0.04)',
  }}>
    <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 6, letterSpacing: '-0.02em' }}>{title}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>{children}</div>
  </div>
);

/** PopupSelect-обёртка с возможностью подсветки рекомендованных */
const Sel: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  options: { id: string; label: string; desc?: string }[];
  hint?: string;
  recommendedSet?: Set<string>; // имена методов для подсветки
}> = ({ label, value, onChange, options, hint, recommendedSet }) => {
  const markedOptions = useMemo(() => options.map(o => {
    const isRec = recommendedSet && recommendedSet.has(o.label);
    return {
      ...o,
      label: isRec ? '★ ' + o.label : o.label,
      desc: isRec ? (o.desc ? o.desc + ' · ★ Рекомендовано' : '★ Рекомендовано') : o.desc,
    };
  }), [options, recommendedSet]);
  return <PopupSelect label={label} value={value} onChange={onChange} options={markedOptions} hint={hint} />;
};

export const ConfigPanel: React.FC<Props> = ({ manualCfg, setManual, onLoadProgram, targetTonnage, setTargetTonnage }) => {
  const allPrograms = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS];
  const selectedList = Object.entries(manualCfg).filter(([, v]) => v);

  const [directionFilter, setDirectionFilter] = useState<DirFilter>('all');

  const selectedSplitId = manualCfg.split || '';
  const selectedCycleId = manualCfg.cycle || '';

  // Рекомендованные методы для выбранного сплита
  const splitRecommended = useMemo(() => {
    const names = getRecommendedMethodsForSplit(selectedSplitId);
    return new Set(names);
  }, [selectedSplitId]);

  // Рекомендованные методы по направлению (из выбранных сплита/цикла)
  const dirRecommended = useMemo(() => {
    const selSplit = TRAINING_SPLITS[selectedSplitId];
    const selCycle = LMS_CYCLES.find(c => c.meta.id === selectedCycleId);
    const splitDir = selSplit?.direction || null;
    const cycleDir = selCycle ? normalizeCycleDirection(selCycle.meta.direction) : null;
    const effectiveDir = cycleDir || splitDir;
    if (effectiveDir) return new Set(getRecommendedMethods(effectiveDir));
    return new Set<string>();
  }, [selectedSplitId, selectedCycleId]);

  // Объединённые рекомендации
  const combinedRecommended = useMemo(() => {
    const s = new Set<string>();
    dirRecommended.forEach(v => s.add(v));
    splitRecommended.forEach(v => s.add(v));
    return s;
  }, [dirRecommended, splitRecommended]);

  // Фильтрация сплитов по направлению
  const filteredSplits = useMemo(() => {
    return Object.entries(TRAINING_SPLITS).filter(([, s]: [string, any]) => {
      if (directionFilter === 'all') return true;
      if (!s.direction) return true;
      return s.direction === directionFilter || s.direction === 'both';
    });
  }, [directionFilter]);

  // Фильтрация циклов по направлению
  const filteredCycles = useMemo(() => {
    return LMS_CYCLES.filter(c => {
      if (directionFilter === 'all') return true;
      const nd = normalizeCycleDirection(c.meta.direction);
      return nd === directionFilter || nd === 'both';
    });
  }, [directionFilter]);

  // Фильтрация программ по направлению
  const filteredPrograms = useMemo(() => {
    return allPrograms.filter(p => {
      if (directionFilter === 'all') return true;
      if (!p.direction) return true;
      return p.direction === directionFilter || p.direction === 'both';
    });
  }, [directionFilter]);

  const dirTabs: { id: DirFilter; label: string }[] = [
    { id: 'all', label: 'Все направления' },
    { id: 'strength', label: '🏋️ Сила' },
    { id: 'bodybuilding', label: '💪 Бодибилдинг' },
  ];

  const groups = [
    { id: 'chest', label: 'Грудь' }, { id: 'back', label: 'Спина' }, { id: 'legs', label: 'Ноги' },
    { id: 'shoulders', label: 'Плечи' }, { id: 'arms', label: 'Руки' }, { id: 'core', label: 'Кор' },
  ];

  const methodSel = (cat: string, key: string, hint?: string) => (
    <Sel label={CONFIG_LABELS[key] || key} value={manualCfg[key] || ''} onChange={v => setManual(key, v)}
      options={getMethodsByCategory(cat).map((m: TrainingMethod) => ({ id: m.name, label: m.name, desc: m.bestFor }))}
      hint={hint}
      recommendedSet={combinedRecommended} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ─── ФИЛЬТР ПО НАПРАВЛЕНИЮ ─── */}
      <div style={{
        display: 'flex', borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)', marginBottom: 2,
      }}>
        {dirTabs.map(t => (
          <button key={t.id} onClick={() => setDirectionFilter(t.id)}
            style={{
              flex: 1, padding: '8px 4px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: directionFilter === t.id ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
              border: 'none', borderRight: '1px solid rgba(255,255,255,0.06)',
              color: directionFilter === t.id ? ACCENT : 'rgba(255,255,255,0.6)',
              transition: 'background 0.2s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── БАЗОВАЯ СТРУКТУРА ─── */}
      <ConfigSection title="🏗️ БАЗОВАЯ СТРУКТУРА" color="#60a5fa">
        <Sel label="Тип сплита" value={manualCfg.split || ''} onChange={v => setManual('split', v)}
          options={filteredSplits.map(([id, s]: [string, any]) => {
            const d = (s.direction || '').toLowerCase();
            const dirTag = ['powerlifting','pl','strength','peaking_pl','bench','deadlift'].some(x => d.includes(x)) ? '🏋️' : ['bodybuilding','hypertrophy','peaking_bb','cutting'].some(x => d.includes(x)) ? '💪' : '';
            const dirMatch = (d: string) => ['powerlifting','peaking_pl','bench','deadlift','pl','squat'].includes(d) ? 'strength' : (['bodybuilding','hypertrophy','peaking_bb','cutting','contest_prep'].includes(d)) ? 'bodybuilding' : 'both';
            const isRec = directionFilter !== 'all' && (!s.direction || s.direction === 'both' || dirMatch(s.direction) === directionFilter);
            return { id, label: (dirTag ? dirTag + ' ' : '') + s.name, desc: s.desc + (isRec ? ' · ★ Рекомендовано' : '') };
          })} hint="Набор групп по дням" />
        <Sel label="Тип цикла" value={manualCfg.cycle || ''} onChange={v => setManual('cycle', v)}
          options={filteredCycles.map((c: any) => {
            const catTag = c.meta.id.startsWith('cycle-bb') ? 'BB' : c.meta.id.startsWith('block') ? 'Блок' : c.meta.id.startsWith('embed') ? 'Встр' : c.meta.id.startsWith('src2') ? 'СРЦ2' : 'СРЦ';
            const isRec = directionFilter !== 'all' && normalizeCycleDirection(c.meta.direction) === directionFilter;
            return { id: c.meta.id, label: `[${catTag}] ${c.meta.title}`, desc: c.meta.level + ' · ' + normalizeCycleDirection(c.meta.direction) + (isRec ? ' · ★ Рекомендовано' : '') };
          })} hint="Силовые циклы / блоки / встроенные" />
        <Sel label="Программа тренировок" value={manualCfg.program || ''} onChange={v => setManual('program', v)}
          options={filteredPrograms.map((p: any) => ({ id: p.id, label: p.name, desc: p.type + ' · ' + p.goal + ' · ' + p.level }))}
          hint="Готовые программы из библиотеки" />
        {methodSel('frequency', 'frequency', 'Количество и частота тренировок')}
      </ConfigSection>

      {/* ─── ЦЕЛЕВОЙ ТОННАЖ ─── */}
      <ConfigSection title="⚖️ ЦЕЛЕВОЙ ТОННАЖ (кг/нед)" color="#00e68a">
        {groups.map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: DIM, flex: 1 }}>{g.label}</span>
            <input 
              type="number" value={targetTonnage[g.id] || ''} 
              onChange={e => setTargetTonnage(g.id, parseInt(e.target.value) || 0)}
              style={{ width: 60, background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: ACCENT, borderRadius: 4, fontSize: 10, textAlign: 'center', padding: '2px 0' }}
            />
          </div>
        ))}
      </ConfigSection>

      {/* ─── МЕТОДОЛОГИЯ ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ConfigSection title="📈 ПРОГРЕССИЯ" color="#a78bfa">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {methodSel('periodization', 'periodization')}
            {methodSel('progression', 'progression')}
          </div>
        </ConfigSection>

        <ConfigSection title="🎯 ИНТЕНСИВНОСТЬ" color="#f59e0b">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {methodSel('intensity', 'intensity')}
            {methodSel('technique', 'technique')}
            {methodSel('volume', 'volume')}
          </div>
        </ConfigSection>
      </div>

      <ConfigSection title="🎯 СПЕЦИАЛИЗАЦИЯ" color="#ec4899">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {methodSel('specialization', 'specialization')}
        </div>
      </ConfigSection>

      {/* ─── BB-АВТО ДВИЖОК ─── */}
      <ConfigSection title="🏋️ BB-АВТО ДВИЖОК" color="#f97316">
        <Sel label="Режим генерации" value={manualCfg.generator || ''} onChange={v => setManual('generator', v)}
          options={[
            { id: '', label: '🔨 Ручная сборка (по группам)' },
            { id: 'bb_split', label: '🧩 BB Generic-сплит (авто-упражнения)' },
            { id: 'bb_cycle', label: '📋 BB ПРОФ-цикл (готовые упражнения)' },
          ]} hint={manualCfg.generator === 'bb_cycle' ? 'Использует 12 ПРОФ-циклов с конкретными упражнениями' : 'BB-авто использует bb-builder.engine с фазовой периодизацией'} />
        {manualCfg.generator === 'bb_split' && (
          <>
            <Sel label="BB-сплит (ротация)" value={manualCfg.bbSplit || ''} onChange={v => setManual('bbSplit', v)}
              options={SPLIT_PATTERNS.map(p => ({ id: p.id, label: p.name, desc: p.description + ' · ' + p.rotationDays + 'дн ротация' }))} />
            <Sel label="Стратегия нагрузки" value={manualCfg.bbLoad || ''} onChange={v => setManual('bbLoad', v)}
              options={[
                { id: 'double_progression', label: '🔄 Двойная прогрессия (рекоменд.)' },
                { id: 'linear', label: '📈 Линейная +2.5кг/нед' },
                { id: 'wave', label: '🌊 Волновая 3-нед циклы' },
                { id: 'rpe_based', label: '🎯 RPE-базированная' },
              ]} />
          </>
        )}
        {manualCfg.generator === 'bb_cycle' && (
          <>
            <Sel label="BB-цикл (программа)" value={manualCfg.bbCycle || ''} onChange={v => setManual('bbCycle', v)}
              options={(() => {
                const bbCycles = LMS_CYCLES.filter(c => c.meta.direction === 'bodybuilding' || c.meta.tags?.includes('bodybuilding'));
                return bbCycles.map(c => ({ id: c.meta.id, label: c.meta.title, desc: (c.meta.targetFocus || c.meta.level) + ' · ' + c.meta.weeks + 'нед ' + c.meta.sessionsPerWeek + '×' }));
              })()} hint="12 ПРОФ-циклов с фиксированными упражнениями, RIR-прогрессией и фазами" />
            <Sel label="Стратегия нагрузки" value={manualCfg.bbLoad || ''} onChange={v => setManual('bbLoad', v)}
              options={[
                { id: 'double_progression', label: '🔄 Двойная прогрессия (рекоменд.)' },
                { id: 'linear', label: '📈 Линейная +2.5кг/нед' },
                { id: 'wave', label: '🌊 Волновая 3-нед циклы' },
                { id: 'rpe_based', label: '🎯 RPE-базированная' },
              ]} />
          </>
        )}
      </ConfigSection>

      {/* ─── ВЫБРАННЫЕ ПАРАМЕТРЫ ─── */}
      {selectedList.length > 0 && (
        <div style={{
          marginTop: 4, padding: '6px 10px', borderRadius: 8,
          background: 'rgba(0,230,138,0.06)',
          border: '1px solid rgba(0,230,138,0.12)',
          fontSize: 10, color: ACCENT, lineHeight: 1.6, display: 'flex', flexWrap: 'wrap', gap: 4,
        }}>
          {selectedList.map(([k, v]) => (
            <span key={k} style={{
              padding: '2px 6px', borderRadius: 4,
              background: 'rgba(0,230,138,0.1)', fontSize: 9,
            }}>{(CONFIG_LABELS[k] || k)}: {v.length > 30 ? v.slice(0, 30) + '…' : v}</span>
          ))}
        </div>
      )}

      {manualCfg.program && (
        <button onClick={() => onLoadProgram(manualCfg.program)}
          style={{
            width: '100%', marginTop: 6, padding: 10, borderRadius: 8,
            border: '1px solid rgba(168,85,247,0.3)',
            background: 'rgba(168,85,247,0.08)',
            color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700,
          }}>
          📥 Загрузить программу в конструктор
        </button>
      )}
    </div>
  );
};
