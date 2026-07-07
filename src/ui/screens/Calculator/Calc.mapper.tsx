import React, { useMemo, useState, useCallback } from 'react';
import type { LabSlice } from '../../../engines/support-plan';
import type { CalculatorState } from '../../../engines/support-plan';
import { resolvePlan } from '../../../engines/tz-mapper-engine';
import type { MapperCtx, SupportRecommendation } from '../../../engines/tz-mapper-engine';
import type { SupportLevel } from '../../../engines/tz-bridge-mechanism';
import type { PhaseContext, PhaseKey } from '../../../engines/tz-bridge-phase';
import type { BoosterTriggerCtx } from '../../../engines/tz-bridge-boosters';
import { PHASE_PROTOCOL } from '../../../engines/tz-bridge-phase';
import { STACK_BOOSTER_TRIGGERS } from '../../../engines/tz-bridge-boosters';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';
import { DEFAULT_DOSAGES } from '../../../data/support-meta';
import { GLASS, BADGE } from './Calc.types';

// ── Утилиты отображения вещества ─────────────────────────────────────────────
const SUB_NAME_CACHE: Record<string, string> = {};
function subNameRu(id: string): string {
  if (SUB_NAME_CACHE[id]) return SUB_NAME_CACHE[id];
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  const name = e?.nameRu || e?.name || id;
  SUB_NAME_CACHE[id] = name;
  return name;
}
function subDosage(id: string): { mg: number; timing: string } | null {
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  if (e?.dosage) return e.dosage;
  return DEFAULT_DOSAGES[id] || DEFAULT_DOSAGES[id.toLowerCase()] || null;
}
function subTier(id: string): string {
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  return e?.tier || 'standard';
}

// Механизм → система (для отчёта врача)
function mechToOrganLabel(mechId: string): string {
  const organId = mechId.startsWith('cv') ? 'cardio'
    : mechId.startsWith('liv') ? 'hepatic'
    : mechId.startsWith('ren') ? 'renal'
    : mechId.startsWith('cns') ? 'cns'
    : mechId.startsWith('rep') ? 'reproductive'
    : 'hematologic';
  return organId;
}

// ════════════════════════════════════════════════════════════════════════════
//  МАРШАЛИНГ: LabSlice (панели) → LabValues (Record<string, number>)
//  для getActivatedTzMechs. Маркёры из панелей маппятся на MARKER_TO_TZ_MECH.
// ════════════════════════════════════════════════════════════════════════════
const PANEL_KEYS = [
  'panelBiochem', 'panelSex', 'panelHematology', 'panelThyroid',
  'panelLipid', 'panelIron', 'panelVitamin', 'panelCardiac',
  'panelCoagulation', 'panelInflammatory', 'panelAdrenal',
  'panelMineral', 'panelTumor', 'panelUrinalysis',
] as const;

const MARKER_RENAME: Record<string, string> = {
  'Total T': 'TESTOSTERONE',
  'Free T': 'FREE_TESTOSTERONE',
  'E2': 'ESTRADIOL',
  'Bilirubin': 'BILIRUBIN',
  'Uric acid': 'URIC_ACID',
  'HCT': 'HEMATOCRIT',
  'Hemoglobin': 'HEMOGLOBIN',
  'Total Cholesterol': 'TOTAL_CHOLESTEROL',
  'Triglycerides': 'TRIGLYCERIDES',
  'T3 free': 'T3_FREE',
  'T4 free': 'T4_FREE',
  'Anti-TPO': 'ANTI_TPO',
  'Anti-TG': 'ANTI_TG',
  'Vitamin D (25-OH)': 'VITAMIN_D',
  'Transferrin Sat': 'TRANSFERRIN_SAT',
  'CK-MB': 'CK_MB',
  'D-dimer': 'D_DIMER',
  'IL-6': 'IL_6',
  'TNF-alpha': 'TNF_ALPHA',
  'DHEA-S': 'DHEA_S',
  '3a-ADG': '3A_ADG',
  'PSA total': 'PSA_TOTAL',
  'PSA free': 'PSA_FREE',
  'CA-125': 'CA_125',
  'Lp(a)': 'LP_A',
};

