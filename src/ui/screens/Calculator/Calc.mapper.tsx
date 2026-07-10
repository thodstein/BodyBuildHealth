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
import { CONTRAINDICATIONS, getContraindications, type ContraindicationRule } from '../../../data/substance-contraindications';
import { GLASS, BADGE } from './Calc.types';
import { CalcSubstanceDetail, buildStackSynergyDescription } from './CalcSubstanceDetail';
import { CalcPEDCard } from './CalcPEDCard';
import { CalcProfileCard } from './CalcProfileCard';
import { CalcLabsCard } from './CalcLabsCard';
import { ALL_STACKS } from '../../../data/support-stacks';
import { CalcSubstanceManager } from './CalcSubstanceManager';

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
  spironolactone: 'Спиронолактон', hydrochlorothiazide: 'Гидрохлоротиазид', indapamide: 'Индапамид', melatonin: 'Мелатонин', calcium: 'Кальций',
  metformin: 'Метформин', potassium: 'Калий', leucine: 'Лейцин',
  saw_palmetto: 'Saw Palmetto (Пальма сереноа)',
  alpha_lipoic: 'α-Липоевая', l_carnitine: 'L-Карнитин',
  d_mannose: 'Д-манноза',
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

function mechToOrganLabel(mechId: string): string {
  const organId = mechId.startsWith('cv') ? 'cardio'
    : mechId.startsWith('liv') ? 'hepatic'
    : mechId.startsWith('ren') ? 'renal'
    : mechId.startsWith('cns') ? 'cns'
    : mechId.startsWith('rep') ? 'reproductive'
    : 'hematologic';
  return organId;
}

const PANEL_KEYS = [
  'panelBiochem', 'panelSex', 'panelHematology', 'panelThyroid',
  'panelLipid', 'panelIron', 'panelVitamin', 'panelCardiac',
  'panelCoagulation', 'panelInflammatory', 'panelAdrenal',
  'panelMineral', 'panelTumor', 'panelUrinalysis',
] as const;

const MARKER_RENAME: Record<string, string> = {
  'Total T': 'TESTOSTERONE', 'Free T': 'FREE_TESTOSTERONE', 'E2': 'ESTRADIOL',
  'Bilirubin': 'BILIRUBIN', 'Uric acid': 'URIC_ACID', 'HCT': 'HEMATOCRIT',
  'Hemoglobin': 'HEMOGLOBIN', 'Total Cholesterol': 'TOTAL_CHOLESTEROL',
  'Triglycerides': 'TRIGLYCERIDES', 'T3 free': 'T3_FREE', 'T4 free': 'T4_FREE',
  'Anti-TPO': 'ANTI_TPO', 'Anti-TG': 'ANTI_TG', 'Vitamin D (25-OH)': 'VITAMIN_D',
  'Transferrin Sat': 'TRANSFERRIN_SAT', 'CK-MB': 'CK_MB', 'D-dimer': 'D_DIMER',
  'IL-6': 'IL_6', 'TNF-alpha': 'TNF_ALPHA', 'DHEA-S': 'DHEA_S', '3a-ADG': '3A_ADG',
  'PSA total': 'PSA_TOTAL', 'PSA free': 'PSA_FREE', 'CA-125': 'CA_125', 'Lp(a)': 'LP_A',
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
  const pedDoses = (state.pharma.aas || [])
    .filter((a: any) => a && a.id)
    .map((a: any) => ({
      id: (a.id as string).toLowerCase(),
      pClass: classifyPed(a.id),
      mgPerWeek: a.mgPerWeek ?? a.dosePerWeek ?? (a.dose ? Number(String(a.dose).replace(/\D/g,''))*7 : 500),
      form: (a.form === 'oral' ? 'oral' : 'inject') as 'oral' | 'inject',
    }));
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
    labs, phaseCtx, boosterCtx, level, manualChoices,
    onCourse: state.pharma.aas.length > 0 || pedDoses.length > 0,
    e2Level: labs['ESTRADIOL'], hemoglobin: labs['HEMOGLOBIN'], hematocrit: labs['HEMATOCRIT'],
    hasHCG: state.pharma.hasHCG, hasAI: state.pharma.hasAI,
    hasCabergoline: (state.pharma as any).hasCaber || false,
    aasIds: (state.pharma.aas || []).map((a: any) => a.id || '').filter(Boolean),
    pedDoses, libidoLow: false,
    bpSystolic: state.cardio.bpStage === 'high' ? 150 : state.cardio.bpStage === 'normal' ? 120 : 135,
    lipidLdl: labs['LDL'],
    symptoms: (state as any).symptoms || [],
    healthConditions: (state as any).healthConditions || [],
  };
}

// ── Анализ контекста для доп. модулей (суставы/нейро/усиление) ──────────────────
interface StackModuleAnalysis {
  subId: string;
  subName: string;
  dose: string;
  mechanism: string;
  inPlan: boolean;
  contextReason: string;
  recommended: boolean;
}

