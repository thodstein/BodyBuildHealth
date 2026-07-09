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
import { classifyPed } from '../../../data/ped-potency-table';
import { getSubstanceForm, type SubstanceForm } from '../../../data/substance-forms';
import { checkInteractions, type DrugInteraction } from '../../../data/drug-interactions';
import { getTitrationProtocol, type TitrationProtocol } from '../../../data/titration-protocols';
import { GLASS, BADGE } from './Calc.types';

// ── Утилиты отображения вещества ─────────────────────────────────────────────
const SUB_NAME_CACHE: Record<string, string> = {};
const FALLBACK_NAMES: Record<string, string> = {
  niacin: 'Ниацин (B3)', phosphatidylserine: 'Фосфатидилсерин', glycine: 'Глицин',
  theanine: 'L-Теанин', quercetin: 'Кверцетин', garlic: 'Чеснок (экстракт)',
  beetroot: 'Beetroot (экстракт)', lecithin: 'Лецитин (ФХ)',
  iron_bisglycinate: 'Iron bisglycinate', tadalafil: 'Тадалафил',
  agmatine: 'Агматин', tmg: 'TMG (Бетаин)', pycnogenol: 'Пикногенол',
  citrulline: 'Цитруллин', bergamot: 'Бергамот', astaxanthin: 'Астаксантин',
  dandelion: 'Dandelion (Одуванчик)', hesperidin: 'Гесперидин+Диосмин',
  serrapeptase: 'Серрапептаза', nattokinase: 'Наттокиназа', bromelain: 'Бромелайн',
  anastrozole: 'Анастрозол', cabergoline: 'Каберголин', hcg: 'ХГЧ',
  telmisartan: 'Тельмисартан', tudca: 'TUDCA', nac: 'NAC',
  milk_thistle: 'Силимарин', omega3: 'Омега-3', coq10: 'CoQ10',
  taurine: 'Таурин', curcumin: 'Куркумин', piperine: 'Пиперин',
  berberine: 'Берберин', astragalus: 'Астрагал', cordyceps: 'Кордицепс',
  vitamin_d3: 'Витамин D3', vitamin_k2: 'Витамин K2', magnesium: 'Магний',
  vitamin_b6: 'B6 (P5P)', vitamin_b12: 'B12 (метил)', folate: 'Фолат (5-MTHF)',
  vitamin_c: 'Витамин C', vitamin_e: 'Витамин E', b_complex: 'B-Complex',
  nebivolol: 'Небиволол', chromium: 'Хром (пиколинат)', tamoxifen: 'Тамоксифен',
  spironolactone: 'Спиронолактон', melatonin: 'Мелатонин', calcium: 'Кальций',
  metformin: 'Метформин', potassium: 'Калий', leucine: 'Лейцин',
  saw_palmetto: 'Saw Palmetto',
  alpha_lipoic: 'α-Липоевая', l_carnitine: 'L-Карнитин',
};
function subNameRu(id: string): string {
  if (SUB_NAME_CACHE[id]) return SUB_NAME_CACHE[id];
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  const name = e?.nameRu || e?.name || FALLBACK_NAMES[id] || FALLBACK_NAMES[id?.toLowerCase()] || id;
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

  // v5: построить pedDoses из state.pharma
  const pedDoses = (state.pharma.aas || [])
    .filter((a: any) => a && a.id)
    .map((a: any) => ({
      id: (a.id as string).toLowerCase(),
      pClass: classifyPed(a.id),
      mgPerWeek: a.mgPerWeek ?? a.dosePerWeek ?? (a.dose ? Number(String(a.dose).replace(/\D/g,''))*7 : 500),
      form: (a.form === 'oral' ? 'oral' : 'inject') as 'oral' | 'inject',
    }));
  // Дополнить GH/insulin/IGF из state.pharma если есть
  const ghIU = (state.pharma as any).ghIU || 0;
  if (ghIU > 0) pedDoses.push({ id: 'somatropin', pClass: 'gh', iuPerDay: ghIU, form: 'subq' } as any);
  const insulinIU = (state.pharma as any).insulinIU || 0;
  if (insulinIU > 0) pedDoses.push({ id: 'insulin_rapid', pClass: 'insulin', iuPerDay: insulinIU, form: 'subq' } as any);
  const igfMcg = (state.pharma as any).igfMcg || 0;
  if (igfMcg > 0) pedDoses.push({ id: 'igf1_lr3', pClass: 'igf', mcgPerDay: igfMcg, form: 'subq' } as any);
  const clenMcg = (state.pharma as any).clenMcg || 0;
  if (clenMcg > 0) pedDoses.push({ id: 'clenbuterol', pClass: 'clenbut', mcgPerDay: clenMcg, form: 'oral' } as any);
  const t3Mcg = (state.pharma as any).t3Mcg || 0;
  if (t3Mcg > 0) pedDoses.push({ id: 't3', pClass: 't3', mcgPerDay: t3Mcg, form: 'oral' } as any);
  return {
    labs,
    phaseCtx,
    boosterCtx,
    level,
    manualChoices,
    onCourse: state.pharma.aas.length > 0 || pedDoses.length > 0,
    e2Level: labs['ESTRADIOL'],
    hemoglobin: labs['HEMOGLOBIN'],
    hematocrit: labs['HEMATOCRIT'],
    hasHCG: state.pharma.hasHCG,
    hasAI: state.pharma.hasAI,
    hasCabergoline: (state.pharma as any).hasCaber || false,
    aasIds: (state.pharma.aas || []).map((a: any) => a.id || '').filter(Boolean),
    pedDoses,
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
  onOpenManualPicker?: () => void;
}

export const CalcMapperCard: React.FC<CalcMapperProps> = ({ state, onApply, onOpenManualPicker }) => {
  const [level, setLevel] = useState<SupportLevel>('medium');
  const [manualSubs, setManualSubs] = useState<string[]>([]);
  const [selectedStacks, setSelectedStacks] = useState<string[]>([]);
  const [showCoverage, setShowCoverage] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [showGaps, setShowGaps] = useState(false);
  const [showGuardrails, setShowGuardrails] = useState(false);
  const [showBoosters, setShowBoosters] = useState(false);
  const [showIntellPopup, setShowIntellPopup] = useState(false);
  const [showManualPopup, setShowManualPopup] = useState(false);
  const [manualSubInput, setManualSubInput] = useState('');

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

      {/* ===== КАРТОЧКА ФАЗЫ КУРСА (большая, красивая) ===== */}
      {phaseInfo && (
        <div style={{
          marginBottom: 10,
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
          border: '1.5px solid rgba(139,92,246,0.25)',
          padding: '14px 14px 12px',
          boxShadow: '0 4px 20px rgba(99,102,241,0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Декоративная полоса */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#818cf8,#a78bfa)', borderTopLeftRadius:16, borderTopRightRadius:16 }} />
          
          {/* Заголовок */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15))',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:18,
            }}>📋</div>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:'#818cf8', letterSpacing:'-0.3px' }}>
                Фаза курса: {phaseInfo.label}
              </div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', marginTop:1, letterSpacing:'-0.2px' }}>
                {phaseInfo.description}
              </div>
            </div>
          </div>

          {/* Алгоритм */}
          <div style={{
            background:'rgba(0,0,0,0.2)', borderRadius:10, padding:'8px 10px',
            border:'1px solid rgba(255,255,255,0.04)', marginBottom:8,
          }}>
            <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.3px' }}>
              Алгоритм фазы
            </div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.75)', lineHeight:1.5, fontWeight:500 }}>
              {phaseInfo.algorithm}
            </div>
          </div>

          {/* Мета-инфа */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:8, padding:'3px 8px', borderRadius:6, background:'rgba(99,102,241,0.12)', color:'#818cf8', fontWeight:600 }}>
              🎯 Приоритет: {phaseInfo.coreMechs.slice(0,4).join(', ')}{phaseInfo.coreMechs.length > 4 ? '…' : ''}
            </span>
            <span style={{ fontSize:8, padding:'3px 8px', borderRadius:6, background:'rgba(34,197,94,0.12)', color:'#22c55e', fontWeight:600 }}>
              Бустеры: {phaseInfo.allowBoosters ? '✅ да' : '❌ нет'}
            </span>
            <span style={{ fontSize:8, padding:'3px 8px', borderRadius:6, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontWeight:600 }}>
              Множитель доз: ×{phaseInfo.doseTier}
            </span>
          </div>
        </div>
      )}

      {/* ===== ВЫБОР РЕЖИМА: ИНТЕЛЛЕКТ / РУЧНОЙ (в 1 строку) ===== */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>

      {/* ===== КАРТОЧКА ИНТЕЛЛЕКТУАЛЬНАЯ ПОДДЕРЖКА ===== */}
      <div style={{
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(0,230,138,0.06), rgba(0,200,83,0.03))',
        border: '1.5px solid rgba(0,230,138,0.15)',
        padding: '14px 14px 12px',
        boxShadow: '0 4px 20px rgba(0,230,138,0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
        onClick={() => setShowIntellPopup(true)}
      >
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background:'linear-gradient(135deg,rgba(0,230,138,0.15),rgba(0,200,83,0.1))',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:18,
          }}>🧠</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#00e68a', letterSpacing:'-0.3px' }}>
              Интеллектуальная поддержка
            </div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:1 }}>
              {level === 'base' && '🟢 База — core-препараты (NAC, омега-3, магний)'}
              {level === 'medium' && '🟡 Средний — core + standard, оптимум цена/эффективность'}
              {level === 'max' && '🔴 Максимум — полное покрытие + advanced'}
              {level === 'manual' && '⚙️ Вручную — вы сами выбираете'}
            </div>
          </div>
          <div style={{
            width:24, height:24, borderRadius:12,
            background:'rgba(0,230,138,0.1)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, color:'#00e68a',
          }}>›</div>
        </div>
      </div>

      {/* ── Попап интеллектуального выбора ── */}
      {showIntellPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)' }}
          onClick={() => setShowIntellPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:340, borderRadius:20, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding:'18px 16px 14px' }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#00e68a', marginBottom:4, letterSpacing:'-0.3px' }}>🧠 Интеллектуальная поддержка</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginBottom:12, lineHeight:1.4 }}>
                Движок ТЗ-28 подберёт оптимальный набор веществ под ваш профиль, лабы и фазу курса
              </div>
              {([
                ['base','База','🟢','Только core-препараты: NAC, омега-3, магний, D3. Бюджетный вариант для низкого риска.'],
                ['medium','Средний','🟡','Core + standard. Оптимальный баланс цены и покрытия. Рекомендуется для большинства.'],
                ['max','Максимум','🔴','Все активированные механизмы + advanced препараты. Полная защита для高风险 (high-risk) курсов.'],
              ] as const).map(([lv, label, icon, desc]) => {
                const active = level === lv;
                return (
                  <div key={lv} onClick={() => { setLevel(lv as SupportLevel); setShowIntellPopup(false); }}
                    style={{
                      padding:'12px 12px', borderRadius:12, marginBottom:6, cursor:'pointer',
                      background: active ? 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,200,83,0.06))' : 'rgba(255,255,255,0.03)',
                      border: active ? '1.5px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.05)',
                      transition:'all 0.12s ease',
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:20 }}>{icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, fontWeight:700, color: active ? '#00e68a' : 'var(--text)', letterSpacing:'-0.2px' }}>
                          {label} {active && '✓'}
                        </div>
                        <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:2, lineHeight:1.3 }}>{desc}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== КАРТОЧКА РУЧНОЙ РЕЖИМ ===== */}
      <div style={{
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(59,130,246,0.03))',
        border: '1.5px solid rgba(99,102,241,0.15)',
        padding: '14px 14px 12px',
        boxShadow: '0 4px 20px rgba(99,102,241,0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
        onClick={() => setShowManualPopup(true)}
      >
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background:'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(59,130,246,0.1))',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:18,
          }}>⚙️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:800, color:'#818cf8', letterSpacing:'-0.3px' }}>
              Ручной режим
            </div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:1 }}>
              {manualSubs.length > 0 || selectedStacks.length > 0
                ? `📦 ${selectedStacks.length} стеков · 💊 ${manualSubs.length} препаратов`
                : 'Выберите стеки и препараты вручную'}
            </div>
          </div>
          <div style={{
            width:24, height:24, borderRadius:12,
            background:'rgba(99,102,241,0.1)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, color:'#818cf8',
          }}>›</div>
        </div>
      </div>

      {/* ── Попап ручного режима ── */}
      {showManualPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)' }}
          onClick={() => setShowManualPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:340, borderRadius:20, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.6)', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
            <div style={{ height:3, background:'linear-gradient(90deg,#818cf8,#6366f1)' }} />
            <div style={{ padding:'18px 16px 14px', overflowY:'auto' }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#818cf8', marginBottom:4, letterSpacing:'-0.3px' }}>⚙️ Ручной режим</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginBottom:12, lineHeight:1.4 }}>
                Самостоятельно добавьте готовые стеки или отдельные препараты
              </div>

              {onOpenManualPicker && (
                <button onClick={() => { setShowManualPopup(false); setTimeout(onOpenManualPicker, 200); }} style={{
                  width:'100%', marginBottom:10, padding:'8px', borderRadius:8,
                  background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.25)',
                  color:'#a78bfa', fontWeight:700, fontSize:10, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}>
                  <span style={{fontSize:13}}>📂</span>
                  <span>Выбрать из каталога / стеков / избранного</span>
                </button>
              )}

              {/* Добавить стек */}
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text)', marginBottom:6, letterSpacing:'-0.2px' }}>
                📦 Добавить стек
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:14 }}>
                {STACK_BOOSTER_TRIGGERS.slice(0,14).map(st => {
                  const active = selectedStacks.includes(st.stackId);
                  return (
                    <button key={st.stackId}
                      onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== st.stackId) : [...prev, st.stackId])}
                      style={{
                        padding:'6px 10px', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer',
                        background: active ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
                        border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        color: active ? '#c084fc' : 'rgba(255,255,255,0.5)',
                      }}>
                      {st.stackId.includes('neuro') && '🧠'}
                      {st.stackId.includes('joint') || st.stackId.includes('articular') ? '🦴' : ''}
                      {st.stackId.includes('sleep') && '😴'}
                      {st.stackId.includes('stress') && '🧘'}
                      {st.stackId.includes('skin') && '💆'}
                      {st.stackId.includes('gi') && '🫀'}
                      {st.stackId.includes('immun') && '🛡️'}
                      {st.stackId.includes('liver') && '🫁'}
                      {st.stackId.includes('renal') || st.stackId.includes('kidney') || st.stackId.includes('nephro') ? '💧' : ''}
                      {st.stackId.includes('libido') && '🔥'}
                      {st.stackId.includes('heart') || st.stackId.includes('cardio') ? '❤️' : ''}
                      {st.stackId.includes('bone') && '🦷'}
                      {st.stackId.includes('thyroid') && '🔬'}
                      {st.stackId.includes('detox') && '🧪'}
                      {st.stackId.includes('noo') && '🧠'}
                      {' '}{st.stackId.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}
                      {active && ' ✓'}
                    </button>
                  );
                })}
              </div>

              {/* Добавить препарат */}
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text)', marginBottom:6, letterSpacing:'-0.2px' }}>
                💊 Добавить препарат
              </div>
              <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                <input value={manualSubInput} onChange={e => setManualSubInput(e.target.value)}
                  placeholder="ID препарата: NAC, TUDCA, omega3, zinc..."
                  style={{
                    flex:1, padding:'8px 10px', borderRadius:8, fontSize:9,
                    background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)',
                    color:'#fff', outline:'none',
                  }} />
                <button onClick={() => {
                  if (!manualSubInput.trim()) return;
                  const ids = manualSubInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                  setManualSubs(prev => [...new Set([...prev, ...ids])]);
                  setManualSubInput('');
                }} style={{
                  padding:'8px 12px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer',
                  background:'linear-gradient(135deg,#818cf8,#6366f1)', border:'none', color:'#000',
                }}>+</button>
              </div>

              {/* Список выбранных препаратов */}
              {manualSubs.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:8, fontWeight:600, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>
                    Выбрано: {manualSubs.length} препаратов
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {manualSubs.map((sid, i) => (
                      <span key={sid + i} style={{
                        fontSize:8, padding:'2px 8px', borderRadius:6, fontWeight:600,
                        background:'rgba(99,102,241,0.12)', color:'#818cf8',
                        display:'flex', alignItems:'center', gap:4,
                      }}>
                        {sid}
                        <span onClick={() => setManualSubs(prev => prev.filter((_, j) => j !== i))}
                          style={{ cursor:'pointer', color:'rgba(255,255,255,0.3)', fontSize:9 }}>✕</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Итог */}
              {(selectedStacks.length > 0 || manualSubs.length > 0) && (
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', lineHeight:1.3, padding:'8px 10px', borderRadius:8, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.04)' }}>
                  📋 Итого: {selectedStacks.length} стеков · {manualSubs.length} препаратов
                </div>
              )}

              <button onClick={() => { setLevel('manual'); setShowManualPopup(false); }}
                style={{
                  width:'100%', marginTop:12, padding:'10px', borderRadius:10,
                  background:'linear-gradient(135deg,#818cf8,#6366f1)', border:'none',
                  color:'#000', fontWeight:700, fontSize:11, cursor:'pointer',
                }}>
                ✅ Применить ручной выбор
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* конец grid intellect + manual */}

      {/* ===== ДОПОЛНИТЕЛЬНЫЕ МОДУЛИ (суставы, нейро, усиление) ===== */}
      {level !== 'manual' && (
        <div style={{
          marginBottom: 10,
          borderRadius: 14,
          background: 'rgba(24,24,27,0.3)',
          border: '1px solid rgba(255,255,255,0.04)',
          padding: '10px 12px 8px',
        }}>
          <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.3)', marginBottom:6, letterSpacing:'0.5px', textTransform:'uppercase' }}>
            + Дополнительные модули
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={() => setSelectedStacks(prev => { const id='articular_stack'; return prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]; })}
              style={{
                flex:1, padding:'8px 4px', borderRadius:10, fontSize:8, fontWeight:600, cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:1, transition:'all 0.12s ease',
                background: selectedStacks.includes('articular_stack') ? 'linear-gradient(135deg,rgba(34,197,94,0.2),rgba(34,197,94,0.1))' : 'rgba(255,255,255,0.03)',
                border: selectedStacks.includes('articular_stack') ? '1.5px solid rgba(34,197,94,0.35)' : '1px solid rgba(255,255,255,0.06)',
                color: selectedStacks.includes('articular_stack') ? '#4ade80' : 'rgba(255,255,255,0.5)',
              }}>
              <span style={{fontSize:14}}>🦴</span>
              <span>Суставы</span>
              {selectedStacks.includes('articular_stack') && <span style={{fontSize:6,fontWeight:700,color:'#4ade80',marginTop:1}}>✓</span>}
            </button>
            <button onClick={() => setSelectedStacks(prev => { const id='neuroprotection_stack'; return prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]; })}
              style={{
                flex:1, padding:'8px 4px', borderRadius:10, fontSize:8, fontWeight:600, cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:1, transition:'all 0.12s ease',
                background: selectedStacks.includes('neuroprotection_stack') ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.1))' : 'rgba(255,255,255,0.03)',
                border: selectedStacks.includes('neuroprotection_stack') ? '1.5px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.06)',
                color: selectedStacks.includes('neuroprotection_stack') ? '#818cf8' : 'rgba(255,255,255,0.5)',
              }}>
              <span style={{fontSize:14}}>🧠</span>
              <span>Нейро</span>
              {selectedStacks.includes('neuroprotection_stack') && <span style={{fontSize:6,fontWeight:700,color:'#818cf8',marginTop:1}}>✓</span>}
            </button>
            <button onClick={() => setSelectedStacks(prev => { const id='mega_total_support_35'; return prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]; })}
              style={{
                flex:1, padding:'8px 4px', borderRadius:10, fontSize:8, fontWeight:600, cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:1, transition:'all 0.12s ease',
                background: selectedStacks.includes('mega_total_support_35') ? 'linear-gradient(135deg,rgba(239,68,68,0.2),rgba(239,68,68,0.1))' : 'rgba(255,255,255,0.03)',
                border: selectedStacks.includes('mega_total_support_35') ? '1.5px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.06)',
                color: selectedStacks.includes('mega_total_support_35') ? '#f87171' : 'rgba(255,255,255,0.5)',
              }}>
              <span style={{fontSize:14}}>🚀</span>
              <span>Усиление</span>
              {selectedStacks.includes('mega_total_support_35') && <span style={{fontSize:6,fontWeight:700,color:'#f87171',marginTop:1}}>✓</span>}
            </button>
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

      {/* STOP COURSE banner (TIER 3) */}
      {rec && rec.stopCourse && (
        <div style={{ margin: '6px 0', padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 4 }}>⛔ ОСТАНОВИТЬ КУРС AAS</div>
          {rec.alerts?.map((a, i) => (
            <div key={i} style={{ fontSize: 9, color: '#fca5a5', marginBottom: 2, lineHeight: 1.4 }}>{a.message}</div>
          ))}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Рекомендации — для специалиста. Не заменяют консультацию врача.</div>
        </div>
      )}

      {/* TIER  alerts (без stopCourse) */}
      {rec && !rec.stopCourse && rec.alerts && rec.alerts.length > 0 && (
        <div style={{ margin: '6px 0', padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          {rec.alerts.map((a, i) => (
            <div key={i} style={{ fontSize: 9, color: '#fbbf24', marginBottom: 2, lineHeight: 1.4 }}>⚠ {a.message}</div>
          ))}
        </div>
      )}

      {/* Результат — единый список препаратов */}
      {rec && rec.subs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            Назначено {rec.subs.length} препаратов
            {rec.titrationFactors && rec.titrationFactors.size > 0 && (
              <span style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', padding: '1px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.15)' }}>
                ↑{rec.titrationFactors.size} дозы скорректированы
              </span>
            )}
          </div>
          {rec.subs.map((s, i) => {
            const name = subNameRu(s.substanceId);
            const dose = subDosage(s.substanceId);
            const titrFactor = rec.titrationFactors?.get(canonIdLocal(s.substanceId));
            const isTitrated = !!titrFactor && titrFactor > 1;
            const form = getSubstanceForm(s.substanceId);
            const titr = getTitrationProtocol(s.substanceId);
            const hasDetails = !!form || !!titr;
            const isExpanded = expandedSub === s.substanceId;
            return (
              <div key={s.substanceId + i} >
                <div
                  onClick={() => hasDetails && setExpandedSub(isExpanded ? null : s.substanceId)}
                  style={{ ...GLASS, padding: '6px 10px', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, borderLeft: isTitrated ? '3px solid #f59e0b' : undefined, cursor: hasDetails ? 'pointer' : 'default' }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                    {isTitrated && (
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b', marginLeft: 4, padding: '1px 4px', borderRadius: 4, background: 'rgba(245,158,11,0.15)' }}>↑{((titrFactor - 1) * 100).toFixed(0)}%</span>
                    )}
                    {hasDetails && (
                      <span style={{ fontSize: 7, color: 'var(--text-dim)', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
                    )}
                  </span>
                  {dose && (
                    <span style={{ fontSize: 8, color: isTitrated ? '#f59e0b' : '#00e68a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {titrFactor && titrFactor > 1 ? Math.round(dose.mg * titrFactor) : dose.mg} мг · {dose.timing}
                    </span>
                  )}
                </div>
                {isExpanded && hasDetails && (
                  <div style={{ ...GLASS, padding: '8px 10px', marginBottom: 3, fontSize: 8, lineHeight: 1.5, borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
                    {form && form.optimalForm && (
                      <div style={{ marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, color: '#818cf8' }}>Форма: </span>
                        <span style={{ color: 'var(--text-light)' }}>{form.optimalForm}</span>
                      </div>
                    )}
                    {form && form.pharmacyBrands && form.pharmacyBrands.length > 0 && (
                      <div style={{ marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, color: '#818cf8' }}>Аптечные: </span>
                        <span style={{ color: 'var(--text-light)' }}>{form.pharmacyBrands.join(', ')}</span>
                      </div>
                    )}
                    {form && form.altForm && (
                      <div style={{ marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>Замена: </span>
                        <span style={{ color: 'var(--text-light)' }}>{form.altForm}</span>
                      </div>
                    )}
                    {form && form.bioavailability && (
                      <div style={{ marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>Биодоступность: </span>
                        <span style={{ color: 'var(--text-light)' }}>{form.bioavailability}</span>
                      </div>
                    )}
                    {form && form.note && (
                      <div style={{ marginBottom: 3, color: 'var(--text-light)', opacity: 0.8 }}>{form.note}</div>
                    )}
                    {titr && (
                      <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                        <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>Титрация: {titr.startDose} → {titr.maxDose}</div>
                        {titr.steps.map((step, si) => (
                          <div key={si} style={{ fontSize: 7, color: 'var(--text-light)', marginBottom: 1 }}>
                            <b>{step.dose}</b> ({step.duration})
                            {step.trigger ? ' — ' + step.trigger : ''}
                            {step.labTarget ? ' [цель: ' + step.labTarget + ']' : ''}
                          </div>
                        ))}
                        {titr.flushWarning && (
                          <div style={{ fontSize: 7, color: '#fbbf24', marginTop: 2 }}>{titr.flushWarning}</div>
                        )}
                        <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 2 }}>Контроль: {titr.monitorLabs.join(', ')} — {titr.frequency}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Нутри-корректировки по анализам */}
      {rec && rec.nutritionTips && rec.nutritionTips.length > 0 && (
        <div style={{marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a', marginBottom: 4 }}>Питание по анализам ({rec.nutritionTips.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {rec.nutritionTips.slice(0, 12).map((n, i) => (
              <div key={i} style={{ ...GLASS, padding: '4px 8px', fontSize: 8, color: 'var(--text-light)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{n.action}</span>
                <br />
                <span style={{ opacity: 0.7 }}>{n.target}</span>
              </div>
            ))}
          </div>
        </div>
)}

      {/* Warnings: multi-oral, GH+insulin, winny+oxy */}
      {rec && (() => {
        const warnings: string[] = [];
        const flags = rec.pedFlags;
        if (flags) {
          if (flags.isMultiOral) warnings.push('⚠ Более 1 орального 17α — резко ↑ гепатотоксичность');
          if (flags.isGHPlusInsulin) warnings.push('⚠ GH + Инсулин — высокий риск гипогликемии, обязателен мониторинг глюкозы');
          if (flags.isWinnyPlusOxy) warnings.push('⚠ Winstrol + Anadrol — крайне нежелательная комбинация (липиды, печень)');
          if (flags.has17AlphaAndGH) warnings.push('⚠ 17α-Орал + GH — синергичная гепатотоксичность, тщательный мониторинг АЛТ/АСТ');
        }
        if (warnings.length === 0) return null;
        return (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>Предупреждения о курсе</div>
            {warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 9, color: '#c4b5fd', marginBottom: 2, lineHeight: 1.4 }}>{w}</div>
            ))}
          </div>
        );
      })()}

      {/* Взаимодействия препаратов (drug-drug) */}
      {rec && rec.subs.length > 1 && (() => {
        const interactions = checkInteractions(rec.subs.map(s => s.substanceId));
        if (interactions.length === 0) return null;
        const blocks = interactions.filter(i => i.severity === 'block');
        return (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: blocks.length ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid ' + (blocks.length ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)') }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: blocks.length ? '#ef4444' : '#fbbf24', marginBottom: 4 }}>
              {blocks.length ? '⛔ Взаимодействия (критичные)' : '⚠ Взаимодействия'} ({interactions.length})
            </div>
            {interactions.map((intr, i) => (
              <div key={i} style={{ fontSize: 8, color: intr.severity === 'block' ? '#fca5a5' : '#fbbf24', marginBottom: 2, lineHeight: 1.4 }}>
                [{intr.severity === 'block' ? '⛔' : '⚠'}] <b>{intr.a}</b> + <b>{intr.b}</b> — {intr.reason}
                <div style={{ fontSize: 7, opacity: 0.8 }}>{intr.action}</div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

// Локальный канон-нормализатор для titration lookup
function canonIdLocal(id: string): string {
  const map: Record<string, string> = {
    telmi: 'telmisartan', tmg: 'betaine', pharma_anastrozole: 'anastrozole',
    pharma_cabergoline: 'cabergoline', nac_sup: 'nac', silymarin: 'milk_thistle',
    coq10: 'coq10', '5_mthf': 'folate', l_carnitine: 'l_carnitine',
    agmatine_sulfate: 'agmatine',
  };
  return map[id?.toLowerCase()] || map[id] || (id?.toLowerCase() || id);
}

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