function labSliceToValues(fp: LabSlice | null): Record<string, number> {
  if (!fp) return {};
  const out: Record<string, number> = {};
  for (const pk of PANEL_KEYS) {
    const panel = (fp as any)[pk] as Record<string, string> | undefined;
    if (!panel) continue;
    for (const [marker, val] of Object.entries(panel)) {
      if (!val) continue;
      const num = parseFloat(val);
      if (isNaN(num)) continue;
      const rename = MARKER_RENAME[marker] || marker.toUpperCase().replace(/\s+/g, '_');
      out[rename] = num;
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  Построение MapperCtx из state AutoCalculator
// ════════════════════════════════════════════════════════════════════════════
export function buildMapperCtx(
  state: CalculatorState,
  level: SupportLevel,
  manualChoices?: { addSubs?: string[]; removeSubs?: string[]; explicitCategories?: any[] },
  stackTriggers?: string[],
): MapperCtx {
  const phaseKey = (state.pharma.phase === 'bridge' ? 'bridge'
    : state.pharma.phase === 'pct' ? 'pct'
    : state.pharma.phase === 'base' ? 'trt'
    : 'course') as PhaseKey;

  const phaseCtx: PhaseContext = {
    usingAAS: state.pharma.aas.length > 0,
    usingBridgeAAS: state.pharma.aas.length > 0 && state.pharma.phase === 'bridge',
    explicitPhase: phaseKey,
    onPCTDrug: state.pharma.phase === 'pct',
    inFertilityProgram: false,
  };

  const labs = labSliceToValues(state.labs.fullPanel);

  const boosterCtx: BoosterTriggerCtx = {
    anxietyScore: state.neuro.aggressionScore,
    sleepHours: state.profile.sleepHours,
    stressScore: state.profile.stressLevel,
    cortisolHigh: false,
    irritability: state.neuro.aggressionScore > 6,
    jointPainScore: state.oda.jointPain === 'severe' ? 8 : state.oda.jointPain === 'moderate' ? 5 : state.oda.jointPain === 'mild' ? 3 : 0,
    crpLevel: labs['CRP'] || labs['HSCRP'],
    triggeredStackIds: stackTriggers || [],
  };

  return {
    labs,
    phaseCtx,
    boosterCtx,
    level,
    manualChoices,
    onCourse: state.pharma.aas.length > 0,
    e2Level: labs['ESTRADIOL'],
    hemoglobin: labs['HEMOGLOBIN'],
    hematocrit: labs['HEMATOCRIT'],
    hasHCG: state.pharma.hasHCG,
    hasAI: state.pharma.hasAI,
    libidoLow: false,
    bpSystolic: state.cardio.bpStage === 'high' ? 150 : state.cardio.bpStage === 'normal' ? 120 : 135,
    lipidLdl: labs['LDL'],
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  Компонент — карточка TZ-Mapper
// ════════════════════════════════════════════════════════════════════════════
export interface CalcMapperProps {
  state: CalculatorState;
  onApply?: (rec: SupportRecommendation) => void;
}

export const CalcMapperCard: React.FC<CalcMapperProps> = ({ state, onApply }) => {
  const [level, setLevel] = useState<SupportLevel>('medium');
  const [manualSubs, setManualSubs] = useState<string[]>([]);
  const [selectedStacks, setSelectedStacks] = useState<string[]>([]);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showGaps, setShowGaps] = useState(false);
  const [showGuardrails, setShowGuardrails] = useState(false);
  const [showBoosters, setShowBoosters] = useState(false);

  const ctx = useMemo(
    () => buildMapperCtx(state, level, level === 'manual' ? { addSubs: manualSubs } : undefined, selectedStacks),
    [state, level, manualSubs, selectedStacks],
  );

  const rec = useMemo(() => {
    try {
      return resolvePlan(ctx);
    } catch {
      return null;
    }
  }, [ctx]);

  const levelBtn = (lv: SupportLevel, label: string, icon: string) => {
    const active = level === lv;
    return (
      <button
        key={lv}
        onClick={() => setLevel(lv)}
        style={{
          flex: 1,
          padding: '8px 4px',
          borderRadius: 8,
          fontSize: 9,
          fontWeight: 700,
          cursor: 'pointer',
          textAlign: 'center',
          background: active ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.04)',
          border: active ? '2px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
          color: active ? '#000' : 'var(--text-dim)',
        }}
      >
        <div style={{ fontSize: 14 }}>{icon}</div>
        <div>{label}</div>
      </button>
    );
  };

  const phaseInfo = rec ? PHASE_PROTOCOL[rec.phase] : null;
  const blockGuardrails = rec?.guardrails.filter(g => g.level === 'block') || [];
  const warnGuardrails = rec?.guardrails.filter(g => g.level === 'warn') || [];

  return (
    <div style={{ ...GLASS, padding: 10, marginBottom: 8, border: '2px solid rgba(0,230,138,0.2)' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>
        🧬 Механизм-ориентированная модель (ТЗ-28)
      </div>
      <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.4 }}>
        Движок: лабы → 28 механизмов ТЗ → отбор веществ по k×breadth → фаза → guardrails → бустеры.
        Источник: tz-mapper-engine (5 файлов).
      </div>

      {/* 3 пресета + Manual */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {levelBtn('base', 'База', '🟢')}
        {levelBtn('medium', 'Средний', '🟡')}
        {levelBtn('max', 'Максимум', '🔴')}
        {levelBtn('manual', 'Вручную', '⚙️')}
      </div>

      {/* Фаза */}
      {phaseInfo && (
        <div style={{ marginBottom: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#818cf8' }}>
            📋 Фаза: {phaseInfo.label}
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.3 }}>
            {phaseInfo.algorithm.slice(0, 120)}{phaseInfo.algorithm.length > 120 ? '…' : ''}
          </div>
        </div>
      )}

      {/* Summary */}
      {rec && (
        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>
          {rec.summary}
        </div>
      )}

      {/* Manual mode — выбор веществ */}
      {level === 'manual' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            ⚙️ Ручной выбор веществ ({manualSubs.length})
          </div>
          <input
            type="text"
            value={manualSubs.join(', ')}
            onChange={e => setManualSubs(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="NAC, TUDCA, omega3, zinc…"
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.3)',
              color: '#fff',
              fontSize: 10,
              boxSizing: 'border-box',
              marginBottom: 4,
            }}
          />
          <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>
            Введите id веществ через запятую. Guardrails и конфликты проверяются автоматически.
          </div>
        </div>
      )}

      {/* Результат — список веществ */}
      {rec && rec.subs.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            💊 План ({rec.subs.length} веществ)
          </div>
          {rec.subs.map((s, i) => {
            const name = subNameRu(s.substanceId);
            const dose = subDosage(s.substanceId);
            const tier = subTier(s.substanceId);
            const tierCol = tier === 'core' ? 'rgba(0,230,138,0.15)' : tier === 'standard' ? 'rgba(99,102,241,0.15)' : tier === 'advanced' ? 'rgba(168,85,247,0.15)' : 'rgba(245,158,11,0.15)';
            return (
              <div key={s.substanceId + i} style={{ ...GLASS, padding: '4px 8px', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, fontSize: 8 }}>
                <span style={{ fontSize: 11 }}>💊</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{name}</span>
                    <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>· {s.substanceId}</span>
                    <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: tierCol, color: 'var(--text-light)' }}>{tier}</span>
                  </div>
                  {dose && (
                    <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginTop: 1 }}>
                      💉 {dose.mg} мг · {dose.timing}
                    </div>
                  )}
                  <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>
                    {s.reason}
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 1 }}>
                    {s.mechsCovered.map(m => (
                      <span key={m} style={{ fontSize: 7, color: '#818cf8' }}>{m}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={BADGE('rgba(0,230,138,0.15)')}>k={s.k.toFixed(2)}</span>
                  <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>док:{s.q}</div>
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={BADGE('rgba(99,102,241,0.15)')}>кат: {rec.subs.length}</span>
            <span style={BADGE('rgba(34,197,94,0.12)')}>мехов покр.: {rec.coverage.reduce((a, o) => a + o.totalCovered, 0)}</span>
            <span style={BADGE('rgba(239,68,68,0.12)')}>пробел: {rec.gaps.length}</span>
            <span style={BADGE('rgba(168,85,247,0.12)')}>бустеры: {rec.boosters.length}</span>
            <span style={BADGE('rgba(245,158,11,0.12)')}>конфл: {rec.conflicts.length}</span>
          </div>
        </div>
      )}

      {/* Подавленные вещества */}
      {rec && rec.suppression.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', marginBottom: 3 }}>
            🚫 Подавлены ({rec.suppression.length})
          </div>
          {rec.suppression.map((s, i) => (
            <div key={s.substanceId + i} style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 1 }}>
              <b>{s.substanceId}</b> — {s.reason}
            </div>
          ))}
        </div>
      )}

      {/* Guardrails */}
      {rec && rec.guardrails.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowGuardrails(!showGuardrails)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              background: blockGuardrails.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${blockGuardrails.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)'}`,
              color: blockGuardrails.length > 0 ? '#ef4444' : '#f59e0b',
              marginBottom: 2,
            }}
          >
            🛡 Guardrails: {blockGuardrails.length} блок / {warnGuardrails.length} пред. {showGuardrails ? '▲' : '▼'}
          </button>
          {showGuardrails && rec.guardrails.map((g, i) => (
            <div key={i} style={{ ...GLASS, padding: '4px 8px', marginBottom: 2, fontSize: 8, borderLeft: `3px solid ${g.level === 'block' ? '#ef4444' : '#f59e0b'}` }}>
              <div style={{ fontWeight: 600, color: g.level === 'block' ? '#ef4444' : '#f59e0b' }}>
                {g.level === 'block' ? '⛔' : '⚠️'} {g.substanceId || 'общее'} — {g.reason}
              </div>
              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>{g.level === 'block' ? 'Блокировка: препарат нельзя назначать' : 'Предупреждение: проконсультируйтесь с врачом'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Конфликты */}
      {rec && rec.conflicts.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>
            ⚔️ Конфликты ({rec.conflicts.length})
          </div>
          {rec.conflicts.map((c, i) => (
            <div key={i} style={{ fontSize: 8, color: 'var(--text)', marginBottom: 1 }}>
              <b>{c.a}</b> + <b>{c.b}</b>: {c.reason}
            </div>
          ))}
        </div>
      )}

      {/* Бустеры */}
      {rec && rec.boosters.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowBoosters(!showBoosters)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              background: 'rgba(168,85,247,0.08)',
              border: '1px solid rgba(168,85,247,0.15)',
              color: '#a855f7',
              marginBottom: 2,
            }}
          >
            🚀 Бустеры ({rec.boosters.length}) {showBoosters ? '▲' : '▼'}
          </button>
          {showBoosters && rec.boosters.map((b, i) => (
            <div key={i} style={{ ...GLASS, padding: '6px 8px', marginBottom: 2, fontSize: 8 }}>
              <div style={{ fontWeight: 700, color: '#a855f7', marginBottom: 2 }}>
                {b.key === 'neuro' ? '🧠' : b.key === 'joints' ? '🦴' : '📦'} {b.label}
              </div>
              <div style={{ fontSize: 7, color: 'var(--text-dim)' }}>{b.rationale}</div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                {b.subs.map(s => (
                  <span key={s.substanceId} style={{ fontSize: 7, color: 'var(--accent)' }}>{s.substanceId} · {s.reason.slice(0, 25)}{s.reason.length > 25 ? '…' : ''}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Выбор стеков-бустеров */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
          📦 Стеки-бустеры
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {STACK_BOOSTER_TRIGGERS.slice(0, 10).map(st => {
            const active = selectedStacks.includes(st.stackId);
            return (
              <button
                key={st.stackId}
                onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== st.stackId) : [...prev, st.stackId])}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: active ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: active ? '#a855f7' : 'var(--text-dim)',
                }}
              >
                {st.stackId.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Coverage matrix */}
      {rec && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowCoverage(!showCoverage)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.15)',
              color: '#22c55e',
              marginBottom: 2,
            }}
          >
            📊 Покрытие: {rec.coverage.reduce((a, o) => a + o.totalCovered, 0)}/{rec.coverage.reduce((a, o) => a + o.totalMechs, 0)} мехов {showCoverage ? '▲' : '▼'}
          </button>
          {showCoverage && rec.coverage.map(oc => (
            <div key={oc.organId} style={{ ...GLASS, padding: '4px 8px', marginBottom: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)' }}>{oc.organLabel}</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: oc.coveragePercent >= 80 ? '#22c55e' : oc.coveragePercent >= 50 ? '#fbbf24' : '#ef4444' }}>
                  {oc.totalCovered}/{oc.totalMechs} ({oc.coveragePercent}%)
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
                <div style={{ height: '100%', width: `${oc.coveragePercent}%`, background: oc.coveragePercent >= 80 ? '#22c55e' : oc.coveragePercent >= 50 ? '#fbbf24' : '#ef4444', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {oc.mechs.map(m => (
                  <span key={m.mechId} style={{
                    fontSize: 7,
                    padding: '1px 4px',
                    borderRadius: 3,
                    background: m.covered ? 'rgba(0,230,138,0.08)' : 'rgba(239,68,68,0.08)',
                    color: m.covered ? '#00e68a' : '#ef4444',
                  }}>
                    {m.mechId}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gaps */}
      {rec && rec.gaps.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => setShowGaps(!showGaps)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#ef4444',
              marginBottom: 2,
            }}
          >
            🕳 Пробелы ({rec.gaps.length}) {showGaps ? '▲' : '▼'}
          </button>
          {showGaps && rec.gaps.map((g, i) => (
            <div key={i} style={{ ...GLASS, padding: '4px 8px', marginBottom: 2, fontSize: 8 }}>
              <div style={{ fontWeight: 600, color: '#ef4444' }}>
                {g.organLabel} → {g.mechLabel} ({g.mechId})
              </div>
              <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 1 }}>
                Рекомендации: {g.suggestions.slice(0, 3).join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Активированные механизмы */}
      {rec && rec.activatedMechs.length > 0 && (
        <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.1)' }}>
          <div style={{ fontSize: 8, fontWeight: 600, color: '#60a5fa', marginBottom: 2 }}>
            ⚡ Активировано: {rec.activatedMechs.length} мехов
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {rec.activatedMechs.map(m => (
              <span key={m.mechId} style={{
                fontSize: 7,
                padding: '1px 4px',
                borderRadius: 3,
                background: m.severity === 'severe' ? 'rgba(239,68,68,0.1)' : m.severity === 'moderate' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.08)',
                color: m.severity === 'severe' ? '#ef4444' : m.severity === 'moderate' ? '#f59e0b' : '#22c55e',
              }}>
                {m.mechId}({m.severity.slice(0, 1)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Кнопка Применить */}
      {onApply && rec && (
        <button
          onClick={() => onApply(rec)}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '10px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            background: 'linear-gradient(135deg,#00e68a,#00c853)',
            border: 'none',
            color: '#000',
          }}
        >
          ✅ Применить план ТЗ ({rec.subs.length} веществ)
        </button>
      )}

      {/* ── Действия с планом: сохранить / копировать / отчёт врача ── */}
      {rec && rec.subs.length > 0 && (
        <CalcActions rec={rec} level={level} state={state} />
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  Действия с готовым планом: сохранить в избранное, копировать, отчёт врача
//  Это замена мёртвого SupportCalcResult.tsx (savePlan/copyPlan/exportForDoctor)
// ════════════════════════════════════════════════════════════════════════════
function buildPlanText(rec: SupportRecommendation): string {
  const lines: string[] = [];
  lines.push(`⎯⎯ ПЛАН ПОДДЕРЖКИ (ТЗ-28) ⎯⎯`);
  lines.push(`Уровень: ${rec.level}`);
  lines.push(`Фаза: ${rec.phaseLabel}`);
  lines.push(`Веществ: ${rec.subs.length}`);
  lines.push('');
  lines.push('НАЗНАЧЕНИЯ:');
  for (const s of rec.subs) {
    const name = subNameRu(s.substanceId);
    const dose = subDosage(s.substanceId);
    const doseStr = dose ? ` · ${dose.mg} мг (${dose.timing})` : '';
    lines.push(`• ${name}${doseStr} — ${s.reason}`);
    if (s.mechsCovered.length > 0) lines.push(`  покрывает: ${s.mechsCovered.join(', ')}`);
    lines.push(`  k=${s.k.toFixed(2)} · док.уровень: ${s.q}`);
  }
  if (rec.suppression.length > 0) {
    lines.push('');
    lines.push('ПОДАВЛЕНЫ:');
    for (const s of rec.suppression) lines.push(`• ${subNameRu(s.substanceId)} — ${s.reason}`);
  }
  if (rec.gaps.length > 0) {
    lines.push('');
    lines.push(`ПРОБЕЛЫ ПОКРЫТИЯ (${rec.gaps.length}):`);
    for (const g of rec.gaps) lines.push(`• ${g.organLabel} → ${g.mechLabel} (${g.mechId})`);
  }
  if (rec.conflicts.length > 0) {
    lines.push('');
    lines.push('КОНФЛИКТЫ:');
    for (const c of rec.conflicts) lines.push(`• ${subNameRu(c.a)} + ${subNameRu(c.b)}: ${c.reason}`);
  }
  if (rec.guardrails.length > 0) {
    lines.push('');
    lines.push('GUARDRAILS:');
    for (const g of rec.guardrails) lines.push(`• [${g.level}] ${g.substanceId || 'Общее'}: ${g.reason}`);
  }
  if (rec.boosters.length > 0) {
    lines.push('');
    lines.push('БУСТЕРЫ:');
    for (const b of rec.boosters) {
      lines.push(`• ${b.label}: ${b.rationale}`);
      for (const s of b.subs) lines.push(`  ↳ ${subNameRu(s.substanceId)} · ${s.reason}`);
    }
  }
  lines.push('');
  lines.push('СВОДКА:');
  lines.push(rec.summary);
  return lines.join('\n');
}

function buildDoctorReport(rec: SupportRecommendation, state: CalculatorState): string {
  const lines: string[] = [];
  lines.push('ОТЧЁТ ДЛЯ ВРАЧА — МЕХАНИЗМ-ОРИЕНТИРОВАННАЯ МОДЕЛЬ ТЗ-28');
  lines.push('Sources: tz-mapper-engine, tz-bridge-* (5 файлов). Все механизмы из 28 ТЗ.');
  lines.push('');
  lines.push(`Пациент: вес ${state.profile.weight} кг, возраст ${state.profile.age}, пол: ${state.profile.sex}`);
  lines.push(`Курс: ${state.pharma.aas.length} ААС, фаза: ${state.pharma.phase}, ХГЧ: ${state.pharma.hasHCG ? 'да' : 'нет'}, АИ: ${state.pharma.hasAI ? 'да' : 'нет'}`);
  lines.push('');
  lines.push(`Уровень поддержки: ${rec.level}`);
  lines.push(`Фаза определения: ${rec.phase} → ${rec.phaseLabel}`);
  lines.push('');
  lines.push('НАЗНАЧЕНИЯ (по k × breadth, с учётом фазы и guardrails):');
  for (const s of rec.subs) {
    const name = subNameRu(s.substanceId);
    const dose = subDosage(s.substanceId);
    const doseStr = dose ? `, ${dose.mg} мг (${dose.timing})` : '';
    lines.push(`- ${name}${doseStr}`);
    const organGuess = s.mechsCovered[0] ? mechToOrganLabel(s.mechsCovered[0]) : '—';
    lines.push(`  Категория: ${s.category}, система: ${organGuess}`);
    lines.push(`  Механизмы покрытия: ${s.mechsCovered.join(', ')}`);
    lines.push(`  Сила (k): ${s.k.toFixed(2)}, уровень доказательности: ${s.q}`);
    lines.push(`  Обоснование: ${s.reason}`);
  }
  if (rec.suppression.length > 0) {
    lines.push('');
    lines.push('ИСКЛЮЧЕНЫ:');
    for (const s of rec.suppression) lines.push(`- ${subNameRu(s.substanceId)}: ${s.reason}`);
  }
  if (rec.guardrails.length > 0) {
    lines.push('');
    lines.push('GUARDRAILS (ограничения безопасности):');
    for (const g of rec.guardrails) lines.push(`- [${g.level.toUpperCase()}] ${g.substanceId || 'Общее'}: ${g.reason}`);
  }
  if (rec.conflicts.length > 0) {
    lines.push('');
    lines.push('КОНФЛИКТЫ ПАР:');
    for (const c of rec.conflicts) lines.push(`- ${subNameRu(c.a)} + ${subNameRu(c.b)}: ${c.reason}`);
  }
  if (rec.boosters.length > 0) {
    lines.push('');
    lines.push('БУСТЕРЫ (триггеры фазы/состояния):');
    for (const b of rec.boosters) {
      lines.push(`- ${b.label}`);
      lines.push(`  Обоснование: ${b.rationale}`);
      lines.push(`  Добавки: ${b.subs.map(s => `${subNameRu(s.substanceId)} (${s.reason})`).join('; ')}`);
      lines.push(`  Механизмы: ${b.mechs.join(', ')}`);
      lines.push(`  Органы: ${b.organs.join(', ')}`);
    }
  }
  lines.push('');
  lines.push('ПОКРЫТИЕ СИСТЕМ:');
  for (const oc of rec.coverage) {
    lines.push(`- ${oc.organLabel}: ${oc.totalCovered}/${oc.totalMechs} (${oc.coveragePercent}%)`);
  }
  if (rec.gaps.length > 0) {
    lines.push('');
    lines.push(`НЕПОКРЫТЫЕ МЕХАНИЗМЫ (${rec.gaps.length}):`);
    for (const g of rec.gaps) lines.push(`- ${g.organLabel} → ${g.mechLabel} (${g.mechId})`);
  }
  lines.push('');
  lines.push('СВОДКА ДВИЖКА:');
  lines.push(rec.summary);
  lines.push('');
  lines.push(`Обоснование алгоритма: ${rec.rationale}`);
  return lines.join('\n');
}

interface CalcActionsProps {
  rec: SupportRecommendation;
  level: SupportLevel;
  state: CalculatorState;
}

const CalcActions: React.FC<CalcActionsProps> = ({ rec, state }) => {
  const [savedFlash, setSavedFlash] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const [doctorFlash, setDoctorFlash] = useState(false);

  const saveToFavorites = useCallback(() => {
    try {
      const key = 'he_saved_calc_results';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      const id = `calc_${Date.now()}`;
      arr.push({
        id,
        type: 'calc',
        timestamp: Date.now(),
        supportLevel: rec.level,
        subs: rec.subs.map(s => s.substanceId),
        tzRec: rec,
      });
      localStorage.setItem(key, JSON.stringify(arr));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) {
      console.error('saveToFavorites failed', e);
    }
  }, [rec]);

  const copyPlan = useCallback(async () => {
    const text = buildPlanText(rec);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    setCopiedFlash(true);
    setTimeout(() => setCopiedFlash(false), 1800);
  }, [rec]);

  const copyDoctor = useCallback(async () => {
    const text = buildDoctorReport(rec, state);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    setDoctorFlash(true);
    setTimeout(() => setDoctorFlash(false), 1800);
  }, [rec, state]);

  const btn = (label: string, onClick: () => void, flash: boolean, col: string, icon: string) => (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '7px 6px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
        background: flash ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.04)',
        border: flash ? '1px solid rgba(0,230,138,0.4)' : `1px solid ${col}`,
        color: flash ? '#00e68a' : col, minWidth: 0,
      }} aria-label={label}
    >
      {flash ? '✓' : icon} {flash ? 'Готово' : label}
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
      {btn('Сохранить', saveToFavorites, savedFlash, 'rgba(99,102,241,0.4)', '💾')}
      {btn('Копировать', copyPlan, copiedFlash, 'rgba(96,165,250,0.4)', '📋')}
      {btn('Врачу', copyDoctor, doctorFlash, 'rgba(168,85,247,0.4)', '📄')}
    </div>
  );
};

export default CalcMapperCard;