function analyzeStackModule(
  stackId: string,
  state: CalculatorState,
  rec: SupportRecommendation | null,
): { analysis: StackModuleAnalysis[]; contextSummary: string } {
  const stack = ALL_STACKS.find(s => s.id === stackId);
  if (!stack) return { analysis: [], contextSummary: '' };

  const planIds = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
  const symptoms = (state as any).symptoms || [];
  const labs = labSliceToValues(state.labs.fullPanel);
  const jointPain = state.oda.jointPain;
  const hasJointSymptom = symptoms.includes('joint_pain');
  const crp = labs['CRP'] || labs['HSCRP'];
  const hasNeuroSymptom = symptoms.includes('insomnia') || symptoms.includes('anxiety');
  const sleepHours = state.profile.sleepHours || 7;
  const stressLevel = state.profile.stressLevel || 5;
  const aggressionScore = state.neuro.aggressionScore || 0;
  const aasCount = state.pharma.aas.length;
  const pedCount = (state.pharma as any).ghIU ? 1 : 0 + (state.pharma as any).insulinIU ? 1 : 0 + aasCount;
  const hasOral17 = (state.pharma.aas || []).some((a: any) => a.form === 'oral');
  const altVal = labs['ALT'] || labs['AST'];
  const hctVal = labs['HEMATOCRIT'] || labs['HCT'];

  let contextSummary = '';
  if (stackId === 'articular_stack') {
    const triggers: string[] = [];
    if (hasJointSymptom) triggers.push('симптом: боль в суставах');
    if (jointPain === 'severe') triggers.push('сильная боль в суставах');
    if (jointPain === 'moderate') triggers.push('умеренная боль');
    if (crp && crp > 3) triggers.push(`CRP ↑ (${crp})`);
    contextSummary = triggers.length > 0
      ? 'Показания: ' + triggers.join(', ')
      : 'Профилактика суставов — нет активных показаний, но рекомендуется при интенсивных тренировках';
  } else if (stackId === 'neuroprotection_stack') {
    const triggers: string[] = [];
    if (symptoms.includes('insomnia')) triggers.push('бессонница');
    if (symptoms.includes('anxiety')) triggers.push('тревога');
    if (sleepHours < 7) triggers.push(`сон ${sleepHours}ч`);
    if (stressLevel > 7) triggers.push(`стресс ${stressLevel}/10`);
    if (aggressionScore > 6) triggers.push('раздражительность');
    contextSummary = triggers.length > 0
      ? 'Показания: ' + triggers.join(', ')
      : 'Профилактика ЦНС — нет активных показаний';
  } else if (stackId === 'mega_total_support_35') {
    const triggers: string[] = [];
    if (aasCount > 0) triggers.push(`${aasCount} ААС`);
    if (hasOral17) triggers.push('оральный 17α');
    if ((state.pharma as any).ghIU) triggers.push('GH');
    if ((state.pharma as any).insulinIU) triggers.push('инсулин');
    if (pedCount > 2) triggers.push('мульти-курс');
    const alt = altVal;
    if (alt && alt > 40) triggers.push(`АЛТ/АСТ ↑ (${alt})`);
    const hct = hctVal;
    if (hct && hct > 50) triggers.push(`HCT ↑ (${hct})`);
    contextSummary = triggers.length > 0
      ? 'Активные риски: ' + triggers.join(', ') + ' → максимальная защита показана'
      : 'Максимальная защита — для high-risk курсов (множество PED, оральные, лаб-отклонения)';
  }

  const analysis: StackModuleAnalysis[] = stack.substances.map(sub => {
    const inPlan = planIds.has(canonIdLocal(sub.id));
    let contextReason = '';
    let recommended = false;

    if (stackId === 'articular_stack') {
      if (sub.id === 'glucosamine') { contextReason = 'Субстрат ГАГ → синтез хряща'; recommended = hasJointSymptom || jointPain !== 'none'; }
      else if (sub.id === 'chondroitin') { contextReason = 'Защита хряща от деградации'; recommended = hasJointSymptom || jointPain !== 'none'; }
      else if (sub.id === 'collagen') { contextReason = 'Структурный белок хряща и связок'; recommended = true; }
      else if (sub.id === 'msm') { contextReason = 'Сера для коллагена, ↓боль'; recommended = crp != null && crp > 3; }
      else if (sub.id === 'vitamin_c') { contextReason = 'Кофактор синтеза коллагена'; recommended = true; }
      else contextReason = sub.mechanism;
    } else if (stackId === 'neuroprotection_stack') {
      if (sub.id === 'citicoline') { contextReason = 'Ацетилхолин + мембраны нейронов'; recommended = hasNeuroSymptom || aggressionScore > 6; }
      else if (sub.id === 'lions_mane') { contextReason = 'NGF — рост нейронов'; recommended = hasNeuroSymptom; }
      else if (sub.id === 'magnesium_l_threonate') { contextReason = 'Mg через ГЭБ — ↓NMDA, сон'; recommended = symptoms.includes('insomnia') || sleepHours < 7; }
      else if (sub.id === 'phosphatidylserine') { contextReason = '↓Кортизол — антистресс'; recommended = stressLevel > 7 || symptoms.includes('anxiety'); }
      else contextReason = sub.mechanism;
    } else if (stackId === 'mega_total_support_35') {
      contextReason = sub.mechanism.slice(0, 60);
      recommended = pedCount > 1 || hasOral17 || (altVal != null && altVal > 40) || (hctVal != null && hctVal > 50);
    } else {
      contextReason = sub.mechanism;
      recommended = true;
    }

    return {
      subId: sub.id,
      subName: subNameRu(sub.id),
      dose: sub.dose,
      mechanism: sub.mechanism,
      inPlan,
      contextReason,
      recommended,
    };
  });

  return { analysis, contextSummary };
}

