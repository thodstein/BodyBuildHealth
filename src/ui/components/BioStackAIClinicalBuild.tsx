/**
 * BioStackAIClinicalBuild.tsx
 *
 * Вкладка «🔬 Клинический подбор» BioStack AI.
 *
 * НЕ гадает дозы и состав — вызывает buildClinicalStack (biostack-clinical-recommender),
 * который переиспользует движок калькулятора поддержки (runSupportUnified) как источник
 * истины, берёт канонические дозировки и пропускает кандидатов через клинический шлюз
 * безопасности selectStack. Отображает состав, дозы, механизмы ТЗ, риск до/после,
 * отсеянные (с причиной) и лаб-коррекции.
 *
 * Порядок (после аудита пользователя):
 *   1. Карточки грейда A/B/C
 *   2. Карточка количества препаратов (попап)
 *   3. Карточка органов (попап)
 *   4. Карточка механизмов выбранного органа (попап)
 *   5. Карточка анализов (попап)
 *   6. Кнопка сборки
 *   7. СНАЧАЛА: состав стека + механизмы + синергии + описание
 *   8. ПОТОМ: всё остальное (риск, отсеянные, титрация, лаб, мониторинг, конфликты)
 */

import React, { useState } from 'react';
import { GlassCard, PillBtn, inputS, showToast, initBioToast, SubstanceMechanismCard, SubstanceTzCard } from './BioStackAIConstants';
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
   Опции фильтров
   ════════════════════════════════════════════════════════════════ */

const ORGAN_OPTIONS = Object.entries(TZ_SYSTEM_LABELS).map(([id, label]) => ({ id, label }));
const MECH_OPTIONS = Object.entries(TZ_MECH_LABELS).map(([id, label]) => ({ id, label }));
const MARKER_OPTIONS: { id: string; label: string }[] = [
  { id: 'ALT', label: 'АЛТ (печень)' },
  { id: 'AST', label: 'АСТ (печень)' },
  { id: 'GGT', label: 'ГГТ (печень)' },
  { id: 'BILIRUBIN', label: 'Билирубин' },
  { id: 'GLU', label: 'Глюкоза' },
  { id: 'HOMOCYSTEINE', label: 'Гомоцистеин' },
  { id: 'CRP', label: 'СРБ (воспаление)' },
  { id: 'CREATININE', label: 'Креатинин (почки)' },
  { id: 'LDL', label: 'ЛПНП (липиды)' },
  { id: 'TRIGLYCERIDES', label: 'Триглицериды' },
  { id: 'HCT', label: 'Гематокрит' },
  { id: 'D_DIMER', label: 'D-димер' },
];

// Орган → механизмы (по префиксам TZ_MECH_LABELS)
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
   Многоразовые компоненты
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

