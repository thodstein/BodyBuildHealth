/**
 * BioStackAIClinicalBuild.tsx
 *
 * Вкладка «🔬 Клинический подбор» BioStack AI.
 *
 * Пошаговый сборщик стека:
 *   1. Стартовая кнопка «Собрать стек»
 *   2. Попап выбора органов (6 ТЗ + Суставы/связки + Нейротоксичность)
 *   3. Попап механизмов (фильтруется по выбранным органам)
 *   4. Попап лаб-маркеров
 *   5. Строка параметров: Грейд + Стратегия + Макс. кол-во
 *   6. Кнопка сборки → вызов buildClinicalStack
 *   7. Результат: состав + механизмы + синергии + описание → риск/исключения/титрация/лаб/мониторинг
 *
 * Убрана карточка «Клинический подбор» (была дубликатом заголовка).
 * Стратегия перенесена под грейд.
 * Органы расширены: joints (суставы/связки — вещества без TZ-механизмов) + neurotox (нейротоксичность — маппинг на CNS).
 */

import React, { useState, useMemo } from 'react';
import { GlassCard, PillBtn, showToast, initBioToast, SubstanceMechanismCard, SubstanceTzCard } from './BioStackAIConstants';
import type { BioStackProfile } from '../../engines/biostack-ai.engine';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
import { buildClinicalStack, type ClinicalStackResult } from '../../engines/biostack-clinical-recommender';
import type { StackStrategy } from '../../engines/biostack-clinical-v2.engine';
import { TZ_SYSTEM_LABELS, TZ_MECH_LABELS } from '../../data/support-db';

interface Props {
  profile: BioStackProfile;
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
  labAnalysis?: LabCompositeResult | null;
  linked?: any;
}

/* ════════════════════════════════════════════════════════════════
   Константы / опции
   ════════════════════════════════════════════════════════════════ */

// 6 ТЗ-систем + 2 псевдо-органа
const ORGAN_OPTIONS: { id: string; label: string; icon: string; pseudo?: boolean; group?: string }[] = [
  { id: 'cardio', label: 'Сердечно-сосудистая', icon: '❤️', group: 'tz' },
  { id: 'hepatic', label: 'Печень', icon: '🟤', group: 'tz' },
  { id: 'renal', label: 'Почки', icon: '💧', group: 'tz' },
  { id: 'cns', label: 'ЦНС', icon: '🧠', group: 'tz' },
  { id: 'reproductive', label: 'Репродуктивная', icon: '🔬', group: 'tz' },
  { id: 'hematologic', label: 'Гематология/метаболизм', icon: '🩸', group: 'tz' },
  { id: 'joints', label: 'Суставы и связки', icon: '🦴', pseudo: true, group: 'extra' },
  { id: 'neurotox', label: 'Нейротоксичность', icon: '☠️', pseudo: true, group: 'extra' },
];

const MECH_OPTIONS = Object.entries(TZ_MECH_LABELS).map(([id, label]) => ({ id, label }));

const MARKER_OPTIONS: { id: string; label: string; organ?: string }[] = [
  { id: 'ALT', label: 'АЛТ (печень)', organ: 'hepatic' },
  { id: 'AST', label: 'АСТ (печень)', organ: 'hepatic' },
  { id: 'GGT', label: 'ГГТ (печень)', organ: 'hepatic' },
  { id: 'BILIRUBIN', label: 'Билирубин', organ: 'hepatic' },
  { id: 'GLU', label: 'Глюкоза', organ: 'metabolic' },
  { id: 'HOMOCYSTEINE', label: 'Гомоцистеин', organ: 'cardio' },
  { id: 'CRP', label: 'СРБ (воспаление)', organ: 'immune' },
  { id: 'CREATININE', label: 'Креатинин (почки)', organ: 'renal' },
  { id: 'LDL', label: 'ЛПНП (липиды)', organ: 'cardio' },
  { id: 'TRIGLYCERIDES', label: 'Триглицериды', organ: 'cardio' },
  { id: 'HCT', label: 'Гематокрит', organ: 'hematologic' },
  { id: 'D_DIMER', label: 'D-димер', organ: 'hematologic' },
];