export interface CalcMapperProps {
  state: CalculatorState;
  onStateChange?: (next: CalculatorState) => void;
  onApply?: (rec: SupportRecommendation) => void;
  onOpenManualPicker?: () => void;
  onOpenLabs?: () => void;
}

export const CalcMapperCard: React.FC<CalcMapperProps> = ({ state, onStateChange, onApply, onOpenManualPicker, onOpenLabs }) => {
  const [level, setLevel] = useState<SupportLevel>('medium');
  const [manualSubs, setManualSubs] = useState<string[]>([]);
  const [selectedStacks, setSelectedStacks] = useState<string[]>([]);
  const [showIntellPopup, setShowIntellPopup] = useState(false);
  const [showManualPopup, setShowManualPopup] = useState(false);
  const [manualSubInput, setManualSubInput] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [showPrescription, setShowPrescription] = useState(true);
  const [showSynergy, setShowSynergy] = useState(true);
  const [removedSubs, setRemovedSubs] = useState<string[]>([]);
  const [addedSubs, setAddedSubs] = useState<string[]>([]);
  const [substanceManagerKey, setSubstanceManagerKey] = useState(0);
  const [stackModulePopup, setStackModulePopup] = useState<string | null>(null);
  const [applyFlash, setApplyFlash] = useState(false);

  const ctx = useMemo(() => {
    const base = buildMapperCtx(state, level, level === 'manual' ? { addSubs: manualSubs } : undefined, selectedStacks);
    if (symptoms.length > 0) base.symptoms = symptoms;
    return base;
  }, [state, level, manualSubs, selectedStacks, symptoms]);

  const rec = useMemo(() => {
    try { return resolvePlan(ctx); }
    catch { return null; }
  }, [ctx]);

  const phaseInfo = rec ? PHASE_PROTOCOL[rec.phase] : null;

  // Применить корректировки: удалить/добавить вещества из финального списка
  const finalRec = useMemo(() => {
    if (!rec) return null;
    if (removedSubs.length === 0 && addedSubs.length === 0) return rec;
    const next = {
      ...rec,
      subs: [
        ...rec.subs.filter(s => !removedSubs.some(r => r.toLowerCase() === s.substanceId.toLowerCase())),
        ...addedSubs.map(id => ({
          substanceId: id, category: 'pharma' as any, k: 0.5, q: 'B' as const,
          reason: 'Добавлен вручную', mechsCovered: [], priority: 4 as const,
        })),
      ],
    };
    return next;
  }, [rec, removedSubs, addedSubs]);

  const synergyDesc = finalRec ? buildStackSynergyDescription(finalRec) : [];

  return (
    <div style={{ ...GLASS, padding: 10, marginBottom: 8, border: '2px solid rgba(0,230,138,0.2)' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>
        🧬 Механизм-ориентированная модель (ТЗ-28)
      </div>

      {/* ===== ВЫБОР РЕЖИМА (2 кнопки рядом) ===== */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
        <div onClick={() => setShowIntellPopup(true)} style={{ borderRadius:14, background:'linear-gradient(135deg,rgba(0,230,138,0.06),rgba(0,200,83,0.03))', border:'1.5px solid rgba(0,230,138,0.15)', padding:'12px 12px 10px', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:16 }}>🧠</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#00e68a' }}>Интеллектуальная</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                {level === 'base' && '🟢 База'}{level === 'medium' && '🟡 Средний'}{level === 'max' && '🔴 Максимум'}{level === 'manual' && '⚙️ Вручную'}
              </div>
            </div>
            <span style={{ fontSize:10, color:'#00e68a' }}>›</span>
          </div>
        </div>
        <div onClick={() => { if (onOpenManualPicker) onOpenManualPicker(); }} style={{ borderRadius:14, background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(59,130,246,0.03))', border:'1.5px solid rgba(99,102,241,0.15)', padding:'12px 12px 10px', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:16 }}>⚙️</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#818cf8' }}>Ручной режим</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                {manualSubs.length > 0 || selectedStacks.length > 0 ? `${selectedStacks.length} стек · ${manualSubs.length} пр.` : 'Каталог / стек / избранное'}
              </div>
            </div>
            <span style={{ fontSize:10, color:'#818cf8' }}>›</span>
          </div>
        </div>
      </div>

      {/* ── Попап интеллектуального выбора ── */}
      {showIntellPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowIntellPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:320, borderRadius:18, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
            <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding:'16px 14px 12px' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#00e68a', marginBottom:10 }}>🧠 Интеллектуальная поддержка</div>
              {([
                ['base','База','🟢','Только core: NAC, омега-3, Mg, D3. Бюджет'],
                ['medium','Средний','🟡','Core + standard. Оптимальный баланс'],
                ['max','Максимум','🔴','Все активные механизмы + advanced. Полная защита'],
              ] as const).map(([lv, label, icon, desc]) => (
                <div key={lv} onClick={() => { setLevel(lv as SupportLevel); setShowIntellPopup(false); }} style={{
                  padding:'10px 12px', borderRadius:10, marginBottom:5, cursor:'pointer',
                  background: level === lv ? 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,200,83,0.06))' : 'rgba(255,255,255,0.03)',
                  border: level === lv ? '1.5px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>{icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontWeight:700, color: level === lv ? '#00e68a' : 'var(--text)' }}>{label} {level === lv && '✓'}</div>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Попап ручного режима ── */}
      {showManualPopup && (
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowManualPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:340, borderRadius:18, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
            <div style={{ height:3, background:'linear-gradient(90deg,#818cf8,#6366f1)' }} />
            <div style={{ padding:'16px 14px 12px', overflowY:'auto' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#818cf8', marginBottom:10 }}>⚙️ Ручной режим</div>
              {onOpenManualPicker && (
                <button onClick={() => { setShowManualPopup(false); setTimeout(onOpenManualPicker, 200); }} style={{ width:'100%', marginBottom:8, padding:'8px', borderRadius:8, background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.25)', color:'#a78bfa', fontWeight:700, fontSize:10, cursor:'pointer' }}>
                  📂 Выбрать из каталога / стеков / избранного
                </button>
              )}
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text)', marginBottom:4 }}>📦 Добавить стек</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:10 }}>
                {STACK_BOOSTER_TRIGGERS.slice(0,14).map(st => {
                  const active = selectedStacks.includes(st.stackId);
                  return (
                    <button key={st.stackId} onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== st.stackId) : [...prev, st.stackId])}
                      style={{ padding:'5px 8px', borderRadius:8, fontSize:7, fontWeight:600, cursor:'pointer',
                        background: active ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
                        border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        color: active ? '#c084fc' : 'rgba(255,255,255,0.5)' }}>
                      {st.stackId.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')} {active && '✓'}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text)', marginBottom:4 }}>💊 Добавить препарат (ID)</div>
              <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                <input value={manualSubInput} onChange={e => setManualSubInput(e.target.value)} placeholder="NAC, TUDCA, omega3..."
                  style={{ flex:1, padding:'6px 8px', borderRadius:8, fontSize:9, background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', outline:'none' }} />
                <button onClick={() => { if(!manualSubInput.trim())return; const ids=manualSubInput.split(',').map(s=>s.trim()).filter(Boolean); setManualSubs(prev=>[...new Set([...prev,...ids])]); setManualSubInput(''); }} style={{ padding:'6px 10px', borderRadius:8, fontSize:9, fontWeight:700, cursor:'pointer', background:'#818cf8', border:'none', color:'#000' }}>+</button>
              </div>
              {manualSubs.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  {manualSubs.map((sid, i) => (
                    <span key={sid+i} style={{ fontSize:8, padding:'2px 6px', borderRadius:6, fontWeight:600, background:'rgba(99,102,241,0.12)', color:'#818cf8', display:'inline-flex', alignItems:'center', gap:3, margin:1 }}>
                      {sid}
                      <span onClick={() => setManualSubs(prev => prev.filter((_, j) => j !== i))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.3)', fontSize:9 }}>✕</span>
                    </span>
                  ))}
                </div>
              )}
              <button onClick={() => { setLevel('manual'); setShowManualPopup(false); }} style={{ width:'100%', padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#818cf8,#6366f1)', border:'none', color:'#000', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                ✅ Применить ручной выбор
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ДОПОЛНИТЕЛЬНЫЕ МОДУЛИ (анализ контекста → popup) ===== */}
      {level !== 'manual' && (
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:12, background:'rgba(24,24,27,0.3)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.3px' }}>Доп. модули (анализ контекста)</div>
          <div style={{ display:'flex', gap:4 }}>
            {([
              ['articular_stack', '🦴', 'Суставы/Связки', '#4ade80'],
              ['neuroprotection_stack', '🧠', 'Нейропротекция', '#818cf8'],
              ['mega_total_support_35', '🚀', 'Усиление', '#f87171'],
            ] as const).map(([id, icon, label, col]) => {
              const active = selectedStacks.includes(id);
              return (
                <button key={id} onClick={() => setStackModulePopup(id)}
                  style={{ flex:1, padding:'7px 4px', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                    background: active ? `linear-gradient(135deg,rgba(${col === '#4ade80' ? '34,197,94' : col === '#818cf8' ? '99,102,241' : '239,68,68'},0.2),rgba(${col === '#4ade80' ? '34,197,94' : col === '#818cf8' ? '99,102,241' : '239,68,68'},0.1))` : 'rgba(255,255,255,0.03)',
                    border: active ? `1.5px solid ${col}55` : '1px solid rgba(255,255,255,0.06)',
                    color: active ? col : 'rgba(255,255,255,0.5)' }}>
                  <span style={{fontSize:13}}>{icon}</span>
                  <span>{label}</span>
                  {active && <span style={{fontSize:6,fontWeight:700,color:col,marginTop:1}}>✓ доб.</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Попап анализа доп. модуля ── */}
      {stackModulePopup && (() => {
        const { analysis, contextSummary } = analyzeStackModule(stackModulePopup, state, rec);
        const stackMeta = ALL_STACKS.find(s => s.id === stackModulePopup);
        const iconAndColor: Record<string, { icon: string; col: string }> = {
          articular_stack: { icon: '🦴', col: '#4ade80' },
          neuroprotection_stack: { icon: '🧠', col: '#818cf8' },
          mega_total_support_35: { icon: '🚀', col: '#f87171' },
        };
        const meta = iconAndColor[stackModulePopup] || { icon: '📦', col: '#818cf8' };
        const alreadyActive = selectedStacks.includes(stackModulePopup);
        const recommendedCount = analysis.filter(a => a.recommended && !a.inPlan).length;
        return (
          <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setStackModulePopup(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:360, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
              <div style={{ height:3, background:`linear-gradient(90deg,${meta.col},${meta.col}88)` }} />
              <div style={{ padding:'16px 14px 12px', overflowY:'auto' }}>
                <div style={{ fontSize:13, fontWeight:800, color:meta.col, marginBottom:6 }}>{meta.icon} {stackMeta?.name || stackModulePopup}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', lineHeight:1.5, marginBottom:8 }}>{stackMeta?.problem || ''}</div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text)', marginBottom:4 }}>📊 Анализ контекста</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.5, marginBottom:10, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  {contextSummary || 'Нет активных показаний'}
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--text)', marginBottom:6 }}>💊 Вещества в модуле ({analysis.length})</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
                  {analysis.map((a, i) => (
                    <div key={i} style={{ padding:'6px 8px', borderRadius:8, fontSize:8, background: a.inPlan ? 'rgba(0,230,138,0.06)' : a.recommended ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', border:`1px solid ${a.inPlan ? 'rgba(0,230,138,0.15)' : a.recommended ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                        <span style={{ fontWeight:700, color:'var(--text)' }}>{a.subName} <span style={{ color:'rgba(255,255,255,0.4)', fontWeight:500 }}>{a.dose}</span></span>
                        <div style={{ display:'flex', gap:3 }}>
                          {a.inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>в плане</span>}
                          {a.recommended && !a.inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', fontWeight:700 }}>рекоменд.</span>}
                          {!a.recommended && !a.inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)', fontWeight:700 }}>опц.</span>}
                        </div>
                      </div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>{a.contextReason}</div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:2 }}>{a.mechanism.slice(0, 80)}{a.mechanism.length > 80 ? '…' : ''}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => setStackModulePopup(null)} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text)' }}>Отмена</button>
                  <button onClick={() => {
                    if (!alreadyActive) setSelectedStacks(prev => [...prev, stackModulePopup]);
                    setStackModulePopup(null);
                  }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', background: alreadyActive ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${meta.col},${meta.col}cc)`, border:'none', color: alreadyActive ? 'var(--text-dim)' : '#000' }}>
                    {alreadyActive ? '✓ Уже добавлен' : `Добавить модуль (${recommendedCount} рек.)`}
                  </button>
                </div>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginTop:6, textAlign:'center' }}>Модуль добавляется поверх пресета. Дубли с планом автоматически исключаются.</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== КАРТОЧКА СИМПТОМОВ ===== */}
      <div style={{ margin:'6px 0', padding:'7px 9px', borderRadius:10, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)' }}>
        <div style={{ fontSize:9, fontWeight:700, color:'#818cf8', marginBottom:4 }}>🩺 Симптомы (отметьте актуальные)</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
          {([
            ['gynecomastia','Гино'],['edema_severe','Отёки'],['joint_pain','Суставы'],
            ['insomnia','Бессонница'],['anxiety','Тревога'],['low_libido','Либидо↓'],
            ['hair_loss','Выпадение волос'],['prostate_symptoms','Простата'],
          ] as const).map(([sym, label]) => {
            const active = symptoms.includes(sym);
            return (
              <button key={sym} onClick={() => setSymptoms(prev => active ? prev.filter(s => s !== sym) : [...prev, sym])}
                style={{ padding:'3px 7px', borderRadius:6, fontSize:8, fontWeight:600, cursor:'pointer', border:`1px solid ${active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`, background: active ? 'rgba(99,102,241,0.15)' : 'transparent', color: active ? '#a5b4fc' : 'var(--text-dim)' }}>
                {active ? '✓' : ''} {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== ФАЗА КУРСА (компактно) ===== */}
      {phaseInfo && (
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:12, background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))', border:'1px solid rgba(139,92,246,0.2)' }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#818cf8', marginBottom:2 }}>📋 Фаза: {phaseInfo.label}</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:5 }}>{phaseInfo.algorithm}</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:7, padding:'2px 6px', borderRadius:5, background:'rgba(99,102,241,0.12)', color:'#818cf8', fontWeight:600 }}>Мех: {phaseInfo.coreMechs.slice(0,3).join(', ')}</span>
            <span style={{ fontSize:7, padding:'2px 6px', borderRadius:5, background:'rgba(34,197,94,0.12)', color:'#22c55e', fontWeight:600 }}>Буст: {phaseInfo.allowBoosters ? 'да' : 'нет'}</span>
            <span style={{ fontSize:7, padding:'2px 6px', borderRadius:5, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontWeight:600 }}>Доза: ×{phaseInfo.doseTier}</span>
          </div>
        </div>
      )}

      {/* Summary */}
      {rec && (
        <div style={{ fontSize:8, fontWeight:500, color:'var(--text-dim)', marginBottom:6, lineHeight:1.4 }}>
          {rec.summary}
        </div>
      )}

      {/* STOP COURSE banner (TIER 3) */}
      {rec && rec.stopCourse && (
        <div style={{ margin:'5px 0', padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.12)', border:'1.5px solid rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#ef4444', marginBottom:3 }}>⛔ ОСТАНОВИТЬ КУРС</div>
          {rec.alerts?.map((a, i) => <div key={i} style={{ fontSize:8, color:'#fca5a5', marginBottom:1, lineHeight:1.4 }}>{a.message}</div>)}
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', marginTop:3 }}>Рекомендации — для специалиста. Не заменяют консультацию врача.</div>
        </div>
      )}

      {/* TIER alerts (без stopCourse) */}
      {rec && !rec.stopCourse && rec.alerts && rec.alerts.length > 0 && (
        <div style={{ margin:'5px 0', padding:'7px 9px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)' }}>
          {rec.alerts.map((a, i) => <div key={i} style={{ fontSize:8, color:'#fbbf24', marginBottom:1, lineHeight:1.4 }}>⚠ {a.message}</div>)}
        </div>
      )}

      {/* ===== НАЗНАЧЕНИЕ (результат) ===== */}
      {finalRec && finalRec.subs.length > 0 && (
        <div>
          <div onClick={() => setShowPrescription(!showPrescription)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--text)', display:'flex', alignItems:'center', gap:4 }}>
              💊 Назначено {finalRec.subs.length} препаратов
              {finalRec.titrationFactors && finalRec.titrationFactors.size > 0 && (
                <span style={{ fontSize:8, fontWeight:600, color:'#f59e0b', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.15)' }}>↑{finalRec.titrationFactors.size}</span>
              )}
            </span>
            <span style={{ fontSize:8, color:'var(--text-dim)' }}>{showPrescription ? '▲ скрыть' : '▼ показать'}</span>
          </div>

          {showPrescription && (
            <>
              {/* Краткий список препаратов (compact summary) */}
              <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:8, background:'rgba(24,24,27,0.3)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.3px' }}>Список ({finalRec.subs.length})</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                  {finalRec.subs.map((s, i) => {
                    const doseInfo = subDosage(s.substanceId);
                    const titrF = finalRec.titrationFactors?.get(canonIdLocal(s.substanceId));
                    const mg = doseInfo ? (titrF && titrF > 1 ? Math.round(doseInfo.mg * titrF) : doseInfo.mg) : null;
                    const isTitr = !!titrF && titrF > 1;
                    return (
                      <span key={i} style={{
                        fontSize:7, padding:'2px 6px', borderRadius:5, fontWeight:600,
                        background: isTitr ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.08)',
                        border: isTitr ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(99,102,241,0.12)',
                        color: isTitr ? '#fbbf24' : '#a5b4fc',
                      }}>
                        {subNameRu(s.substanceId)}{mg ? ` ${mg}мг` : ''}
                        {isTitr && ` ↑${((titrF! - 1) * 100).toFixed(0)}%`}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* ══ МЕНЕДЖЕР ПРЕПАРАТОВ (добавить/удалить/заменить) ══ */}
              <CalcSubstanceManager
                key={substanceManagerKey}
                finalRec={finalRec}
                onApplyChanges={(newSubs) => {
                  // синхронизируем с состоянием добавления/удаления
                  const current = finalRec.subs.map(s => s.substanceId);
                  const toRemove = current.filter(id => !newSubs.includes(id));
                  const toAdd = newSubs.filter(id => !current.includes(id));
                  setRemovedSubs(toRemove);
                  setAddedSubs(toAdd);
                  setSubstanceManagerKey(prev => prev + 1);
                }}
              />

              {/* Детальные карточки веществ */}
              {finalRec.subs.map((s, i) => (
                <CalcSubstanceDetail
                  key={s.substanceId + i}
                  sub={s}
                  rec={finalRec}
                  subNameRu={subNameRu}
                  subDosage={subDosage}
                  subTier={subTier}
                  titrationFactors={finalRec.titrationFactors}
                  canonIdLocal={canonIdLocal}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ===== СИНЕРГИЯ СТЕКА ===== */}
      {finalRec && synergyDesc.length > 0 && (
        <div style={{ marginTop:8 }}>
          <div onClick={() => setShowSynergy(!showSynergy)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#a78bfa' }}>🧬 Синергия стека поддержки</span>
            <span style={{ fontSize:7, color:'var(--text-dim)' }}>{showSynergy ? '▲' : '▼'}</span>
          </div>
          {showSynergy && (
            <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.12)' }}>
              {synergyDesc.map((s, i) => <div key={i} style={{ fontSize:8, color:'#c4b5fd', marginBottom:3, lineHeight:1.5 }}>{s}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Нутри-корректировки по анализам */}
      {finalRec && finalRec.nutritionTips && finalRec.nutritionTips.length > 0 && (
        <div style={{marginTop:6}}>
          <div style={{ fontSize:9, fontWeight:700, color:'#00e68a', marginBottom:3 }}>🥗 Питание по анализам ({finalRec.nutritionTips.length})</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
            {finalRec.nutritionTips.slice(0, 12).map((n, i) => (
              <div key={i} style={{ ...GLASS, padding:'3px 6px', fontSize:7, color:'var(--text-light)' }}>
                <span style={{ fontWeight:600, color:'var(--text)' }}>{n.action}</span><br />
                <span style={{ opacity:0.7 }}>{n.target}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings: multi-oral, GH+insulin, winny+oxy */}
      {finalRec && (() => {
        const warnings: string[] = [];
        const flags = finalRec.pedFlags;
        if (flags) {
          if (flags.isMultiOral) warnings.push('⚠ Более 1 орального 17α — резко ↑ гепатотоксичность');
          if (flags.isGHPlusInsulin) warnings.push('⚠ GH + Инсулин — высокий риск гипогликемии');
          if (flags.isWinnyPlusOxy) warnings.push('⚠ Winstrol + Anadrol — нежелательная комбинация');
          if (flags.has17AlphaAndGH) warnings.push('⚠ 17α-Орал + GH — синергичная гепатотоксичность');
        }
        if (warnings.length === 0) return null;
        return (
          <div style={{ marginTop:6, padding:'6px 9px', borderRadius:8, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.2)' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#a855f7', marginBottom:3 }}>Предупреждения о курсе</div>
            {warnings.map((w, i) => <div key={i} style={{ fontSize:8, color:'#c4b5fd', marginBottom:1, lineHeight:1.4 }}>{w}</div>)}
          </div>
        );
      })()}

      {/* Взаимодействия */}
      {finalRec && finalRec.subs.length > 1 && (() => {
        const interactions = checkInteractions(finalRec.subs.map(s => s.substanceId));
        if (interactions.length === 0) return null;
        const blocks = interactions.filter(i => i.severity === 'block');
        return (
          <div style={{ marginTop:6, padding:'6px 9px', borderRadius:8, background: blocks.length ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border:'1px solid ' + (blocks.length ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)') }}>
            <div style={{ fontSize:9, fontWeight:700, color: blocks.length ? '#ef4444' : '#fbbf24', marginBottom:3 }}>
              {blocks.length ? '⛔ Взаимодействия (критичные)' : '⚠ Взаимодействия'} ({interactions.length})
            </div>
            {interactions.map((intr, i) => (
              <div key={i} style={{ fontSize:7, color: intr.severity === 'block' ? '#fca5a5' : '#fbbf24', marginBottom:1, lineHeight:1.4 }}>
                [{intr.severity === 'block' ? '⛔' : '⚠'}] <b>{intr.a}</b> + <b>{intr.b}</b> — {intr.reason}
                <div style={{ fontSize:6, opacity:0.8 }}>{intr.action}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Противопоказания — все (каталог + правила + условия) */}
      {finalRec && finalRec.subs.length > 0 && (() => {
        interface FlatContra { substanceId: string; label: string; severity: 'absolute' | 'relative'; source: 'catalog' | 'rule' | 'condition'; }
        const flat: FlatContra[] = [];

        // 1) из checkContraindications (по healthConditions)
        if (finalRec.contraindications) {
          for (const c of finalRec.contraindications) {
            flat.push({ substanceId: c.substanceId, label: c.message, severity: c.severity, source: 'condition' });
          }
        }

        // 2) из SUPPORT_CATALOG_DATA.contraindications
        for (const s of finalRec.subs) {
          const e = SUPPORT_CATALOG_DATA[s.substanceId] || SUPPORT_CATALOG_DATA[s.substanceId.toLowerCase()] || SUPPORT_CATALOG_DATA[s.substanceId.toUpperCase()];
          if (e?.contraindications?.length) {
            for (const c of e.contraindications) {
              const catKey = s.substanceId.toLowerCase();
              // общие строки типа "Индивидуальная непереносимость" / "Беременность" — не дублируем, выводим
              flat.push({ substanceId: s.substanceId, label: c, severity: 'relative', source: 'catalog' });
            }
          }
        }

        // 3) из CONTRAINDICATIONS general rules (absolute + relative)
        for (const s of finalRec.subs) {
          const rule = getContraindications(s.substanceId);
          if (!rule) continue;
          for (const abs of rule.absolute) {
            flat.push({ substanceId: s.substanceId, label: abs, severity: 'absolute', source: 'rule' });
          }
          for (const rel of rule.relative) {
            flat.push({ substanceId: s.substanceId, label: rel, severity: 'relative', source: 'rule' });
          }
        }

        if (flat.length === 0) return null;

        // дедупликация по substanceId + label
        const deduped: FlatContra[] = [];
        const seen = new Set<string>();
        for (const f of flat) {
          const key = f.substanceId.toLowerCase() + '::' + f.label;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(f);
        }

        // группировка по веществу
        const grouped: Record<string, { abs: FlatContra[]; rel: FlatContra[] }> = {};
        for (const f of deduped) {
          const id = f.substanceId.toLowerCase();
          if (!grouped[id]) grouped[id] = { abs: [], rel: [] };
          if (f.severity === 'absolute') grouped[id].abs.push(f);
          else grouped[id].rel.push(f);
        }

        const hasAbs = deduped.some(f => f.severity === 'absolute');
        const total = deduped.length;

        return (
          <div style={{ marginTop:6, padding:'6px 9px', borderRadius:8, background: hasAbs ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border:'1px solid ' + (hasAbs ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)') }}>
            <div style={{ fontSize:9, fontWeight:700, color: hasAbs ? '#ef4444' : '#fbbf24', marginBottom:3 }}>
              {hasAbs ? '⛔ Противопоказания' : '⚠ Осторожности'} ({total})
            </div>
            {Object.entries(grouped).map(([id, g]) => {
              const all = [...g.abs, ...g.rel];
              return (
                <div key={id} style={{ marginBottom: all.length > 0 ? 4 : 0 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'var(--text)', marginBottom:2, marginTop:1 }}>{subNameRu(id)}</div>
                  {g.abs.map((f, i) => (
                    <div key={i} style={{ fontSize:7, color:'#fca5a5', marginBottom:1, lineHeight:1.4, marginLeft:6 }}>
                      ⛔ {f.label}
                    </div>
                  ))}
                  {g.rel.map((f, i) => (
                    <div key={i} style={{ fontSize:7, color:'#fbbf24', marginBottom:1, lineHeight:1.4, marginLeft:6 }}>
                      ⚠ {f.label}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ===== КНОПКА «ПРИМЕНИТЬ ПЛАН» ===== */}
      {finalRec && finalRec.subs.length > 0 && onApply && (
        <button onClick={() => { onApply(finalRec); setApplyFlash(true); setTimeout(() => setApplyFlash(false), 1800); }} style={{
          width:'100%', marginTop:10, padding:'12px', borderRadius:12, fontSize:11, fontWeight:800, cursor:'pointer',
          background: applyFlash ? 'rgba(0,230,138,0.2)' : 'linear-gradient(135deg,#00e68a,#00c853)',
          border: applyFlash ? '1.5px solid rgba(0,230,138,0.5)' : 'none',
          color: applyFlash ? '#00e68a' : '#000',
          boxShadow: applyFlash ? 'none' : '0 4px 20px rgba(0,230,138,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <span style={{fontSize:14}}>{applyFlash ? '✓' : '✅'}</span>
          <span>{applyFlash ? 'Готово' : `Применить план поддержки (${finalRec.subs.length} препаратов)`}</span>
        </button>
      )}

      {/* CalcActions (сохранить/копировать/врачу) */}
      {finalRec && <CalcActions rec={finalRec} level={level} state={state} />}
    </div>
  );
};

function canonIdLocal(id: string): string {
  const map: Record<string, string> = {
    telmi: 'telmisartan', tmg: 'betaine', pharma_anastrozole: 'anastrozole',
    pharma_cabergoline: 'cabergoline', nac_sup: 'nac', silymarin: 'milk_thistle',
    coq10: 'coq10', '5_mthf': 'folate', l_carnitine: 'l_carnitine',
    agmatine_sulfate: 'agmatine',
  };
  return map[id?.toLowerCase()] || map[id] || (id?.toLowerCase() || id);
}

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
      arr.push({ id, type: 'calc', timestamp: Date.now(), supportLevel: rec.level, subs: rec.subs.map(s => s.substanceId), tzRec: rec });
      localStorage.setItem(key, JSON.stringify(arr));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) { console.error('saveToFavorites failed', e); }
  }, [rec]);

  const copyPlan = useCallback(async () => {
    const text = buildPlanText(rec);
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {} document.body.removeChild(ta);
    }
    setCopiedFlash(true); setTimeout(() => setCopiedFlash(false), 1800);
  }, [rec]);

  const copyDoctor = useCallback(async () => {
    const text = buildDoctorReport(rec, state);
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {} document.body.removeChild(ta);
    }
    setDoctorFlash(true); setTimeout(() => setDoctorFlash(false), 1800);
  }, [rec, state]);

  const btn = (label: string, onClick: () => void, flash: boolean, col: string, icon: string) => (
    <button onClick={onClick} style={{
      flex:1, padding:'6px 5px', borderRadius:8, fontSize:8, fontWeight:700, cursor:'pointer',
      background: flash ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.04)',
      border: flash ? '1px solid rgba(0,230,138,0.4)' : `1px solid ${col}`, color: flash ? '#00e68a' : col, minWidth:0,
    }}>
      {flash ? '✓' : icon} {flash ? 'Готово' : label}
    </button>
  );

  return (
    <div style={{ display:'flex', gap:3, marginTop:6 }}>
      {btn('Сохранить', saveToFavorites, savedFlash, 'rgba(99,102,241,0.4)', '💾')}
      {btn('Копировать', copyPlan, copiedFlash, 'rgba(96,165,250,0.4)', '📋')}
      {btn('Врачу', copyDoctor, doctorFlash, 'rgba(168,85,247,0.4)', '📄')}
    </div>
  );
};

export default CalcMapperCard;