function FilterPopupCard({
  title, icon, color, options, selected, onToggle, popupId, show, setShow,
}: {
  title: string;
  icon: string;
  color: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  popupId: string;
  show: boolean;
  setShow: (v: boolean) => void;
}) {
  return (
    <>
      <button
        onClick={() => setShow(true)}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${selected.length ? color : 'rgba(255,255,255,0.08)'}`,
          textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: selected.length ? color : 'rgba(255,255,255,0.82)' }}>
            {icon} {title}
          </span>
          {selected.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, color: `${color}cc`, fontWeight: 600 }}>
              ({selected.length})
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>▼</span>
      </button>

      {show && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShow(false)}
        >
          <div
            style={{
              width: '90%', maxWidth: 440, maxHeight: '80vh', overflow: 'auto',
              padding: 20, borderRadius: 18,
              background: 'rgba(24,24,27,0.98)', border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color }}>
                {icon} {title}
              </div>
              <button onClick={() => setShow(false)} style={{
                fontSize: 16, padding: '4px 8px', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)',
              }}>✕</button>
            </div>
            <MultiChips options={options} selected={selected} onToggle={onToggle} color={color} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShow(false)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                background: color, color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>Готово</button>
              <button onClick={() => { options.forEach((o) => selected.includes(o.id) && onToggle(o.id)); }} style={{
                padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 12,
              }}>Сбросить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   Основной компонент
   ════════════════════════════════════════════════════════════════ */

export const BioStackAIClinicalBuild: React.FC<Props> = ({
  profile, setStackIds, labAnalysis, linked,
}) => {
  const [grade, setGrade] = useState<'A' | 'B' | 'C'>('C');
  const [maxStackSize, setMaxStackSize] = useState(0);
  const [filterOrgans, setFilterOrgans] = useState<string[]>([]);
  const [filterMechanisms, setFilterMechanisms] = useState<string[]>([]);
  const [filterMarkers, setFilterMarkers] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<StackStrategy>('comprehensive');
  const [result, setResult] = useState<ClinicalStackResult | null>(null);
  const [building, setBuilding] = useState(false);

  // попапы
  const [showCount, setShowCount] = useState(false);
  const [showOrgans, setShowOrgans] = useState(false);
  const [showMechs, setShowMechs] = useState(false);
  const [showLabs, setShowLabs] = useState(false);

  initBioToast();

  const toggleOrgan = (id: string) =>
    setFilterOrgans((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleMechanism = (id: string) =>
    setFilterMechanisms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleMarker = (id: string) =>
    setFilterMarkers((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // механизмы, отфильтрованные по выбранным органам
  const filteredMechOptions = (() => {
    if (!filterOrgans.length) return MECH_OPTIONS;
    const allowed = new Set<string>();
    for (const org of filterOrgans) {
      for (const mech of (MECH_BY_ORGAN[org] || [])) allowed.add(mech);
    }
    return MECH_OPTIONS.filter((o) => allowed.has(o.id));
  })();

  const courseWeek = linked?.pharma?.week ?? linked?.courseWeek ?? 1;

  const resetAll = () => {
    setGrade('C');
    setMaxStackSize(0);
    setFilterOrgans([]);
    setFilterMechanisms([]);
    setFilterMarkers([]);
  };

  const onBuild = () => {
    setBuilding(true);
    setTimeout(() => {
      try {
        const r = buildClinicalStack(profile, {
          strategy,
          lab: labAnalysis ?? null,
          courseWeek: typeof courseWeek === 'number' ? courseWeek : 1,
          filterOrgans: filterOrgans.length ? filterOrgans : undefined,
          filterMechanisms: filterMechanisms.length ? filterMechanisms : undefined,
          filterMarkers: filterMarkers.length ? filterMarkers : undefined,
          evidenceLevel: grade !== 'C' ? grade : undefined,
          maxStackSize: maxStackSize > 0 ? maxStackSize : undefined,
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

  const hasFilters = filterOrgans.length > 0 || filterMechanisms.length > 0 || filterMarkers.length > 0 || grade !== 'C' || maxStackSize > 0;

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
      <GlassCard title="🔬 Клинический подбор" icon="🧬" color="#00e68a">
        {/* ── Clinical header bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, marginBottom: 10,
          background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.1)',
        }}>
          <span style={{ fontSize: 28 }}>⚕️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>Стек строится движком поддержки</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, marginTop: 2 }}>
              Единый источник истины — калькулятор поддержки. Канонические дозы, механизмы ТЗ (28 кодов),
              клинический шлюз безопасности: противопоказания, ЛС-конфликты, UL, лаб-коррекции.
            </div>
          </div>
        </div>

        {/* ── 1. Карточки грейда A/B/C ── */}
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.82)', marginBottom: 6, marginTop: 10 }}>
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

        {/* ── 2. Количество препаратов ── */}
        <div style={{ marginTop: 12 }}>
          <FilterPopupCard
            title={maxStackSize > 0 ? `Количество препаратов: ${maxStackSize}` : 'Количество препаратов'}
            icon="📦"
            color="#e879f9"
            options={[]}
            selected={[]}
            onToggle={() => {}}
            popupId="count"
            show={showCount}
            setShow={setShowCount}
          />
          {showCount && (
            <div
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.7)', zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onClick={() => setShowCount(false)}
            >
              <div
                style={{
                  width: '90%', maxWidth: 400, padding: 20, borderRadius: 18,
                  background: 'rgba(24,24,27,0.98)', border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e879f9' }}>📦 Количество препаратов</div>
                  <button onClick={() => setShowCount(false)} style={{ fontSize: 16, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)' }}>✕</button>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
                  Максимальное число веществ в стеке. 0 = без ограничений.
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COUNT_PRESETS.map((n) => (
                    <button
                      key={n}
                      onClick={() => { setMaxStackSize(n); setShowCount(false); }}
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
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Органы ── */}
        <div style={{ marginTop: 8 }}>
          <FilterPopupCard
            title={filterOrgans.length ? `Органы: выбрано ${filterOrgans.length}` : 'Органы и системы'}
            icon="🫀"
            color="#00e68a"
            options={ORGAN_OPTIONS}
            selected={filterOrgans}
            onToggle={toggleOrgan}
            popupId="organs"
            show={showOrgans}
            setShow={setShowOrgans}
          />
        </div>

        {/* ── 4. Механизмы выбранного органа ── */}
        <div style={{ marginTop: 8 }}>
          <FilterPopupCard
            title={filterMechanisms.length ? `Механизмы: выбрано ${filterMechanisms.length}` : filterOrgans.length ? 'Механизмы выбранных органов' : 'Механизмы ТЗ (все)'}
            icon="⚙️"
            color="#a78bfa"
            options={filteredMechOptions}
            selected={filterMechanisms}
            onToggle={toggleMechanism}
            popupId="mechanisms"
            show={showMechs}
            setShow={setShowMechs}
          />
        </div>

        {/* ── 5. Анализы ── */}
        <div style={{ marginTop: 8 }}>
          <FilterPopupCard
            title={filterMarkers.length ? `Анализы: выбрано ${filterMarkers.length}` : 'Лаб-маркеры'}
            icon="🧪"
            color="#f59e0b"
            options={MARKER_OPTIONS}
            selected={filterMarkers}
            onToggle={toggleMarker}
            popupId="labs"
            show={showLabs}
            setShow={setShowLabs}
          />
        </div>

        {/* ── Стратегия (компактно) ── */}
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
            ⚙️ Стратегия: {STRATEGIES.find((s) => s.id === strategy)?.label}
          </summary>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            {STRATEGIES.map((s) => (
              <PillBtn key={s.id} active={strategy === s.id} onClick={() => setStrategy(s.id)} color="#00e68a" small>
                {s.label}
              </PillBtn>
            ))}
          </div>
        </details>

        {/* ── Сброс ── */}
        {hasFilters && (
          <button onClick={resetAll} style={{
            marginTop: 10, alignSelf: 'flex-start', fontSize: 11, padding: '4px 10px',
            borderRadius: 8, cursor: 'pointer', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)',
          }}>
            ✕ Сбросить фильтры
          </button>
        )}

        {/* ── 6. Кнопка сборки ── */}
        <button onClick={onBuild} disabled={building} style={{
          marginTop: 14, width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          background: building ? 'rgba(0,230,138,0.4)' : 'linear-gradient(135deg,#00e68a,#00b4d8)',
          color: '#00120c', fontWeight: 800, fontSize: 15, cursor: 'pointer',
          boxShadow: building ? 'none' : '0 6px 20px rgba(0,230,138,0.2)',
        }}>
          {building ? '⚙️ Собираю…' : '⚕️ Собрать клинический стек'}
        </button>
      </GlassCard>

      {/* ════════════════════════════════════════════════════════════════
          7. СНАЧАЛА: состав стека + механизмы + синергии + описание
          ════════════════════════════════════════════════════════════════ */}
      {result && (
        <>
          {/* ── Описание стека ── */}
          <GlassCard title="📋 Описание стека" icon="📝" color="#a78bfa" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(235,235,245,0.8)', lineHeight: 1.5 }}>
              {result.stackDescription}
            </div>
          </GlassCard>

          {/* ── Синергии в стеке ── */}
          {result.stackSynergies.length > 0 && (
            <GlassCard title={`🔗 Синергии в стеке (${result.stackSynergies.length})`} icon="⚡" color="#c084fc" style={{ marginTop: 8 }}>
              {result.stackSynergies.map((syn, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#c084fc' }}>
                    {syn.ids.join(' + ')}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.6)', marginTop: 2 }}>
                    {syn.effect}
                  </div>
                  <span style={{
                    fontSize: 9, marginTop: 3, display: 'inline-block', padding: '2px 6px', borderRadius: 4,
                    background: syn.strength === 'HIGH' ? 'rgba(239,68,68,0.15)' : syn.strength === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                    color: syn.strength === 'HIGH' ? '#f87171' : syn.strength === 'MEDIUM' ? '#fbbf24' : '#94a3b8',
                  }}>
                    {syn.strength}
                  </span>
                </div>
              ))}
            </GlassCard>
          )}

          {/* ── Состав стека (вещества + механизмы + описание ТЗ) ── */}
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
              8. ПОТОМ: всё остальное (риск, отсеянные, титрация, лаб, мониторинг, конфликты)
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
export { BioStackAIClinicalBuild as BuildTab };