// Орган → механизмы (по префиксам)
const MECH_BY_ORGAN: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  const prefixToOrgan: Record<string, string> = {
    cv: 'cardio', liv: 'hepatic', ren: 'renal',
    cns: 'cns', rep: 'reproductive', hem: 'hematologic',
  };
  for (const mechId of Object.keys(TZ_MECH_LABELS)) {
    const prefix = mechId.match(/^[a-z]+/)?.[0];
    const organ = prefix ? prefixToOrgan[prefix] : '';
    if (organ) (map[organ] = map[organ] || []).push(mechId);
  }
  // Псевдо-органы: маппим на релевантные механизмы
  map.joints = ['hem1', 'hem2', 'cns2', 'cns3', 'rep4']; // воспаление, коллаген, регенерация
  map.neurotox = ['cns1', 'cns2', 'cns3', 'cns4', 'cns5', 'cns6']; // все CNS-механизмы
  return map;
})();

const STRATEGIES: { id: StackStrategy; label: string }[] = [
  { id: 'comprehensive', label: 'Полный' },
  { id: 'safe', label: 'Безопасный' },
  { id: 'budget', label: 'Бюджет' },
];

const GRADE_OPTIONS = [
  { id: 'A', label: 'A', desc: 'Только грейд A', color: '#22c55e' },
  { id: 'B', label: 'A + B', desc: 'Грейд A и B', color: '#f59e0b' },
  { id: 'C', label: 'Все', desc: 'Все уровни', color: '#60a5fa' },
] as const;

const COUNT_PRESETS = [5, 8, 10, 12, 15, 20, 0];

/* ════════════════════════════════════════════════════════════════
   UI примитивы
   ════════════════════════════════════════════════════════════════ */

