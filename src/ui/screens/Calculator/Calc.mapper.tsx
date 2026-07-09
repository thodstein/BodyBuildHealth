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
      <div style={{ fontSize: 13, fontWeight: 800, color: '#00e68a', marginBottom: 8, letterSpacing: '-0.3px' }}>
        Фармакологическая поддержка
      </div>

      {/* Уровень: 3 кнопки-карточки */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
        {([
          ['base', 'База', '\u{1F7E2}'],
          ['medium', 'Средний', '\u{1F7E1}'],
          ['max', 'Максимум', '\u{1F534}'],
        ] as const).map(([lv, label, icon]) => {
          const active = level === lv;
          return (
            <button key={lv} onClick={() => setLevel(lv as SupportLevel)}
              style={{
                padding: '7px 4px', borderRadius: 10, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: active ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)',
                border: active ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
                color: active ? '#00e68a' : 'var(--text-dim)',
                transition: 'all 0.12s ease',
              }}>
              {icon} {label}
            </button>
          );
        })}
      </div>

      {/* STOP COURSE banner */}
      {rec && rec.stopCourse && (
        <div style={{ margin: '6px 0', padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', marginBottom: 4 }}>\u26D4 ОСТАНОВИТЬ КУРС AAS</div>
          {rec.alerts?.map((a, i) => (
            <div key={i} style={{ fontSize: 9, color: '#fca5a5', marginBottom: 2, lineHeight: 1.4 }}>{a.message}</div>
          ))}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Рекомендации — для специалиста. Не заменяют консультацию врача.</div>
        </div>
      )}

      {/* TIER alerts */}
      {rec && !rec.stopCourse && rec.alerts && rec.alerts.length > 0 && (
        <div style={{ margin: '6px 0', padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          {rec.alerts.map((a, i) => (
            <div key={i} style={{ fontSize: 9, color: '#fbbf24', marginBottom: 2, lineHeight: 1.4 }}>\u26A0 {a.message}</div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {rec && rec.pedFlags && (() => {
        const f = rec.pedFlags;
        const ws: string[] = [];
        if (f.isMultiOral) ws.push('\u26A0 Более 1 орального 17\u03B1 — резко \u2191 гепатотоксичность');
        if (f.isGHPlusInsulin) ws.push('\u26A0 GH + Инсулин — высокий риск гипогликемии');
        if (f.isWinnyPlusOxy) ws.push('\u26A0 Winstrol + Anadrol — крайне нежелательная комбинация');
        if (f.has17AlphaAndGH) ws.push('\u26A0 17\u03B1-Орал + GH — синергичная гепатотоксичность');
        if (!ws.length) return null;
        return (
          <div style={{ margin: '6px 0', padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 4 }}>Предупреждения о курсе</div>
            {ws.map((w, i) => <div key={i} style={{ fontSize: 9, color: '#c4b5fd', marginBottom: 2, lineHeight: 1.4 }}>{w}</div>)}
          </div>
        );
      })()}

      {/* Список препаратов */}
      {rec && rec.subs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            Назначено {rec.subs.length} препаратов
            {rec.titrationFactors && rec.titrationFactors.size > 0 && (
              <span style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b', padding: '1px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.15)' }}>
                \u2191{rec.titrationFactors.size} дозы скорректированы
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
            const expanded = expandedSub === s.substanceId;
            return (
              <div key={s.substanceId + i}>
                <div onClick={() => hasDetails && setExpandedSub(expanded ? null : s.substanceId)}
                  style={{ ...GLASS, padding: '6px 10px', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, borderLeft: isTitrated ? '3px solid #f59e0b' : undefined, cursor: hasDetails ? 'pointer' : 'default' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                    {isTitrated && <span style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b', marginLeft: 4, padding: '1px 4px', borderRadius: 4, background: 'rgba(245,158,11,0.15)' }}>\u2191{((titrFactor - 1) * 100).toFixed(0)}%</span>}
                    {hasDetails && <span style={{ fontSize: 7, color: 'var(--text-dim)', marginLeft: 4 }}>{expanded ? '\u25B2' : '\u25BC'}</span>}
                  </span>
                  {dose && (
                    <span style={{ fontSize: 8, color: isTitrated ? '#f59e0b' : '#00e68a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {titrFactor && titrFactor > 1 ? Math.round(dose.mg * titrFactor) : dose.mg} мг · {dose.timing}
                    </span>
                  )}
                </div>
                {expanded && hasDetails && (
                  <div style={{ ...GLASS, padding: '8px 10px', marginBottom: 3, fontSize: 8, lineHeight: 1.5, borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
                    {form && form.optimalForm && <div style={{ marginBottom: 3 }}><span style={{ fontWeight: 700, color: '#818cf8' }}>Форма: </span><span style={{ color: 'var(--text-light)' }}>{form.optimalForm}</span></div>}
                    {form && form.pharmacyBrands && form.pharmacyBrands.length > 0 && <div style={{ marginBottom: 3 }}><span style={{ fontWeight: 700, color: '#818cf8' }}>Аптечные: </span><span style={{ color: 'var(--text-light)' }}>{form.pharmacyBrands.join(', ')}</span></div>}
                    {form && form.altForm && <div style={{ marginBottom: 3 }}><span style={{ fontWeight: 700, color: '#f59e0b' }}>Замена: </span><span style={{ color: 'var(--text-light)' }}>{form.altForm}</span></div>}
                    {form && form.bioavailability && <div style={{ marginBottom: 3 }}><span style={{ fontWeight: 600, color: 'var(--text-dim)' }}>Биодоступ.: </span><span style={{ color: 'var(--text-light)' }}>{form.bioavailability}</span></div>}
                    {form && form.note && <div style={{ marginBottom: 3, color: 'var(--text-light)', opacity: 0.8 }}>{form.note}</div>}
                    {titr && (
                      <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                        <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>Титрация: {titr.startDose} \u2192 {titr.maxDose}</div>
                        {titr.steps.map((step, si) => (
                          <div key={si} style={{ fontSize: 7, color: 'var(--text-light)', marginBottom: 1 }}>
                            <b>{step.dose}</b> ({step.duration}){step.trigger ? ' — ' + step.trigger : ''}{step.labTarget ? ' [цель: ' + step.labTarget + ']' : ''}
                          </div>
                        ))}
                        {titr.flushWarning && <div style={{ fontSize: 7, color: '#fbbf24', marginTop: 2 }}>{titr.flushWarning}</div>}
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

      {/* Нутри-корректировки */}
      {rec && rec.nutritionTips && rec.nutritionTips.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a', marginBottom: 4 }}>Питание по анализам ({rec.nutritionTips.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {rec.nutritionTips.slice(0, 12).map((n, i) => (
              <div key={i} style={{ ...GLASS, padding: '4px 8px', fontSize: 8, color: 'var(--text-light)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{n.action}</span><br />
                <span style={{ opacity: 0.7 }}>{n.target}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Взаимодействия */}
      {rec && rec.subs.length > 1 && (() => {
        const ints = checkInteractions(rec.subs.map(s => s.substanceId));
        if (!ints.length) return null;
        const blocks = ints.filter(x => x.severity === 'block');
        return (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: blocks.length ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid ' + (blocks.length ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)') }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: blocks.length ? '#ef4444' : '#fbbf24', marginBottom: 4 }}>
              {blocks.length ? '\u26D4 Взаимодействия' : '\u26A0 Взаимодействия'} ({ints.length})
            </div>
            {ints.map((intr, i) => (
              <div key={i} style={{ fontSize: 8, color: intr.severity === 'block' ? '#fca5a5' : '#fbbf24', marginBottom: 2, lineHeight: 1.4 }}>
                [{intr.severity === 'block' ? '\u26D4' : '\u26A0'}] <b>{intr.a}</b> + <b>{intr.b}</b> — {intr.reason}
                <div style={{ fontSize: 7, opacity: 0.8 }}>{intr.action}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Противопоказания */}
      {rec && rec.contraindications && rec.contraindications.length > 0 && (() => {
        const abs = rec.contraindications.filter(cc => cc.severity === 'absolute');
        return (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: abs.length ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border: '1px solid ' + (abs.length ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)') }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: abs.length ? '#ef4444' : '#fbbf24', marginBottom: 4 }}>
              {abs.length ? '\u26D4 Противопоказания' : '\u26A0 Осторожность'} ({rec.contraindications.length})
            </div>
            {rec.contraindications.map((cc, i) => (
              <div key={i} style={{ fontSize: 8, color: cc.severity === 'absolute' ? '#fca5a5' : '#fbbf24', marginBottom: 2, lineHeight: 1.4 }}>
                [{cc.severity === 'absolute' ? '\u26D4' : '\u26A0'}] <b>{subNameRu(cc.substanceId)}</b> — {cc.message}
                <div style={{ fontSize: 7, opacity: 0.8 }}>{cc.action}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Усиление */}
      <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
        <button onClick={() => onOpenManualPicker?.()}
          style={{ flex: 1, padding: '8px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7' }}>
          \u{1F527} Усилить (суставы/связки)
        </button>
      </div>
    </div>
  );

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