function MultiChips({
  options, selected, onToggle, color,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {options.map((o) => {
        const active = selected.includes(o.id);
        return (
          <button
            key={o.id}
            onClick={() => onToggle(o.id)}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${active ? color : 'rgba(255,255,255,0.12)'}`,
              background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
              color: active ? color : 'rgba(255,255,255,0.6)', fontWeight: active ? 700 : 500,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function StepPopup({
  title, icon, color, children, show, onClose,
}: {
  title: string;
  icon: string;
  color: string;
  children: React.ReactNode;
  show: boolean;
  onClose: () => void;
}) {
  if (!show) return null;
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '94%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto',
          padding: 20, borderRadius: 18,
          background: 'rgba(18,18,22,0.98)', border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color }}>{icon} {title}</div>
          <button onClick={onClose} style={{
            fontSize: 16, padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)',
          }}>✕</button>
        </div>
        {children}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
            background: color, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Готово</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Основной компонент
   ════════════════════════════════════════════════════════════════ */

export const BioStackAIClinicalBuild: React.FC<Props> = ({
  profile, setStackIds, labAnalysis, linked,
}) => {
  // Step state
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0); // 0 = start, 1 = organs, 2 = mechs, 3 = markers, 4 = params
  const [filterOrgans, setFilterOrgans] = useState<string[]>([]);
  const [filterMechanisms, setFilterMechanisms] = useState<string[]>([]);
  const [filterMarkers, setFilterMarkers] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'balanced' | 'strict'>('balanced');
  const [grade, setGrade] = useState<'A' | 'B' | 'C'>('C');
  const [strategy, setStrategy] = useState<StackStrategy>('comprehensive');
  const [maxStackSize, setMaxStackSize] = useState(0);
  const [result, setResult] = useState<ClinicalStackResult | null>(null);
  const [building, setBuilding] = useState(false);

  // Toggles for data sources
  const [useCourse, setUseCourse] = useState(true);
  const [useLabs, setUseLabs] = useState(true);
  const [useProfile, setUseProfile] = useState(true);

  initBioToast();

  // Хелперы переключения
  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  // Шаг 1: Органы (группировка: ТЗ-системы + Дополнительно)
  const organChildren = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase' }}>Системы ТЗ (6)</div>
        <MultiChips
          options={ORGAN_OPTIONS.filter(o => o.group === 'tz').map(o => ({ id: o.id, label: `${o.icon} ${o.label}` }))}
          selected={filterOrgans}
          onToggle={(id) => setFilterOrgans(toggle(filterOrgans, id))}
          color="#00e68a"
        />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase' }}>Дополнительно</div>
        <MultiChips
          options={ORGAN_OPTIONS.filter(o => o.group === 'extra').map(o => ({ id: o.id, label: `${o.icon} ${o.label}` }))}
          selected={filterOrgans}
          onToggle={(id) => setFilterOrgans(toggle(filterOrgans, id))}
          color="#f59e0b"
        />
      </div>
    </div>
  );

  // Шаг 2: Механизмы (группировка по органам, фильтрация по выбранным органам)
  const mechGroups = useMemo(() => {
    if (!filterOrgans.length) return MECH_OPTIONS; // все механизмы если органы не выбраны
    
    const allowed = new Set<string>();
    for (const org of filterOrgans) {
      for (const mech of MECH_BY_ORGAN[org] || []) allowed.add(mech);
    }
    return MECH_OPTIONS.filter(o => allowed.has(o.id));
  }, [filterOrgans]);

  // Группировка механизмов по органам для отображения
  const mechGroupsByOrgan = useMemo(() => {
    const groups: Record<string, { id: string; label: string }[]> = {};
    const prefixToOrgan: Record<string, string> = {
      cv: 'cardio', liv: 'hepatic', ren: 'renal',
      cns: 'cns', rep: 'reproductive', hem: 'hematologic',
    };
    const organLabels: Record<string, string> = {
      cardio: '❤️ ССС', hepatic: '🟤 Печень', renal: '💧 Почки',
      cns: '🧠 ЦНС', reproductive: '🔬 Репродуктивная', hematologic: '🩸 Гематология',
    };
    
    for (const mech of mechGroups) {
      const prefix = mech.id.match(/^[a-z]+/)?.[0];
      const organ = prefix ? prefixToOrgan[prefix] : 'other';
      const label = organLabels[organ] || organ;
      (groups[label] = groups[label] || []).push(mech);
    }
    return groups;
  }, [mechGroups]);

  const mechChildren = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(mechGroupsByOrgan).map(([organ, mechs]) => (
        <div key={organ} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{organ}</div>
          <MultiChips
            options={mechs}
            selected={filterMechanisms}
            onToggle={(id) => setFilterMechanisms(toggle(filterMechanisms, id))}
            color="#a78bfa"
          />
        </div>
      ))}
    </div>
  );

  // Шаг 3: Маркеры (фильтрация по выбранным органам)
  const availableMarkers = useMemo(() => {
    if (!filterOrgans.length) return MARKER_OPTIONS;
    const allowedOrgans = new Set(filterOrgans);
    // Маппинг маркер-органов к системным ID
    const markerOrganMap: Record<string, string[]> = {
      hepatic: ['hepatic'],
      cardio: ['cardio'],
      renal: ['renal'],
      metabolic: ['metabolic'],
      immune: ['immune'],
      hematologic: ['hematologic'],
    };
    const allowed = new Set<string>();
    for (const org of filterOrgans) {
      const mapped = markerOrganMap[org] || [org];
      for (const m of mapped) allowed.add(m);
    }
    return MARKER_OPTIONS.filter(m => allowed.has(m.organ || ''));
  }, [filterOrgans]);

  // Группировка маркеров по органам
  const markerGroups = useMemo(() => {
    const groups: Record<string, { id: string; label: string; organ?: string }[]> = {};
    const organLabels: Record<string, string> = {
      hepatic: '🟤 Печень', cardio: '❤️ ССС', renal: '💧 Почки',
      metabolic: '⚡ Метаболизм', immune: '🛡️ Иммунная', hematologic: '🩸 Гематология',
    };
    for (const m of availableMarkers) {
      const label = organLabels[m.organ || ''] || 'Другое';
      (groups[label] = groups[label] || []).push(m);
    }
    return groups;
  }, [availableMarkers]);

  const markerChildren = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(markerGroups).map(([organ, markers]) => (
        <div key={organ} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{organ}</div>
          <MultiChips
            options={markers}
            selected={filterMarkers}
            onToggle={(id) => setFilterMarkers(toggle(filterMarkers, id))}
            color="#f59e0b"
          />
        </div>
      ))}
    </div>
  );

  // Параметры сборки (грейд, стратегия, макс. кол-во)
  const paramChildren = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Грейд */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginBottom: 6 }}>
          📚 Грейд доказательности
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {GRADE_OPTIONS.map((g) => (
            <button
              key={g.id}
              onClick={() => setGrade(g.id)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12, cursor: 'pointer', border: 'none',
                background: grade === g.id ? `${g.color}22` : 'rgba(255,255,255,0.04)',
                borderLeft: grade === g.id ? `3px solid ${g.color}` : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: grade === g.id ? g.color : 'rgba(255,255,255,0.5)' }}>
                {g.label}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                {g.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Стратегия под грейдом */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginBottom: 6 }}>
          ⚙️ Стратегия подбора
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {STRATEGIES.map((s) => (
            <PillBtn key={s.id} active={strategy === s.id} onClick={() => setStrategy(s.id)} color="#00e68a" small>
              {s.label}
            </PillBtn>
          ))}
        </div>
      </div>

      {/* Макс. количество */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginBottom: 6 }}>
          📦 Макс. количество препаратов
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COUNT_PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => setMaxStackSize(n)}
              style={{
                padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                background: maxStackSize === n ? '#e879f922' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${maxStackSize === n ? '#e879f9' : 'rgba(255,255,255,0.1)'}`,
                color: maxStackSize === n ? '#e879f9' : 'rgba(255,255,255,0.7)',
                fontWeight: maxStackSize === n ? 700 : 500, fontSize: 13,
              }}
            >
              {n === 0 ? '∞' : n}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          0 = без ограничений
        </div>
      </div>

      {/* Источники данных */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginBottom: 8 }}>
          📊 Источники данных для подбора
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: useCourse ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${useCourse ? '#00e68a' : 'rgba(255,255,255,0.1)'}` }}>
            <input type="checkbox" checked={useCourse} onChange={e => setUseCourse(e.target.checked)} style={{ accentColor: '#00e68a', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: useCourse ? '#00e68a' : 'rgba(255,255,255,0.7)' }}>💉 Курс ААС</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: useLabs ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${useLabs ? '#f59e0b' : 'rgba(255,255,255,0.1)'}` }}>
            <input type="checkbox" checked={useLabs} onChange={e => setUseLabs(e.target.checked)} style={{ accentColor: '#f59e0b', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: useLabs ? '#f59e0b' : 'rgba(255,255,255,0.7)' }}>🧪 Анализы (лаборатория)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: useProfile ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${useProfile ? '#a78bfa' : 'rgba(255,255,255,0.1)'}` }}>
            <input type="checkbox" checked={useProfile} onChange={e => setUseProfile(e.target.checked)} style={{ accentColor: '#a78bfa', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: useProfile ? '#a78bfa' : 'rgba(255,255,255,0.7)' }}>👤 Профиль (органы/цели/состояние)</span>
          </label>
         </div>
       </div>

       {/* Режим фильтрации */}
       <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
         <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginBottom: 8 }}>
           🎯 Режим фильтрации
         </div>
         <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
           <button
             onClick={() => setFilterMode('balanced')}
             style={{
               flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', border: 'none',
               background: filterMode === 'balanced' ? '#60a5fa22' : 'rgba(255,255,255,0.04)',
               borderLeft: filterMode === 'balanced' ? '3px solid #60a5fa' : '3px solid transparent',
               transition: 'all 0.2s',
             }}
           >
             <div style={{ fontSize: 13, fontWeight: 700, color: filterMode === 'balanced' ? '#60a5fa' : 'rgba(255,255,255,0.5)' }}>
               Сбалансированный
             </div>
             <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
               Фильтры + синергии
             </div>
           </button>
           <button
             onClick={() => setFilterMode('strict')}
             style={{
               flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', border: 'none',
               background: filterMode === 'strict' ? '#f59e0b22' : 'rgba(255,255,255,0.04)',
               borderLeft: filterMode === 'strict' ? '3px solid #f59e0b' : '3px solid transparent',
               transition: 'all 0.2s',
             }}
           >
             <div style={{ fontSize: 13, fontWeight: 700, color: filterMode === 'strict' ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>
               Строгий
             </div>
             <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
               Только по выбранным органам/механизмам
             </div>
           </button>
         </div>
       </div>
     </div>
   );

const courseWeek = linked?.pharma?.week ?? linked?.courseWeek ?? 1;
   
  const resetAll = () => {
    setStep(0);
    setFilterOrgans([]);
    setFilterMechanisms([]);
    setFilterMarkers([]);
    setFilterMode('balanced');
    setGrade('C');
    setStrategy('comprehensive');
    setMaxStackSize(0);
    setResult(null);
  };

  const onBuild = () => {
    setBuilding(true);
    setTimeout(() => {
      try {
        const r = buildClinicalStack(profile, {
          strategy,
          lab: useLabs ? (labAnalysis ?? null) : null,
          courseWeek: typeof courseWeek === 'number' ? courseWeek : 1,
          filterOrgans: useProfile && filterOrgans.length ? filterOrgans : undefined,
          filterMechanisms: useProfile && filterMechanisms.length ? filterMechanisms : undefined,
          filterMarkers: useProfile && filterMarkers.length ? filterMarkers : undefined,
          evidenceLevel: grade !== 'C' ? grade : undefined,
          maxStackSize: maxStackSize > 0 ? maxStackSize : undefined,
          useCourse,
          useLabs,
          useProfile,
          filterMode,
        });
        setResult(r);
      } catch (e: any) {
        showToast('Ошибка подбора: ' + (e?.message || e), 'error');
      } finally {
        setBuilding(false);
      }
    }, 10);
  };

  const onToPlan = () => {
    if (!result) return;
    const ids = result.substances.map((s) => s.id);
    localStorage.setItem(
      'he_biostack_to_plan',
      JSON.stringify({ stackIds: ids, name: 'Клинический подбор (BioStack)' }),
    );
    setStackIds(ids);
    showToast(`Клинический стек (${ids.length}) отправлен в план поддержки`, 'success');
  };

  const hasAnyFilter = filterOrgans.length > 0 || filterMechanisms.length > 0 || filterMarkers.length > 0 || grade !== 'C' || maxStackSize > 0;

  const SEV_META: Record<string, { title: string; icon: string; color: string; note: string }> = {
    hard: { title: 'Абсолютные противопоказания', icon: '🛑', color: '#f87171', note: 'Удалены полностью — приём недопустим' },
    drug: { title: 'Конфликты с лекарствами', icon: '💊', color: '#fb7185', note: 'Удалены из-за взаимодействия с текущими ЛС' },
    ul: { title: 'Превышен верхний предел (UL)', icon: '⚠️', color: '#f59e0b', note: 'Удалены во избежание передозировки' },
    titration: { title: 'Требуется титрация дозы', icon: '🔧', color: '#fbbf24', note: 'Не удаление — снизьте/подберите дозу под контролем' },
    redundant: { title: 'Дублирование (избыточно)', icon: '🔁', color: '#9ca3af', note: 'Убраны как дубли уже покрытых механизмов' },
  };
  const EXCL_ORDER: Array<keyof typeof SEV_META> = ['hard', 'drug', 'ul', 'titration', 'redundant'];

  return (
    <div style={{ padding: 12 }}>
      {/* ── Заголовок-баннер ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, marginBottom: 10,
        background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)',
      }}>
        <span style={{ fontSize: 28 }}>⚕️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>Пошаговый клинический подбор стека</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, marginTop: 2 }}>
            Орган → Механизмы → Маркеры → Параметры → Сборка. Движок калькулятора поддержки, ТЗ-механизмы (28 кодов),
            клинический шлюз: противопоказания, ЛС-конфликты, UL, лаб-коррекции.
          </div>
        </div>
      </div>

      {/* ── Пошаговый UI ── */}
      <GlassCard title="" icon="" color="#00e68a" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>

        {/* Стартовая кнопка (шаг 0) */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                width: '100%', padding: '18px 0', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg,#00e68a,#00b4d8)',
                color: '#00120c', fontWeight: 800, fontSize: 16, cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(0,230,138,0.2)',
              }}
            >
              🚀 Начать сборку стека
            </button>
            <button
              onClick={onBuild}
              disabled={building}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: '1px solid rgba(168,85,247,0.3)',
                background: 'rgba(168,85,247,0.08)', color: '#c084fc', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              ⚡ Быстрая сборка (без фильтров)
            </button>
            <button
              onClick={() => setStep(4)}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              ⏭ Пропустить к параметрам
            </button>
          </div>
        )}

        {/* Шаги 1-3: попапы органов/механизмов/маркеров */}
        {step >= 1 && step <= 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StepPopup
              title="Шаг 1 из 4: Органы и системы"
              icon="🫀"
              color="#00e68a"
              show={step === 1}
              onClose={() => setStep(4)}
            >
              {organChildren}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setStep(2)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: filterOrgans.length ? '#00e68a' : 'rgba(255,255,255,0.08)',
                  color: filterOrgans.length ? '#00120c' : 'rgba(255,255,255,0.5)',
                  fontWeight: 700, fontSize: 13, cursor: filterOrgans.length ? 'pointer' : 'not-allowed',
                }} disabled={!filterOrgans.length}>
                  Далее: Механизмы {filterOrgans.length && `(${filterOrgans.length})`}
                </button>
                <button onClick={() => setStep(2)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>
                  ⏭ Пропустить
                </button>
              </div>
            </StepPopup>

            <StepPopup
              title="Шаг 2 из 4: Механизмы ТЗ"
              icon="⚙️"
              color="#a78bfa"
              show={step === 2}
              onClose={() => setStep(3)}
            >
              {mechChildren}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setStep(3)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: filterMechanisms.length ? '#a78bfa' : 'rgba(255,255,255,0.08)',
                  color: filterMechanisms.length ? '#00120c' : 'rgba(255,255,255,0.5)',
                  fontWeight: 700, fontSize: 13, cursor: filterMechanisms.length ? 'pointer' : 'not-allowed',
                }} disabled={!filterMechanisms.length}>
                  Далее: Лаб-маркеры {filterMechanisms.length && `(${filterMechanisms.length})`}
                </button>
                <button onClick={() => setStep(3)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>
                  ⏭ Пропустить
                </button>
              </div>
            </StepPopup>

            <StepPopup
              title="Шаг 3 из 4: Лаб-маркеры"
              icon="🧪"
              color="#f59e0b"
              show={step === 3}
              onClose={() => setStep(2)}
            >
              {markerChildren}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setStep(4)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                  background: '#f59e0b', color: '#00120c',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>
                  Далее: Параметры сборки {filterMarkers.length && `(${filterMarkers.length} маркеров)`}
                </button>
                <button onClick={() => setStep(4)} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>
                  ⏭ Пропустить
                </button>
              </div>
            </StepPopup>
          </div>
        )}

        {/* Шаг 4: Параметры (грейд + стратегия + макс. кол-во) */}
        {step === 4 && (
          <div style={{ padding: '4px 0 0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginBottom: 10 }}>
              Шаг 4 из 4: Параметры сборки
            </div>
            {paramChildren}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setStep(3)} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>Назад</button>
              <button onClick={onBuild} disabled={building} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                background: building ? 'rgba(0,230,138,0.4)' : 'linear-gradient(135deg,#00e68a,#00b4d8)',
                color: '#00120c', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                boxShadow: building ? 'none' : '0 4px 16px rgba(0,230,138,0.2)',
              }}>
                {building ? '⚙️ Собираю…' : '⚕️ Собрать клинический стек'}
              </button>
            </div>
          </div>
        )}

        {/* Сброс фильтров (показывает выбранные значения) */}
        {step > 0 && hasAnyFilter && (
          <button onClick={resetAll} style={{
            marginTop: 12, alignSelf: 'flex-start', fontSize: 11, padding: '6px 12px',
            borderRadius: 8, cursor: 'pointer', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)',
          }}>
            ✕ Сбросить всё
          </button>
        )}

      </GlassCard>

      {/* ════════════════════════════════════════════════════════════════
          РЕЗУЛЬТАТ: СНАЧАЛА состав + механизмы + синергии + описание
          ════════════════════════════════════════════════════════════════ */}
      {result && (
        <>
          {/* Предупреждение: стек ориентировочный */}
          {result.isOrientational && (
            <div style={{
              padding: '10px 14px', borderRadius: 12, marginBottom: 10,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>
                ⚠️ Стек ориентировочный
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 1.4 }}>
                Собран без учёта курса и анализов. Для точного подбора включите «💉 Курс ААС» и/или «🧪 Анализы».
              </div>
            </div>
          )}

          {/* Описание стека */}
          <GlassCard title="📋 Описание стека" icon="📝" color="#a78bfa" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(235,235,245,0.8)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {result.stackDescription.split('\n').map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                if (trimmed === 'Принцип:' || trimmed === 'Покрытие систем:') {
                  return <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', marginTop: 6, marginBottom: 2 }}>{trimmed}</div>;
                }
                if (trimmed.startsWith('• ')) {
                  return <div key={i} style={{ fontSize: 11, color: 'rgba(235,235,245,0.75)', paddingLeft: 8, marginTop: 1 }}>{trimmed}</div>;
                }
                return <div key={i} style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{trimmed}</div>;
              })}
            </div>
          </GlassCard>

          {/* Синергии в стеке */}
          {result.stackSynergies.length > 0 && (
            <GlassCard title={`🔗 Синергии в стеке (${result.stackSynergies.length})`} icon="⚡" color="#c084fc" style={{ marginTop: 8 }}>
              {result.stackSynergies.map((syn, i) => (
                <div key={i} style={{
                  padding: '10px 12px', marginBottom: 8, borderRadius: 12,
                  background: 'rgba(192,132,252,0.04)', border: '1px solid rgba(192,132,252,0.1)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>
                      {syn.ids.join(' + ')}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {syn.domain && syn.domain !== 'general' && (
                        <span style={{
                          fontSize: 10, padding: '3px 8px', borderRadius: 6,
                          background: 'rgba(148,163,184,0.12)', color: '#cbd5e1', fontWeight: 600,
                        }}>{syn.domain}</span>
                      )}
                      <span style={{
                        fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 700,
                        background: syn.strength === 'HIGH' ? 'rgba(239,68,68,0.15)' : syn.strength === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                        color: syn.strength === 'HIGH' ? '#f87171' : syn.strength === 'MEDIUM' ? '#fbbf24' : '#94a3b8',
                      }}>
                        {syn.strength}
                      </span>
                    </div>
                  </div>
                  {syn.mechanism && (
                    <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.45)', marginTop: 3 }}>{syn.mechanism}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'rgba(235,235,245,0.7)', marginTop: 4, lineHeight: 1.4 }}>
                    {syn.description || syn.effect}
                  </div>
                </div>
              ))}
            </GlassCard>
          )}

          {/* Состав стека + механизмы + ТЗ-описание */}
          <GlassCard title={`💊 Состав стека (${result.substances.length})`} icon="💊" color="#a78bfa" style={{ marginTop: 8 }}>
            {result.substances.map((s) => (
              <div key={s.id} style={{
                padding: '12px 14px', marginBottom: 6, borderRadius: 12,
                background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.08)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{s.name}</span>
                    <span style={{
                      marginLeft: 6, fontSize: 9, padding: '2px 6px', borderRadius: 4,
                      background: s.tier === 'core' ? 'rgba(34,197,94,0.15)' : s.tier === 'standard' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.1)',
                      color: s.tier === 'core' ? '#22c55e' : s.tier === 'standard' ? '#60a5fa' : '#a78bfa',
                    }}>{s.tier}</span>
                    {s.source && (
                      <span style={{
                        marginLeft: 4, fontSize: 8, padding: '2px 6px', borderRadius: 4,
                        background: s.source === 'mandatory' ? 'rgba(239,68,68,0.12)' : s.source === 'greedy' ? 'rgba(168,85,247,0.12)' : 'rgba(96,165,250,0.12)',
                        color: s.source === 'mandatory' ? '#f87171' : s.source === 'greedy' ? '#c084fc' : '#93c5fd',
                      }}>
                        {s.source === 'mandatory' ? 'обязательно' : s.source === 'greedy' ? 'синергия' : 'ТЗ'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#00e68a' }}>
                    {s.doseDisplay || `${s.doseMg} мг`}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  {s.timing}
                </div>
                {s.tzMechanisms.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {s.tzMechanisms.slice(0, 5).map((m) => (
                      <span key={m.mechId} style={{
                        fontSize: 9, padding: '3px 8px', borderRadius: 6,
                        background: 'rgba(96,165,250,0.15)', color: '#93c5fd', fontWeight: 600,
                      }}>{m.label}</span>
                    ))}
                  </div>
                )}
                {s.mechanismReason && (
                  <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.3 }}>
                    {s.mechanismReason}
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  <SubstanceMechanismCard id={s.id} />
                  <SubstanceTzCard id={s.id} />
                </div>
              </div>
            ))}
          </GlassCard>

          {/* ════════════════════════════════════════════════════════════════
              ПОТОМ: всё остальное (риск, отсеянные, титрация, лаб, мониторинг, конфликты)
              ════════════════════════════════════════════════════════════════ */}

          {/* Риск до/после */}
          <GlassCard title="📊 Возможное изменение риска" icon="📈" color="#60a5fa" style={{ marginTop: 12 }}>
            {(() => {
              const delta = Math.round((result.riskBefore - result.riskAfter) * 10) / 10;
              const improved = delta > 0;
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                    <div style={{ padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Риск сейчас</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>{result.riskBefore}</div>
                    </div>
                    <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)', fontWeight: 300 }}>→</div>
                    <div style={{ padding: '12px', borderRadius: 12, background: improved ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${improved ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Прогноз</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: improved ? '#22c55e' : '#fbbf24' }}>{result.riskAfter}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.1)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: improved ? '#22c55e' : '#f59e0b' }}>{improved ? `−${delta}` : `+${Math.abs(delta)}`}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Δ прогноз</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.1)', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>{result.coveragePercent}%</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Покрытие</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.08)', fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                    ⓘ Прогноз изменения риска. BioStack не влияет на расчёт — только оценка эффекта поддержки.
                  </div>
                </>
              );
            })()}
            <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              Источник: {result.sourceOfTruth} · неделя {result.courseWeek}
            </div>
          </GlassCard>

          {/* Отсеянные */}
          {result.excluded.length > 0 && (() => {
            const groups = EXCL_ORDER
              .map((sev) => ({ sev, meta: SEV_META[sev], items: result.excluded.filter((x) => x.severity === sev) }))
              .filter((g) => g.items.length > 0);
            return groups.map((g) => (
              <GlassCard key={g.sev} title={`${g.meta.title} (${g.items.length})`} icon={g.meta.icon} color={g.meta.color} style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: g.meta.color, marginBottom: 6, fontWeight: 600 }}>{g.meta.note}</div>
                {g.items.map((x, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{x.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.6)' }}>{x.reason}</div>
                  </div>
                ))}
              </GlassCard>
            ));
          })()}

          {/* Титрация доз */}
          {result.safety.drugTitrations.length > 0 && (
            <GlassCard title={`🔧 Титрация доз (${result.safety.drugTitrations.length})`} icon="🔧" color="#fbbf24" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: '#fbbf24', marginBottom: 6, fontWeight: 600 }}>
                Вещество остаётся в стеке, но дозу нужно подобрать под контролем (взаимодействие с текущими ЛС)
              </div>
              {result.safety.drugTitrations.map((t: any, i: number) => {
                const kept = result.substances.some((s) => s.id === t.substanceId);
                return (
                  <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{t.substanceName}</div>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: kept ? 'rgba(0,230,138,0.18)' : 'rgba(156,163,175,0.18)', color: kept ? '#00e68a' : '#9ca3af', whiteSpace: 'nowrap' }}>
                        {kept ? 'в стеке' : 'отсеяно'}
                      </span>
                    </div>
                    {t.drug && <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.6)', marginTop: 2 }}>ЛС: {t.drug}{t.effect ? ` · ${t.effect}` : ''}</div>}
                    {t.recommendation && <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 3 }}>→ {t.recommendation}</div>}
                    {t.mechanism && <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.5)', marginTop: 2 }}>{t.mechanism}</div>}
                  </div>
                );
              })}
            </GlassCard>
          )}

          {/* Лаб-коррекции */}
          {result.safety.labAdjustments.length > 0 && (
            <GlassCard title="🔬 Лабораторные коррекции" icon="🧪" color="#f59e0b" style={{ marginTop: 12 }}>
              {result.safety.labAdjustments.map((a: any, i: number) => (
                <div key={i} style={{ padding: '6px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>
                  • {a.message || a.reason || JSON.stringify(a)}
                </div>
              ))}
            </GlassCard>
          )}

          {/* Мониторинг */}
          {result.monitoring.length > 0 && (
            <GlassCard title="🩺 Мониторинг" icon="📋" color="#34d399" style={{ marginTop: 12 }}>
              {result.monitoring.map((m, i) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>• {m}</div>
              ))}
            </GlassCard>
          )}
          {result.specialInstructions.length > 0 && (
            <GlassCard title="📌 Особые указания" icon="⚠️" color="#fbbf24" style={{ marginTop: 12 }}>
              {result.specialInstructions.map((m, i) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>• {m}</div>
              ))}
            </GlassCard>
          )}
          {result.conflicts.length > 0 && (
            <GlassCard title="🔗 Конфликты" icon="⚡" color="#c084fc" style={{ marginTop: 12 }}>
              {result.conflicts.map((m, i) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>• {m}</div>
              ))}
            </GlassCard>
          )}

          <button onClick={onToPlan} style={{
            marginTop: 12, width: '100%', padding: '12px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,#00e68a,#00b4d8)',
            color: '#00120c', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}>
            ➕ Отправить в план поддержки ({result.substances.length})
          </button>
        </>
      )}
    </div>
  );
};

export default BioStackAIClinicalBuild;