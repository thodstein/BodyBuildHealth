import React, { useMemo, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type { LabSlice } from '../../../engines/support-plan';
import type { CalculatorState } from '../../../engines/support-plan';
import { resolvePlan } from '../../../engines/tz-mapper-engine';
import type { MapperCtx, SupportRecommendation } from '../../../engines/tz-mapper-engine';
import type { SupportLevel } from '../../../engines/tz-bridge-mechanism';
import type { PhaseContext, PhaseKey } from '../../../engines/tz-bridge-phase';
import type { BoosterTriggerCtx } from '../../../engines/tz-bridge-boosters';
import { PHASE_PROTOCOL } from '../../../engines/tz-bridge-phase';
import { STACK_BOOSTER_TRIGGERS, buildGapFillSuggestions, megaEnhance, type MegaEnhanceSuggestion } from '../../../engines/tz-bridge-boosters';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';
import { CalcSafetyLayer } from './CalcSafetyLayer';
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
import { MECH_TRANSLATIONS_RU, MECH_LABELS } from '../SupportScreen_parts/SupportScreenData';
import { CalcSubstanceManager } from './CalcSubstanceManager';
import { checkStackToxicity, type ToxWarning } from '../../../engines/biostack-safety.engine';
import { calculateReboundTrajectory, getReboundSummary, type ReboundInput } from '../../../engines/rebound-modeling.engine';

// ── Конфигурация суставного модуля ──────────────────────────────────────────
interface JointPreset {
  id: string; name: string; desc: string; color: string;
  subs: string[]; icon: string;
}
const JOINT_PRESETS: JointPreset[] = [
  { id:'core', name:'Ядро', desc:'Профилактика (база)', color:'#22c55e', icon:'🟢',
    subs:['collagen_uc2','vitamin_c','vitamin_d3','vitamin_k2','collagen'] },
  { id:'base', name:'База', desc:'Умеренный риск', color:'#f59e0b', icon:'🟡',
    subs:['glucosamine','chondroitin','msm','curcumin','manganese'] },
  { id:'enhanced', name:'Усиление', desc:'Высокий риск', color:'#f97316', icon:'🟠',
    subs:['hyaluronic_acid','curcumin','boswellia','silicon'] },
  { id:'max', name:'Максимум', desc:'Критический риск', color:'#ef4444', icon:'🔴',
    subs:['bpc','tb500','calcium','boron'] },
];
const JOINT_CATALOG: { id: string; nameRu: string; dose: string; desc: string }[] = [
  { id: 'glucosamine', nameRu: 'Глюкозамин сульфат', dose: '1500 мг', desc: 'Субстрат ГАГ, ↑ синтез протеогликанов хряща' },
  { id: 'chondroitin', nameRu: 'Хондроитин сульфат', dose: '800 мг', desc: '↓ коллагеназу, ↓ IL-1β, ↑ гиалуроновую к-ту' },
  { id: 'collagen', nameRu: 'Коллаген гидролизат', dose: '10 г', desc: 'Субстрат Gly-Pro-Hyp для коллагена I/II типа' },
  { id: 'collagen_uc2', nameRu: 'Коллаген UC-II (неденатурир.)', dose: '40 мг', desc: 'Оральная толерантность, ↓ атаку на коллаген сустава' },
  { id: 'msm', nameRu: 'MSM (Метилсульфонилметан)', dose: '2000 мг', desc: 'Донатор серы, ↓ NF-κB, ↓ боль на 25-40%' },
  { id: 'vitamin_c', nameRu: 'Витамин C', dose: '1000 мг', desc: 'Кофактор пролил/лизил-гидроксилаз → тройная спираль' },
  { id: 'vitamin_d3', nameRu: 'Витамин D3', dose: '5000 МЕ', desc: 'VDR-активация, Ca²⁺ гомеостаз, минерализация' },
  { id: 'vitamin_k2', nameRu: 'Витамин K2', dose: '100 мкг', desc: 'Активация остеокальцина → Ca²⁺ в кости' },
  { id: 'omega3', nameRu: 'Омега-3 (очищенный ЭПК)', dose: '2-3 г', desc: 'Резолвины/протектины, ↓ воспаления в синовии (адъювант, слабее куркумина/босвеллии при ОА)' },
  { id: 'manganese', nameRu: 'Марганец', dose: '5-10 мг', desc: 'Кофактор гликозилтрансфераз → синтез ГАГ' },
  { id: 'hyaluronic_acid', nameRu: 'Гиалуроновая кислота', dose: '200 мг', desc: 'Синовиальная жидкость, вязкоэластичность' },
  { id: 'curcumin', nameRu: 'Куркумин + пиперин', dose: '500 мг', desc: '↓ COX-2, ↓ NF-κB, ↓ IL-1β' },
  { id: 'boswellia', nameRu: 'Босвеллия (AKBA ≥30%)', dose: '300 мг', desc: '↓ 5-LOX, ↓ лейкотриены, ↓ боль при ОА' },
  { id: 'silicon', nameRu: 'Кремний (монометанол-силанол)', dose: '10-20 мг', desc: 'Сшивка коллагена и эластина, стабилизация ГАГ' },
  { id: 'bpc', nameRu: 'BPC-157 (пентадекапептид)', dose: '250-500 мкг', desc: '↑ VEGF → ангиогенез, заживление связок/сухожилий' },
  { id: 'tb500', nameRu: 'TB-500 (Thymosin β4)', dose: '2.5-5 мг', desc: 'Полимеризация G-актина, ↑ миграцию клеток' },
  { id: 'calcium', nameRu: 'Кальций', dose: '500 мг', desc: 'Минерализация костной ткани' },
  { id: 'boron', nameRu: 'Бор', dose: '3 мг', desc: '↑ t½ вит. D и E₂, ↓ боль в суставах' },
];
const JOINT_RECOMMENDED_HIGH: Set<string> = new Set(['glucosamine','chondroitin','collagen','vitamin_c','msm']);
const JOINT_RECOMMENDED_MEDIUM: Set<string> = new Set(['omega3','hyaluronic_acid','curcumin','boswellia']);

// ── Конфигурация нейропротекторного модуля ──────────────────────────────────
interface NeuroPreset {
  id: string; name: string; desc: string; color: string;
  subs: string[]; icon: string;
}
const NEURO_PRESETS: NeuroPreset[] = [
  { id:'sleep', name:'Сон', desc:'Восстановление сна', color:'#22c55e', icon:'🟢',
    subs:['magnesium_l_threonate','melatonin','theanine','glycine','gaba'] },
  { id:'stress', name:'Стресс', desc:'Антикортизол + адаптация', color:'#f59e0b', icon:'🟡',
    subs:['phosphatidylserine','ashwagandha','rhodiola','bacopa'] },
  { id:'cognitive', name:'Когнитив', desc:'Память, фокус, холин', color:'#f97316', icon:'🟠',
    subs:['citicoline','alpha_gpc','acetyl_l_carnitine','uridine_monophosphate'] },
  { id:'neurogenesis', name:'Нейрогенез', desc:'Рост новых нейронов', color:'#ef4444', icon:'🔴',
    subs:['lions_mane','theanine','curcumin','vitamin_d3','omega3'] },
];
const NEURO_CATALOG: { id: string; nameRu: string; dose: string; desc: string }[] = [
  { id: 'magnesium_l_threonate', nameRu: 'Магний L-треонат (через ГЭБ)', dose: '1440 мг', desc: '↑ Mg в мозге, блок NMDA, ↑ синаптическую пластичность (LTP)' },
  { id: 'melatonin', nameRu: 'Мелатонин', dose: '3 мг', desc: 'Циркадный ритм, ↓ латентность сна, антиоксидант в ЦНС' },
  { id: 'theanine', nameRu: 'L-Теанин', dose: '200 мг', desc: '↑ α-волны ЭЭГ, ↑ ГАМК через глутаматный шунт' },
  { id: 'glycine', nameRu: 'Глицин', dose: '3 г', desc: 'Тормозной нейромедиатор, ко-агонист NMDA, ↓ t° тела' },
  { id: 'gaba', nameRu: 'ГАМК', dose: '500 мг', desc: '↓ возбудимость ЦНС, ↑ качество и глубину сна' },
  { id: 'phosphatidylserine', nameRu: 'Фосфатидилсерин', dose: '300 мг', desc: 'Связывает кортизол, ↓ GR-активацию в гиппокампе' },
  { id: 'ashwagandha', nameRu: 'Ашваганда KSM-66', dose: '600 мг', desc: '↓ кортизол на 20-30%, ↑ ГАМК-А, ↑ T4→T3' },
  { id: 'rhodiola', nameRu: 'Родиола розовая', dose: '400 мг', desc: '↓ МАО-А, ↑ тирозин-гидроксилазу, ↑ дофамин' },
  { id: 'bacopa', nameRu: 'Бакопа монье', dose: '300 мг', desc: '↑ ацетилхолин, ↑ дендритное ветвление, антиоксидант' },
  { id: 'citicoline', nameRu: 'Цитиколин (CDP-холин)', dose: '500 мг', desc: 'Донатор холина для ACh, ↑ фосфатидилхолин мембран' },
  { id: 'alpha_gpc', nameRu: 'Альфа-GPC', dose: '300 мг', desc: '↑ ACh в мозге, ↑ ГР через соматотропы' },
  { id: 'acetyl_l_carnitine', nameRu: 'Ацетил-L-Карнитин (ALCAR)', dose: '500 мг', desc: '↑ митохондриальный ацетил-КоА, ↑ BDNF, антидепрессант' },
  { id: 'uridine_monophosphate', nameRu: 'Уридин монофосфат', dose: '300 мг', desc: '↑ фосфатидилхолин, ↑ CDP-холин, ↑ синаптические P2Y2' },
  { id: 'lions_mane', nameRu: 'Ежовик гребенчатый', dose: '1000 мг', desc: '↑ NGF через ERK1/2, ↑ миелинизацию аксонов' },
  { id: 'tryptophan', nameRu: 'L-Триптофан', dose: '500 мг', desc: 'Предшественник серотонина → мелатонин, ↑ настроение' },
  { id: 'x5htp', nameRu: '5-HTP', dose: '100 мг', desc: 'Прямой субстрат серотонина, ↓ тревожность, ↑ сон' },
  { id: 'curcumin', nameRu: 'Куркумин + пиперин', dose: '500 мг', desc: '↓ NF-κB, ↓ нейровоспаление, ↑ BDNF' },
  { id: 'omega3', nameRu: 'Омега-3 (DHA для мозга)', dose: '3 г', desc: 'DHA — структурный липид нейрональных мембран' },
  { id: 'vitamin_d3', nameRu: 'Витамин D3', dose: '5000 МЕ', desc: '↑ BDNF, ↓ нейровоспаление, VDR в гиппокампе' },
  { id: 'vitamin_b6', nameRu: 'B6 (P5P)', dose: '50 мг', desc: 'Кофактор синтеза ГАМК, серотонина, дофамина' },
  { id: 'vitamin_b12', nameRu: 'B12 (метилкобаламин)', dose: '1000 мкг', desc: 'Синтез миелина, кофактор метионин-синтазы' },
  { id: 'alpha_lipoic', nameRu: 'α-Липоевая кислота', dose: '600 мг', desc: 'Кофактор митохондрий, ↓ окислит. стресс, нейропатия' },
  { id: 'folate', nameRu: 'Фолат (5-MTHF)', dose: '400 мкг', desc: 'Метилирование, синтез SAME, обмен гомоцистеина' },
  { id: 'taurine', nameRu: 'Таурин', dose: '2 г', desc: '↑ ГАМК-А, ↓ глутаматную эксайтотоксичность' },
  { id: 'magnesium', nameRu: 'Магний (глицинат/цитрат)', dose: '400 мг', desc: '↓ NMDA-рецептор, ↑ ГАМК, ↓ кортизол, расслабление' },
];
const NEURO_RECOMMENDED_HIGH: Set<string> = new Set(['citicoline','lions_mane','magnesium_l_threonate','phosphatidylserine']);
const NEURO_RECOMMENDED_MEDIUM: Set<string> = new Set(['ashwagandha','theanine','gaba','melatonin','acetyl_l_carnitine','bacopa','rhodiola']);

// ── Доменные карты симптомов (нейротоксичность / ОДА) ─────────────────────────
interface DomainSym { code: string; label: string; }
interface DomainCfg {
  id: string; label: string; icon: string; color: string;
  symptoms: DomainSym[]; substances: Set<string>;
}
const NEURO_DOMAINS: DomainCfg[] = [
  { id: 'gaba', label: 'ГАМК / эксайтотоксичность', icon: '⚡', color: '#ef4444',
    symptoms: [
      { code: 'aggression', label: 'Агрессия / раздражительность' },
      { code: 'anxiety', label: 'Тревожность' },
      { code: 'inner_tremor', label: 'Внутренняя дрожь / напряжение' },
      { code: 'insomnia_onset', label: 'Бессонница (трудно заснуть)' },
      { code: 'tremor', label: 'Тремор' },
    ],
    substances: new Set(['magnesium_l_threonate','theanine','taurine','glycine','gaba','magnesium']) },
  { id: 'serotonin', label: 'Серотонин / аффект', icon: '🌧️', color: '#a855f7',
    symptoms: [
      { code: 'low_mood', label: 'Подавленное настроение' },
      { code: 'anhedonia', label: 'Ангедония (утрата удовольствия)' },
      { code: 'mood_labile', label: 'Эмоциональная лабильность' },
    ],
    substances: new Set(['x5htp','tryptophan','vitamin_b6']) },
  { id: 'dopamine', label: 'Дофамин / когниция', icon: '🎯', color: '#f59e0b',
    symptoms: [
      { code: 'brain_fog', label: '«Туман в голове»' },
      { code: 'slow_thinking', label: 'Замедленное мышление' },
      { code: 'focus', label: 'Снижение концентрации' },
      { code: 'motivation', label: 'Снижение мотивации' },
      { code: 'memory', label: 'Проблемы с памятью' },
    ],
    substances: new Set(['citicoline','alpha_gpc','acetyl_l_carnitine','uridine_monophosphate','rhodiola']) },
  { id: 'sleep', label: 'Циркадный сон', icon: '🌙', color: '#3b82f6',
    symptoms: [
      { code: 'sleep_onset2', label: 'Долгое засыпание' },
      { code: 'night_awakenings', label: 'Ночные пробуждения' },
      { code: 'early_wake', label: 'Ранние пробуждения' },
      { code: 'nonrestorative', label: 'Сон не восстанавливает' },
    ],
    substances: new Set(['melatonin','glycine','magnesium_l_threonate','theanine','gaba']) },
  { id: 'hpa', label: 'Вегетатика / HPA-ось', icon: '🔥', color: '#ec4899',
    symptoms: [
      { code: 'stress', label: 'Высокий стресс / кортизол' },
      { code: 'sweating', label: 'Потливость' },
      { code: 'resting_tachy', label: 'Учащённое сердцебиение в покое' },
      { code: 'weather_dependent', label: 'Метеозависимость' },
    ],
    substances: new Set(['phosphatidylserine','ashwagandha','rhodiola']) },
  { id: 'neuropathy', label: 'Периферич. нейропатия', icon: '🦶', color: '#14b8a6',
    symptoms: [
      { code: 'paresthesia', label: 'Парестезии / «мурашки»' },
      { code: 'numbness', label: 'Онемение конечностей' },
      { code: 'cramps', label: 'Мышечные судороги' },
    ],
    substances: new Set(['vitamin_b12','folate','vitamin_b6','alpha_lipoic','magnesium']) },
  { id: 'neuroinflammation', label: 'Нейровоспаление', icon: '🧨', color: '#f97316',
    symptoms: [
      { code: 'headaches', label: 'Головные боли' },
      { code: 'neuro_inflammation', label: 'Системное воспаление (CRP↑)' },
    ],
    substances: new Set(['curcumin','omega3','vitamin_d3']) },
];
const JOINT_DOMAINS: DomainCfg[] = [
  { id: 'cartilage', label: 'Хрящ / остеоартроз', icon: '🦴', color: '#22c55e',
    symptoms: [
      { code: 'load_pain', label: 'Боль при нагрузке' },
      { code: 'crepitus', label: 'Хруст / крепитация' },
      { code: 'stiffness_lt30', label: 'Утренняя скованность <30 мин' },
      { code: 'rom_limit', label: 'Ограничение объёма движений' },
    ],
    substances: new Set(['glucosamine','chondroitin','collagen','collagen_uc2','hyaluronic_acid','silicon']) },
  { id: 'tendon', label: 'Сухожилия / энтезит', icon: '💪', color: '#f59e0b',
    symptoms: [
      { code: 'local_pain', label: 'Локальная боль в месте прикрепления' },
      { code: 'eccentric_pain', label: 'Боль при эксцентрике' },
      { code: 'joint_swelling', label: 'Локальный отёк' },
    ],
    substances: new Set(['collagen','vitamin_c','msm','manganese','bpc','tb500']) },
  { id: 'ligament', label: 'Связки / нестабильность', icon: '🔗', color: '#06b6d4',
    symptoms: [
      { code: 'instability', label: 'Нестабильность / «проворачивание»' },
      { code: 'hypermobility', label: 'Гипермобильность' },
    ],
    substances: new Set(['collagen','vitamin_c','silicon','boron']) },
  { id: 'bone', label: 'Кость / МПК', icon: '🦷', color: '#a855f7',
    symptoms: [
      { code: 'fracture_hx', label: 'Переломы в анамнезе' },
      { code: 'aas_bone', label: 'Длительная АС-терапия' },
    ],
    substances: new Set(['calcium','vitamin_d3','vitamin_k2','boron']) },
  { id: 'synovitis', label: 'Синовит / воспаление', icon: '🔥', color: '#ef4444',
    symptoms: [
      { code: 'joint_swelling2', label: 'Отёк / припухлость сустава' },
      { code: 'heat', label: 'Локальное тепло / покраснение' },
      { code: 'stiffness_gt60', label: 'Утренняя скованность >60 мин' },
      { code: 'crp_up', label: 'CRP ↑' },
    ],
    substances: new Set(['omega3','curcumin','boswellia']) },
  { id: 'posttrauma', label: 'Посттравма / заживление', icon: '🩹', color: '#f97316',
    symptoms: [
      { code: 'injury_hx', label: 'Травма / операция в анамнезе' },
    ],
    substances: new Set(['bpc','tb500','collagen']) },
];

function buildNeuroSymptomsFromState(state: any): Set<string> {
  const s = new Set<string>();
  const n = state?.neuro || {};
  const p = state?.profile || {};
  const symptoms = (state?.symptoms as string[]) || [];
  const labs = labSliceToValues(state?.labs?.fullPanel);
  if ((n.aggressionScore || 0) >= 4) s.add('aggression');
  if (n.gabaBalance === 'overexcited') { s.add('anxiety'); s.add('inner_tremor'); }
  if (p.sleepHours != null && p.sleepHours < 6) s.add('sleep_onset2');
  if (n.sleepQuality === 'poor') s.add('nonrestorative');
  if ((p.stressLevel || 0) >= 7) s.add('stress');
  if ((n.serotoninScore || 0) <= 2) s.add('low_mood');
  if ((n.dopamineScore || 0) <= 2) { s.add('anhedonia'); s.add('brain_fog'); }
  if (n.memoryIssues) s.add('memory');
  if (n.focusIssues) s.add('focus');
  if (n.slowThinking) s.add('slow_thinking');
  if (n.headaches) s.add('headaches');
  if (n.weatherDependent) s.add('weather_dependent');
  if (symptoms.includes('insomnia')) s.add('insomnia_onset');
  if (symptoms.includes('anxiety')) s.add('anxiety');
  const crp = labs['CRP'] || labs['HSCRP'];
  if (crp != null && crp > 3) s.add('neuro_inflammation');
  return s;
}
function buildJointSymptomsFromState(state: any): Set<string> {
  const s = new Set<string>();
  const oda = state?.oda || {};
  const symptoms = (state?.symptoms as string[]) || [];
  const labs = labSliceToValues(state?.labs?.fullPanel);
  const jp = oda.jointPain;
  if (jp === 'mild') s.add('load_pain');
  if (jp === 'moderate') { s.add('load_pain'); s.add('crepitus'); }
  if (jp === 'severe') { s.add('load_pain'); s.add('crepitus'); s.add('joint_swelling'); }
  if (oda.ligamentIssues) s.add('instability');
  if (oda.backPain) s.add('load_pain');
  if ((oda.injuries || []).length > 0) s.add('injury_hx');
  if (symptoms.includes('joint_pain')) s.add('load_pain');
  const crp = labs['CRP'] || labs['HSCRP'];
  if (crp != null && crp > 3) s.add('crp_up');
  return s;
}

// Доменная карта симптомов: чипы по клиническим доменам + профиль риска
function DomainSymptomMap({ domains, checked, onToggle }: { domains: DomainCfg[]; checked: Set<string>; onToggle: (code: string) => void }) {
  const scores = domains.map(d => ({ d, score: Math.min(10, d.symptoms.filter(sym => checked.has(sym.code)).length * 3) }));
  const active = scores.filter(x => x.score >= 6).sort((a, b) => b.score - a.score);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#ffffff', marginBottom: 5 }}>🩺 Карта симптомов (по клиническим доменам)</div>
      {domains.map(d => (
        <div key={d.id} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 10 }}>{d.icon}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: d.color }}>{d.label}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {d.symptoms.map(sym => {
              const on = checked.has(sym.code);
              return (
                <button key={sym.code} onClick={() => onToggle(sym.code)}
                  style={{ fontSize: 7, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                    background: on ? d.color + '22' : 'rgba(255,255,255,0.03)',
                    border: on ? `1px solid ${d.color}66` : '1px solid rgba(255,255,255,0.06)',
                    color: on ? d.color : 'rgba(255,255,255,0.5)' }}>
                  {on ? '✓ ' : ''}{sym.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>Профиль риска по доменам</div>
        {scores.map(({ d, score }) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <span style={{ fontSize: 7, width: 92, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{d.label}</span>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${score * 10}%`, height: '100%', background: score >= 8 ? '#ef4444' : score >= 6 ? '#f97316' : score >= 3 ? '#f59e0b' : '#22c55e' }} />
            </div>
            <span style={{ fontSize: 7, width: 14, textAlign: 'right', color: 'rgba(255,255,255,0.4)' }}>{score}</span>
          </div>
        ))}
      </div>
      {active.length > 0 && (
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.3 }}>
          Приоритет: {active.map(x => x.d.label).join(' · ')}
        </div>
      )}
    </div>
  );
}

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
  glucosamine: 'Глюкозамин сульфат', chondroitin: 'Хондроитин сульфат',
  collagen: 'Коллаген гидролизат', collagen_uc2: 'Коллаген UC-II',
  msm: 'MSM', hyaluronic_acid: 'Гиалуроновая кислота',
  manganese: 'Марганец', silicon: 'Кремний', boron: 'Бор',
  bpc: 'BPC-157', tb500: 'TB-500', boswellia: 'Босвеллия',
  // нейропротекция
  citicoline: 'Цитиколин', alpha_gpc: 'Альфа-GPC', uridine_monophosphate: 'Уридин UMP',
  magnesium_l_threonate: 'Магний L-треонат', acetyl_l_carnitine: 'Ацетил-L-Карнитин',
  gaba: 'ГАМК', x5htp: '5-HTP', tryptophan: 'L-Триптофан',
  ashwagandha: 'Ашваганда', rhodiola: 'Родиола', bacopa: 'Бакопа',
  lions_mane: 'Ежовик',
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
    pedDoses, libidoLow: ((state as any).symptoms || []).includes('low_libido'),
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
  planResult?: import('../../../engines/support-plan').PlanResult;
}

export const CalcMapperCard: React.FC<CalcMapperProps> = ({ state, onStateChange, onApply, onOpenManualPicker, onOpenLabs, planResult }) => {
  const [level, setLevel] = useState<SupportLevel>('medium');
  const [manualSubs, setManualSubs] = useState<string[]>([]);
  const [selectedStacks, setSelectedStacks] = useState<string[]>([]);
  const [showIntellPopup, setShowIntellPopup] = useState(false);
  const [showManualPopup, setShowManualPopup] = useState(false);
  const [manualTab, setManualTab] = useState<'stacks' | 'catalog' | 'saved' | 'favorites'>('stacks');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [savedSearch, setSavedSearch] = useState('');
  const [manualSubInput] = useState('');
  const [manualStackSearch, setManualStackSearch] = useState('');
  const [expandedManualStack, setExpandedManualStack] = useState<string | null>(null);
  const catalogSubsCount = useMemo(() => Object.keys(SUPPORT_CATALOG_DATA).length, []);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [showPrescription, setShowPrescription] = useState(true);
  const [showSynergy, setShowSynergy] = useState(true);
  const [removedSubs, setRemovedSubs] = useState<string[]>([]);
  const [addedSubs, setAddedSubs] = useState<string[]>([]);
  const [substanceManagerKey, setSubstanceManagerKey] = useState(0);
  const [stackModulePopup, setStackModulePopup] = useState<string | null>(null);
  const [articularPreset, setArticularPreset] = useState<string | null>(null);
  const [articularSelected, setArticularSelected] = useState<Set<string>>(new Set());
  const [articularConfirm, setArticularConfirm] = useState<boolean>(false);
  const [neuroPreset, setNeuroPreset] = useState<string | null>(null);
  const [neuroSelected, setNeuroSelected] = useState<Set<string>>(new Set());
  const [neuroConfirm, setNeuroConfirm] = useState<boolean>(false);
  const [neuroSymptoms, setNeuroSymptoms] = useState<Set<string>>(new Set());
  const [jointSymptoms, setJointSymptoms] = useState<Set<string>>(new Set());
  const [applyFlash, setApplyFlash] = useState(false);
  const [showContraindications, setShowContraindications] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showMonitoringPlan, setShowMonitoringPlan] = useState(false);
  const [showRebound, setShowRebound] = useState(false);
  const [showSymptoms, setShowSymptoms] = useState(true);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showInteractions, setShowInteractions] = useState(false);
  const [showEnhancementPopup, setShowEnhancementPopup] = useState(false);
  const [enhancementSearch, setEnhancementSearch] = useState('');
  const [showMegaPopup, setShowMegaPopup] = useState(false);
  const [megaSelected, setMegaSelected] = useState<Set<string>>(new Set());

  const ctx = useMemo(() => {
    const base = buildMapperCtx(state, level, level === 'manual' ? { addSubs: manualSubs } : undefined, selectedStacks);
    if (symptoms.length > 0) base.symptoms = symptoms;
    base.libidoLow = symptoms.includes('low_libido');
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

  // Автоподбор стеков под недокрытые механизмы ТЗ (режим «Усиление»)
  const gapFill = useMemo(() => buildGapFillSuggestions((finalRec?.gaps as any) || []), [finalRec]);

  const megaSuggestions = useMemo(() => {
    if (!finalRec) return [];
    const currentSubs = finalRec.subs.map(s => s.substanceId);
    return megaEnhance(finalRec.gaps as any, currentSubs);
  }, [finalRec]);

  // Токсикологический контроль дозировок (UL + титрация выше оптимума)
  const toxWarnings = useMemo<ToxWarning[]>(() => {
    if (!finalRec || finalRec.subs.length === 0) return [];
    try {
      return checkStackToxicity(finalRec.subs.map(s => s.substanceId));
    } catch {
      return [];
    }
  }, [finalRec]);

  const synergyDesc = finalRec ? buildStackSynergyDescription(finalRec) : [];

  // РУЧНОЙ РЕЖИМ: план строится НАПРЯМУЮ из выбранных стеков (независимо от движка).
  // Это гарантирует, что выбранные стеки всегда видны, даже если resolvePlan упадёт.
  const manualResultSubs = useMemo(() => {
    if (level !== 'manual') return [];
    const map = new Map<string, { id: string; dose?: string; timing?: string; stack: string }>();
    for (const stId of selectedStacks) {
      const st = (ALL_STACKS as any[]).find(s => s.id === stId);
      if (!st) continue;
      for (const sd of (st.substances || [])) {
        if (!map.has(sd.id)) map.set(sd.id, { id: sd.id, dose: sd.dose, timing: sd.timing, stack: st.name || stId });
      }
    }
    return Array.from(map.values());
  }, [level, selectedStacks]);

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
        <div                         onClick={() => { setLevel('manual'); setShowManualPopup(true); }} style={{ borderRadius:14, background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(59,130,246,0.03))', border:'1.5px solid rgba(99,102,241,0.15)', padding:'12px 12px 10px', cursor:'pointer' }}>
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
      {showIntellPopup && ReactDOM.createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowIntellPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:320, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
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
                      <div style={{ fontSize:10, fontWeight:700, color: level === lv ? '#00e68a' : '#ffffff' }}>{label} {level === lv && '✓'}</div>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Попап ручного режима (портал в body, экранирует backdrop-filter предка) ── */}
      {showManualPopup && ReactDOM.createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)', overflowY:'auto', padding:'20px 0' }} onClick={() => setShowManualPopup(false)}>
        <div style={{ width:'90%', maxWidth:420, margin:'0 auto', borderRadius:16, background:'#16161a', border:'1px solid rgba(255,255,255,0.12)', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
          <div style={{ height:3, background:'linear-gradient(90deg,#818cf8,#6366f1)' }} />
          <div style={{ padding:'16px 14px 12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:800, color:'#818cf8' }}>⚙️ Ручной режим</span>
                <button onClick={() => setShowManualPopup(false)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:12, fontWeight:600 }}>✕</button>
              </div>
              {/* Tab bar */}
              <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', flexWrap:'wrap' }}>
                {['stacks','catalog','saved','favorites'].map((id) => (
                  <button key={id} onClick={() => { setManualTab(id as any); setCatalogSearch(''); setSavedSearch(''); setManualStackSearch(''); }}
                    style={{
                      padding:'6px 10px', borderRadius:8, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                      background: manualTab === id ? '#818cf8' : 'rgba(255,255,255,0.05)',
                      color: manualTab === id ? '#000' : 'rgba(255,255,255,0.6)',
                      border: '1px solid ' + (manualTab === id ? '#818cf8' : 'rgba(255,255,255,0.1)'),
                    }}>{id === 'stacks' ? '📦 Стеки' : id === 'catalog' ? '📋 Каталог' : id === 'saved' ? '💾 Сохранённые' : '⭐ Избранное'}</button>
                ))}
              </div>
              {manualTab === 'catalog' && (
                <>
                  <input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} placeholder="🔍 Поиск препарата (минимум 2 символа)..." style={{
                    width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:6, outline:'none',
                  }} />
                  {!catalogSearch || catalogSearch.length < 2 ? (
                    <div style={{ padding:30, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:11 }}>
                      Введите минимум 2 символа для поиска по {Object.keys(SUPPORT_CATALOG_DATA).length} препаратам
                    </div>
                  ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'45vh', overflowY:'auto', marginBottom:10 }}>
                    {Object.entries(SUPPORT_CATALOG_DATA)
                      .filter(([id, entry]: [string, any]) => {
                        const q = catalogSearch.toLowerCase();
                        return (entry.nameRu||'').toLowerCase().includes(q) || (entry.name||'').toLowerCase().includes(q) || id.toLowerCase().includes(q);
                      })
                      .map(([id, entry]: [string, any]) => (
                        <CalcSubstanceDetail
                          key={id}
                          sub={{ substanceId: id, category: 'other' as const, k: 0, reason: 'Ручной выбор', mechsCovered: entry.mechanisms || [], q: 'B' }}
                          rec={{ subs: [], suppression: [], coverage: [], gaps: [], conflicts: [], guardrails: [], boosters: [], activatedMechs: [], summary: '', rationale: '', level: 'medium', phase: 'on', phaseLabel: 'На курсе' } as any}
                          subNameRu={(id: string) => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id}
                          subDosage={(id: string) => SUPPORT_CATALOG_DATA[id]?.dosage || { mg: 0, timing: '' }}
                          subTier={(id: string) => SUPPORT_CATALOG_DATA[id]?.tier || 'standard'}
                          canonIdLocal={(id: string) => id}
                        />
                      ))}
                  </div>
                  )}
                </>
              )}
              {manualTab === 'saved' && (
                <div style={{ padding:30, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:11 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>💾</div>
                  Здесь будут сохранённые планы и стеки.
                </div>
              )}
              {manualTab === 'favorites' && (
                <div style={{ padding:30, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:11 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>⭐</div>
                  Здесь будут избранные препараты.
                </div>
              )}
              {manualTab === 'stacks' && (
                <>
              {manualSubs.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.55)', marginBottom:4 }}>💊 Препараты из ручного ввода ({manualSubs.length}) — откройте каталог для выбора</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {manualSubs.map((sid, i) => (
                      <span key={sid+i} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontWeight:600, background:'rgba(99,102,241,0.12)', color:'#818cf8', display:'inline-flex', alignItems:'center', gap:4, margin:1 }}>
                        {sid}
                        <span onClick={() => setManualSubs(prev => prev.filter((_, j) => j !== i))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:13 }}>✕</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedStacks.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#c084fc', marginBottom:4 }}>📦 Выбранные стеки поддержки ({selectedStacks.length})</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {selectedStacks.map((stId) => {
                      const st = (ALL_STACKS as any[]).find(s => s.id === stId);
                      return (
                        <span key={stId} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontWeight:600, background:'rgba(168,85,247,0.12)', color:'#c084fc', display:'inline-flex', alignItems:'center', gap:4, margin:1 }}>
                          {st?.name || stId}
                          <span onClick={() => setSelectedStacks(prev => prev.filter(s => s !== stId))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.5)', fontSize:13 }}>✕</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ fontSize:13, fontWeight:700, color:'#ffffff', marginBottom:4, marginTop:4 }}>📦 Добавить стек из {ALL_STACKS.length} готовых</div>
              <input value={manualStackSearch} onChange={e => setManualStackSearch(e.target.value)} placeholder="🔍 Поиск стека..." style={{
                width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:6, outline:'none',
              }} />
              <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'55vh', overflowY:'auto', marginBottom:10 }}>
                {(ALL_STACKS as any[])
                  .filter((st: any) => {
                    if (!manualStackSearch) return true;
                    const q = manualStackSearch.toLowerCase();
                    return (st.name||'').toLowerCase().includes(q) || (st.id||'').toLowerCase().includes(q) || (st.system||'').toLowerCase().includes(q) || (st.problem||'').toLowerCase().includes(q);
                  })
                  .map((st: any) => {
                    const active = selectedStacks.includes(st.id);
                    const subCount = (st.substances||[]).length;
                    const isExpanded = expandedManualStack === st.id;
                    return (
                      <div key={st.id}
                        style={{ borderRadius:7,
                          background: active ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)',
                          border: active ? '1px solid rgba(168,85,247,0.25)' : '1px solid rgba(255,255,255,0.04)' }}>
                        <div onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== st.id) : [...prev, st.id])}
                          style={{ padding:'8px 10px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:6 }}>
                          <span style={{ fontSize:13, minWidth:14, color: active ? '#c084fc' : 'rgba(255,255,255,0.4)', marginTop:1 }}>{active ? '✓' : '○'}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color: active ? '#c084fc' : 'rgba(255,255,255,0.9)', lineHeight:1.25 }}>{st.name || st.id.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2, lineHeight:1.35 }}>{st.system || ''} · {subCount} веществ{st.synergyScore ? ` · син: ${st.synergyScore}` : ''}</div>
                          </div>
                          <span onClick={(e) => { e.stopPropagation(); setExpandedManualStack(isExpanded ? null : st.id); }}
                            style={{ fontSize:13, color:'rgba(255,255,255,0.55)', cursor:'pointer', marginTop:1, padding:'0 2px', flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        {isExpanded && (
                          <div style={{ padding:'0 8px 8px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                            {st.anatomicalMapping?.organMechanisms && (
                              <div style={{ fontSize:11, color:'rgba(240,240,245,0.9)', lineHeight:1.45, marginTop:6 }}>
                                <b style={{ color:'#a78bfa' }}>🧬 Механизм действия:</b> {st.anatomicalMapping.organMechanisms}
                              </div>
                            )}
                            {st.synergyPrinciple && (
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                                <b>Принцип синергии:</b> {st.synergyPrinciple}
                              </div>
                            )}
                            {st.anatomicalMapping?.finalEffect && (
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                                <b>Итоговый эффект:</b> {st.anatomicalMapping.finalEffect}
                              </div>
                            )}
                            {st.anatomicalMapping?.mechanismCodes?.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>
                                {st.anatomicalMapping.mechanismCodes.map((m: string) => (
                                  <span key={m} style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.1)', color:'#c084fc' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g,' ')}</span>
                                ))}
                              </div>
                            )}
                            <div style={{ fontSize:12, fontWeight:700, color:'#00e68a', marginTop:8, marginBottom:3 }}>💊 Перечень препаратов ({subCount}):</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                              {(st.substances||[]).map((sd: any) => {
                                const cat = SUPPORT_CATALOG_DATA[sd.id];
                                return (
                                  <div key={sd.id} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.12)' }}>
                                    <span style={{ fontWeight:600, color:'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || sd.id}</span>
                                    {sd.dose && <span style={{ color:'#00e68a', marginLeft:4 }}>{sd.dose}</span>}
                                    {sd.timing && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:4 }}>{sd.timing}</span>}
                                    {sd.mechanism && <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2 }}>— {sd.mechanism}</div>}
                                  </div>
                                );
                              })}
                            </div>
                            {(st.contraindications || st.warnings) && (
                              <div style={{ marginTop:8 }}>
                                {st.contraindications && (
                                  <div style={{ fontSize:11, color:'#f87171', lineHeight:1.45 }}>
                                    <b>⛔ Противопоказания:</b> {st.contraindications}
                                  </div>
                                )}
                                {st.warnings && (
                                  <div style={{ fontSize:11, color:'#fbbf24', lineHeight:1.45, marginTop:3 }}>
                                    <b>⚠ Осторожности / предосторожности:</b> {st.warnings}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
                </>
              )}
              <button onClick={() => { setLevel('manual'); setShowManualPopup(false); }} style={{ width:'100%', padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#818cf8,#6366f1)', border:'none', color:'#000', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                ✅ Применить ручной выбор
              </button>
            </div>
           </div>
        </div>
      , document.body)}
      
      {/* ===== УСИЛЕНИЕ: все стеки каталога (видно во ВСЕХ режимах, включая ручной) ===== */}
      {(
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:12, background:'rgba(24,24,27,0.3)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.3px' }}>Усиление ({ALL_STACKS.length} стеков)</span>
            <button onClick={() => setShowEnhancementPopup(true)} style={{ fontSize:11, fontWeight:700, cursor:'pointer', padding:'5px 10px', borderRadius:6, background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)', color:'#f87171' }}>📋 Все стеки</button>
          </div>
          <div style={{ display:'flex', gap:4, marginBottom:4 }}>
            {([
              ['articular_stack', '🦴', 'Суставы', '#4ade80'],
              ['neuroprotection_stack', '🧠', 'Нейро', '#818cf8'],
              ['mega_total_support_35', '🚀', 'Мега', '#f87171'],
            ] as const).map(([id, icon, label, col]) => {
              const active = selectedStacks.includes(id) || (id === 'mega_total_support_35' && megaSelected.size > 0);
              return (
                <button key={id} onClick={() => {
                  if (id === 'mega_total_support_35') {
                    setMegaSelected(new Set());
                    setShowMegaPopup(true);
                  } else {
                    setStackModulePopup(id);
                    if (id === 'articular_stack') { setArticularPreset(null); setArticularSelected(new Set()); setArticularConfirm(false); setJointSymptoms(buildJointSymptomsFromState(state)); }
                    if (id === 'neuroprotection_stack') { setNeuroPreset(null); setNeuroSelected(new Set()); setNeuroConfirm(false); setNeuroSymptoms(buildNeuroSymptomsFromState(state)); }
                  }
                }}
                  style={{ flex:1, padding:'8px 4px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                    background: active ? `linear-gradient(135deg,rgba(${col === '#4ade80' ? '34,197,94' : col === '#818cf8' ? '99,102,241' : '239,68,68'},0.2),rgba(${col === '#4ade80' ? '34,197,94' : col === '#818cf8' ? '99,102,241' : '239,68,68'},0.1))` : 'rgba(255,255,255,0.03)',
                    border: active ? `1.5px solid ${col}55` : '1px solid rgba(255,255,255,0.06)',
                    color: active ? col : 'rgba(255,255,255,0.5)' }}>
                  <span style={{fontSize:13}}>{icon}</span>
                  <span>{label}</span>
                  {active && <span style={{fontSize:6,fontWeight:700,color:col,marginTop:1}}>✓</span>}
                </button>
              );
            })}
          </div>
          {selectedStacks.filter(id => !['articular_stack','neuroprotection_stack','mega_total_support_35'].includes(id)).length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
              {selectedStacks.filter(id => !['articular_stack','neuroprotection_stack','mega_total_support_35'].includes(id)).map(sid => (
                <span key={sid} style={{ fontSize:10, padding:'3px 7px', borderRadius:6, fontWeight:600, background:'rgba(168,85,247,0.12)', color:'#c084fc', display:'inline-flex', alignItems:'center', gap:4 }}>
                  {sid.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}
                  <span onClick={() => setSelectedStacks(prev => prev.filter(s => s !== sid))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.6)', fontSize:12 }}>✕</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Попап полного каталога стеков (Усиление) — ВСЕ 55 стеков из ALL_STACKS ── */}
      {showEnhancementPopup && ReactDOM.createPortal(
         <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowEnhancementPopup(false)}>
           <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
             <div style={{ height:3, background:'linear-gradient(90deg,#f87171,#ef4444)' }} />
             <div style={{ padding:'14px 14px 10px' }}>
               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                 <span style={{ fontSize:13, fontWeight:800, color:'#f87171' }}>🚀 Усиление: все стеки ({ALL_STACKS.length})</span>
                <button onClick={() => setShowEnhancementPopup(false)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:12, fontWeight:600 }}>✕</button>
              </div>
              <input value={enhancementSearch} onChange={e => setEnhancementSearch(e.target.value)} placeholder="🔍 Поиск стека по названию, системе или проблеме..." style={{
                width:'100%', padding:'9px 11px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'#26262b', color:'#ffffff', fontSize:13, boxSizing:'border-box', marginBottom:8,
              }} />
            </div>

            {/* ── Автоподбор под недостающие механизмы ТЗ ── */}
            {gapFill.length > 0 && (
              <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(239,68,68,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'#f87171' }}>🎯 Автоподбор под недостающие механизмы ({gapFill.length})</span>
                  <button onClick={() => setSelectedStacks(prev => Array.from(new Set([...prev, ...gapFill.map(g => g.stackId)])))}
                    style={{ padding:'5px 11px', borderRadius:7, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.12)', color:'#fca5a5', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                    ✅ Все рекомендованные
                  </button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {gapFill.map(g => {
                    const active = selectedStacks.includes(g.stackId);
                    return (
                      <div key={g.stackId} onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== g.stackId) : [...prev, g.stackId])}
                        style={{ padding:'7px 9px', borderRadius:8, cursor:'pointer',
                          background: active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                          border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:11, minWidth:14, color: active ? '#c084fc' : 'rgba(255,255,255,0.55)' }}>{active ? '✓' : '○'}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color: active ? '#c084fc' : 'rgba(240,240,245,0.9)', lineHeight:1.25 }}>{g.stackName}</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', lineHeight:1.35, marginTop:2 }}>
                              {g.organLabels.join(', ')} · закрывает: {g.mechLabels.join(', ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:5, lineHeight:1.35 }}>
                  Стек покрывает механизмы, оставшиеся незакрытыми после текущего плана поддержки.
                </div>
              </div>
            )}

            <div style={{ flex:1, overflowY:'auto', padding:'0 14px 14px' }}>
              {(ALL_STACKS as any[])
                .filter((st: any) => {
                  if (!enhancementSearch) return true;
                  const q = enhancementSearch.toLowerCase();
                  const name = (st.name||'').toLowerCase();
                  const sys = (st.system||'').toLowerCase();
                  const prob = (st.problem||'').toLowerCase();
                  const sid = (st.id||'').toLowerCase();
                  return name.includes(q) || sys.includes(q) || prob.includes(q) || sid.includes(q);
                })
                .map((st: any) => {
                  const active = selectedStacks.includes(st.id);
                  const subCount = (st.substances||[]).length;
                  const trigger = STACK_BOOSTER_TRIGGERS.find(t => t.stackId === st.id);
                  const isExpanded = expandedManualStack === st.id;
                  return (
                    <div key={st.id}
                      style={{ borderRadius:8, marginBottom:4, overflow:'hidden',
                        background: active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.02)',
                        border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                      }}>
                      <div onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== st.id) : [...prev, st.id])}
                        style={{ padding:'9px 11px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:6 }}>
                        <span style={{ fontSize:13, minWidth:14, color: active ? '#c084fc' : 'rgba(255,255,255,0.4)', marginTop:1 }}>{active ? '✓' : '○'}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color: active ? '#c084fc' : 'rgba(255,255,255,0.9)', lineHeight:1.25 }}>{st.name || st.id.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}</div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2 }}>{st.problem || st.system || ''}</div>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginTop:3, display:'flex', gap:5, flexWrap:'wrap' }}>
                            <span>{subCount} веществ</span>
                            {st.synergyScore ? <span>· синергия: {st.synergyScore}</span> : null}
                            {st.system ? <span>· {st.system}</span> : null}
                            {trigger ? <span style={{color:'#f87171',fontWeight:700}}>· авто-триггер</span> : null}
                          </div>
                        </div>
                        <span onClick={(e) => { e.stopPropagation(); setExpandedManualStack(isExpanded ? null : st.id); }}
                          style={{ fontSize:13, color:'rgba(255,255,255,0.55)', cursor:'pointer', marginTop:1, padding:'0 2px', flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding:'0 10px 10px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                          {st.anatomicalMapping?.organMechanisms && (
                            <div style={{ fontSize:11, color:'rgba(240,240,245,0.9)', lineHeight:1.45, marginTop:6 }}>
                              <b style={{ color:'#a78bfa' }}>🧬 Механизм действия:</b> {st.anatomicalMapping.organMechanisms}
                            </div>
                          )}
                          {st.synergyPrinciple && (
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                              <b>Принцип синергии:</b> {st.synergyPrinciple}
                            </div>
                          )}
                          {st.anatomicalMapping?.finalEffect && (
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                              <b>Итоговый эффект:</b> {st.anatomicalMapping.finalEffect}
                            </div>
                          )}
                          {st.anatomicalMapping?.mechanismCodes?.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>
                              {st.anatomicalMapping.mechanismCodes.map((m: string) => (
                                <span key={m} style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.1)', color:'#c084fc' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g,' ')}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize:12, fontWeight:700, color:'#00e68a', marginTop:8, marginBottom:3 }}>💊 Перечень препаратов ({subCount}):</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                            {(st.substances||[]).map((sd: any) => {
                              const cat = SUPPORT_CATALOG_DATA[sd.id];
                              return (
                                <div key={sd.id} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.12)' }}>
                                  <span style={{ fontWeight:600, color:'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || sd.id}</span>
                                  {sd.dose && <span style={{ color:'#00e68a', marginLeft:4 }}>{sd.dose}</span>}
                                  {sd.timing && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:4 }}>{sd.timing}</span>}
                                  {sd.mechanism && <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2 }}>— {sd.mechanism}</div>}
                                </div>
                              );
                            })}
                          </div>
                          {(st.contraindications || st.warnings) && (
                            <div style={{ marginTop:8 }}>
                              {st.contraindications && (
                                <div style={{ fontSize:11, color:'#f87171', lineHeight:1.45 }}>
                                  <b>⛔ Противопоказания:</b> {st.contraindications}
                                </div>
                              )}
                              {st.warnings && (
                                <div style={{ fontSize:11, color:'#fbbf24', lineHeight:1.45, marginTop:3 }}>
                                  <b>⚠ Осторожности / предосторожности:</b> {st.warnings}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Попап Мега-усиления (умный подбор по gaps + синергии) ── */}
      {showMegaPopup && ReactDOM.createPortal(
         <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowMegaPopup(false)}>
           <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:400, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'88vh', display:'flex', flexDirection:'column' }}>
             <div style={{ height:3, background:'linear-gradient(90deg,#f87171,#ef4444)' }} />
             <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                 <span style={{ fontSize:13, fontWeight:800, color:'#f87171' }}>🚀 Мега-усиление</span>
                <button onClick={() => setShowMegaPopup(false)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:10, fontWeight:600 }}>✕</button>
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:4, lineHeight:1.3 }}>
                Умный подбор по непокрытым механизмам ТЗ ({finalRec?.gaps?.length || 0} gaps) и синергии с текущими препаратами ({finalRec?.subs?.length || 0})
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'10px 14px 14px' }}>
              {megaSuggestions.length === 0 ? (
                <div style={{ padding:'20px 10px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:10, lineHeight:1.5 }}>
                  ✅ Все активированные механизмы ТЗ покрыты текущим планом.<br />Усиление не требуется.
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'#f87171' }}>Найдено {megaSuggestions.length} веществ</span>
                    <button onClick={() => setMegaSelected(new Set(megaSuggestions.map(s => s.substanceId)))}
                    style={{ padding:'5px 11px', borderRadius:7, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.12)', color:'#fca5a5', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                      ✅ Все
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {megaSuggestions.map(s => {
                      const active = megaSelected.has(s.substanceId);
                      return (
                        <div key={s.substanceId} onClick={() => setMegaSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(s.substanceId)) next.delete(s.substanceId);
                          else next.add(s.substanceId);
                          return next;
                        })}
                          style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer',
                            background: active ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
                            border: active ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                            <span style={{ fontSize:11, minWidth:14, color: active ? '#f87171' : 'rgba(255,255,255,0.4)', marginTop:1 }}>{active ? '✓' : '○'}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:10, fontWeight:700, color: active ? '#fca5a5' : 'rgba(240,240,245,0.9)', lineHeight:1.2 }}>
                                {subNameRu(s.substanceId)}
                              </div>
                              <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.3, marginTop:2 }}>
                                {s.reason}
                              </div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', marginTop:3, display:'flex', gap:5, flexWrap:'wrap' }}>
                                <span>📊 {s.mechsCovered.length} мех.</span>
                                {s.synergyWith.length > 0 && (
                                  <span style={{ color:'#fbbf24', fontWeight:700 }}>⚡ синергия: {s.synergyWith.map(x => subNameRu(x)).join(', ')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {megaSuggestions.length > 0 && (
              <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => { setMegaSelected(new Set()); setShowMegaPopup(false); }}
                    style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
                    Отмена
                  </button>
                  <button onClick={() => {
                    const newSubs = Array.from(megaSelected).filter(sid =>
                      !(finalRec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid))
                    );
                    setAddedSubs(prev => [...new Set([...prev, ...newSubs])]);
                    setShowMegaPopup(false);
                  }}
                    disabled={megaSelected.size === 0}
                    style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor: megaSelected.size > 0 ? 'pointer' : 'default', border:'none', color:'#000',
                      background: megaSelected.size > 0 ? 'linear-gradient(135deg,#f87171,#ef4444)' : 'rgba(255,255,255,0.06)' }}>
                    ✅ Добавить ({megaSelected.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      , document.body)}

      {/* ── Попап анализа доп. модуля (ПОРТАЛ — экранирует backdrop-filter предка) ── */}
      {stackModulePopup && ReactDOM.createPortal((() => {
        // Для articular_stack — новый попап с протоколами и выбором
        if (stackModulePopup === 'articular_stack') {
          const planIds = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
          const symptoms = (state as any).symptoms || [];
          const labs = labSliceToValues(state.labs.fullPanel);
          const jointPain = state.oda.jointPain;
          const hasJointSymptom = symptoms.includes('joint_pain');
          const crp = labs['CRP'] || labs['HSCRP'];
          const jointScore = (hasJointSymptom ? 20 : 0) + (jointPain === 'severe' ? 30 : jointPain === 'moderate' ? 15 : jointPain === 'mild' ? 5 : 0) + (crp && crp > 3 ? 15 : 0);
          const presetColor = jointScore < 20 ? '#22c55e' : jointScore < 40 ? '#f59e0b' : jointScore < 60 ? '#f97316' : '#ef4444';

          const toggleSub = (id: string) => {
            setArticularSelected(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          };
          const toggleJointSymptom = (code: string) => setJointSymptoms(prev => {
            const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next;
          });
          const jointDomainScores = JOINT_DOMAINS.map(d => ({ d, score: Math.min(10, d.symptoms.filter(s => jointSymptoms.has(s.code)).length * 3) }));
          const jointRecSet = new Set<string>();
          jointDomainScores.forEach(({ d, score }) => { if (score >= 6) d.substances.forEach(id => jointRecSet.add(id)); });
          JOINT_RECOMMENDED_HIGH.forEach(id => jointRecSet.add(id));
          JOINT_RECOMMENDED_MEDIUM.forEach(id => jointRecSet.add(id));
          const jointDomainOf = (id: string) => JOINT_DOMAINS.filter(d => d.substances.has(id));

          return (
            <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => { setStackModulePopup(null); setArticularConfirm(false); }}>
               <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
                  <div style={{ height:3, background:'linear-gradient(90deg,#4ade80,#22c55e)' }} />
                 <div style={{ flex:'1 1 0%', minHeight:0, padding:'14px 14px 16px', overflowY:'auto' }}>
                  {/* Заголовок + контекст */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                   <span style={{ fontSize:13, fontWeight:800, color:'#4ade80' }}>🦴 Суставы/Связки — подбор поддержки</span>
                   <button onClick={() => { setStackModulePopup(null); setArticularConfirm(false); }} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:8, padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    {jointScore < 20 ? '🟢 Низкий риск — профилактика' : jointScore < 40 ? '🟡 Умеренный риск — базовая поддержка' : jointScore < 60 ? '🟠 Высокий риск — усиленная защита' : '🔴 Критический — максимальная защита'}
                    {hasJointSymptom ? ' · боль в суставах' : ''}{crp && crp > 3 ? ` · CRP ${crp}` : ''}
                  </div>

                  <DomainSymptomMap domains={JOINT_DOMAINS} checked={jointSymptoms} onToggle={toggleJointSymptom} />

                  {/* Пресеты-протоколы */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#4ade80', marginBottom:5 }}>📋 Быстрые протоколы</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
                    {JOINT_PRESETS.map(p => {
                      const active = articularPreset === p.id;
                      return (
                        <div key={p.id} onClick={() => {
                          if (articularPreset === p.id) {
                            setArticularPreset(null);
                            setArticularSelected(new Set());
                          } else {
                            setArticularPreset(p.id);
                            setArticularSelected(new Set(p.subs));
                          }
                        }} style={{
                          padding:'7px 8px', borderRadius:8, cursor:'pointer',
                          background: active ? `${p.color}18` : 'rgba(255,255,255,0.02)',
                          border: active ? `1.5px solid ${p.color}55` : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontSize:14 }}>{p.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:9, fontWeight:700, color: active ? p.color : '#ffffff' }}>{p.name} {active && '✓'}</div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{p.desc}</div>
                            </div>
                          </div>
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {p.subs.map(sid => <span key={sid} style={{ background:'rgba(255,255,255,0.04)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,10)}</span>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Рекомендация по пресету */}
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginBottom:6, padding:'4px 8px', borderRadius:6, background:presetColor+'10', border:`1px solid ${presetColor}22` }}>
                    🔍 Рекомендованный: <b style={{color:presetColor}}>
                      {jointScore < 20 ? 'Ядро' : jointScore < 40 ? 'Ядро + База' : jointScore < 60 ? 'Ядро + База + Усиление' : 'Полный протокол (все фазы)'}
                    </b>
                  </div>

                  {/* Список веществ */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>💊 Выберите вещества ({articularSelected.size} из {JOINT_CATALOG.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
                    {JOINT_CATALOG.map(item => {
                      const selected = articularSelected.has(item.id);
                      const inPlan = planIds.has(canonIdLocal(item.id));
                      const isRecommended = jointRecSet.has(item.id);
                      const itemDomains = jointDomainOf(item.id);
                      return (
                        <div key={item.id} onClick={() => { if (!inPlan) toggleSub(item.id); }}
                          style={{
                            display:'flex', alignItems:'flex-start', gap:6, padding:'6px 8px', borderRadius:7, cursor: inPlan ? 'default' : 'pointer',
                            background: inPlan ? 'rgba(0,230,138,0.04)' : selected ? 'rgba(129,140,248,0.06)' : 'rgba(255,255,255,0.02)',
                            border: inPlan ? '1px solid rgba(0,230,138,0.12)' : selected ? '1px solid rgba(129,140,248,0.15)' : '1px solid rgba(255,255,255,0.04)',
                            opacity: inPlan ? 0.5 : 1,
                          }}>
                          <div style={{ width:18, height:18, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
                            background: inPlan ? 'rgba(0,230,138,0.15)' : selected ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.05)',
                            fontSize:10, fontWeight:700, color: inPlan ? '#00e68a' : selected ? '#818cf8' : 'rgba(255,255,255,0.3)' }}>
                            {inPlan ? '✓' : selected ? '✓' : ''}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                              <span style={{ fontSize:9, fontWeight:600, color: inPlan ? 'rgba(255,255,255,0.4)' : '#ffffff' }}>{item.nameRu}</span>
                              <span style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.4)', padding:'0px 3px', borderRadius:3, background:'rgba(255,255,255,0.04)' }}>{item.dose}</span>
                              {isRecommended && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', fontWeight:700 }}>рек.</span>}
                              {inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>в плане</span>}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:1 }}>{item.desc}</div>
                            {itemDomains.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                {itemDomains.map(d => (
                                  <span key={d.id} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:d.color+'18', color:d.color, fontWeight:600 }}>{d.label}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Кнопки действий */}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setStackModulePopup(null); setArticularConfirm(false); }} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>Отмена</button>
               <button onClick={() => {
                       if (articularSelected.size === 0) return;
                       setArticularConfirm(true);
                       setStackModulePopup(null);
                     }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', border:'none', color:'#000',
                       background: articularSelected.size > 0 ? 'linear-gradient(135deg,#4ade80,#22c55e)' : 'rgba(255,255,255,0.06)',
                     }}>
                       ✅ Добавить ({articularSelected.size} веществ)
                     </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // ── Нейропротекция: пресеты + выбор ──
        if (stackModulePopup === 'neuroprotection_stack') {
          const planIds = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
          const symptoms = (state as any).symptoms || [];
          const hasInsomnia = symptoms.includes('insomnia');
          const hasAnxiety = symptoms.includes('anxiety');
          const sleepHours = state.profile.sleepHours || 7;
          const stressLevel = state.profile.stressLevel || 5;
          const aggressionScore = state.neuro.aggressionScore || 0;
          const neuroScore = (hasInsomnia ? 20 : 0) + (hasAnxiety ? 15 : 0) + (sleepHours < 7 ? 15 : 0) + (stressLevel > 7 ? 20 : 0) + (aggressionScore > 6 ? 15 : 0);
          const presetColor = neuroScore < 20 ? '#22c55e' : neuroScore < 40 ? '#f59e0b' : neuroScore < 60 ? '#f97316' : '#ef4444';

          const toggleSub = (id: string) => { setNeuroSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
          const toggleNeuroSymptom = (code: string) => setNeuroSymptoms(prev => {
            const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next;
          });
          const neuroDomainScores = NEURO_DOMAINS.map(d => ({ d, score: Math.min(10, d.symptoms.filter(s => neuroSymptoms.has(s.code)).length * 3) }));
          const neuroRecSet = new Set<string>();
          neuroDomainScores.forEach(({ d, score }) => { if (score >= 6) d.substances.forEach(id => neuroRecSet.add(id)); });
          NEURO_RECOMMENDED_HIGH.forEach(id => neuroRecSet.add(id));
          NEURO_RECOMMENDED_MEDIUM.forEach(id => neuroRecSet.add(id));
          const neuroDomainOf = (id: string) => NEURO_DOMAINS.filter(d => d.substances.has(id));

          return (
            <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => { setStackModulePopup(null); setNeuroConfirm(false); }}>
               <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
                  <div style={{ height:3, background:'linear-gradient(90deg,#818cf8,#6366f1)' }} />
                 <div style={{ flex:'1 1 0%', minHeight:0, padding:'14px 14px 16px', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                   <span style={{ fontSize:13, fontWeight:800, color:'#818cf8' }}>🧠 Нейропротекция — подбор поддержки</span>
                   <button onClick={() => { setStackModulePopup(null); setNeuroConfirm(false); }} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:8, padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    {neuroScore < 20 ? '🟢 Низкий риск — профилактика' : neuroScore < 40 ? '🟡 Умеренный риск — базовая поддержка' : neuroScore < 60 ? '🟠 Высокий риск — усиленная защита' : '🔴 Критический — максимальная защита'}
                    {hasInsomnia ? ' · бессонница' : ''}{hasAnxiety ? ' · тревога' : ''}{sleepHours < 7 ? ` · сон ${sleepHours}ч` : ''}{stressLevel > 7 ? ` · стресс ${stressLevel}/10` : ''}
                  </div>

                  <DomainSymptomMap domains={NEURO_DOMAINS} checked={neuroSymptoms} onToggle={toggleNeuroSymptom} />

                  {/* Пресеты */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#818cf8', marginBottom:5 }}>📋 Быстрые протоколы</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
                    {NEURO_PRESETS.map(p => {
                      const active = neuroPreset === p.id;
                      return (
                        <div key={p.id} onClick={() => {
                          if (neuroPreset === p.id) { setNeuroPreset(null); setNeuroSelected(new Set()); }
                          else { setNeuroPreset(p.id); setNeuroSelected(new Set(p.subs)); }
                        }} style={{
                          padding:'7px 8px', borderRadius:8, cursor:'pointer',
                          background: active ? `${p.color}18` : 'rgba(255,255,255,0.02)',
                          border: active ? `1.5px solid ${p.color}55` : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontSize:14 }}>{p.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:9, fontWeight:700, color: active ? p.color : '#ffffff' }}>{p.name} {active && '✓'}</div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{p.desc}</div>
                            </div>
                          </div>
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {p.subs.slice(0,3).map(sid => <span key={sid} style={{ background:'rgba(255,255,255,0.04)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,12)}</span>)}
                            {p.subs.length > 3 && <span style={{ color:'rgba(255,255,255,0.2)' }}>+{p.subs.length-3}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginBottom:6, padding:'4px 8px', borderRadius:6, background:presetColor+'10', border:`1px solid ${presetColor}22` }}>
                    🔍 Рекомендованный: <b style={{color:presetColor}}>
                      {neuroScore < 20 ? 'Сон' : neuroScore < 40 ? 'Сон + Стресс' : neuroScore < 60 ? 'Сон + Стресс + Когнитив' : 'Полный протокол (все фазы)'}
                    </b>
                  </div>

                  {/* Вещества */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>💊 Выберите вещества ({neuroSelected.size} из {NEURO_CATALOG.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
                    {NEURO_CATALOG.map(item => {
                      const selected = neuroSelected.has(item.id);
                      const inPlan = planIds.has(canonIdLocal(item.id));
                      const isRecommended = neuroRecSet.has(item.id);
                      const itemDomains = neuroDomainOf(item.id);
                      return (
                        <div key={item.id} onClick={() => { if (!inPlan) toggleSub(item.id); }}
                          style={{
                            display:'flex', alignItems:'flex-start', gap:6, padding:'6px 8px', borderRadius:7, cursor: inPlan ? 'default' : 'pointer',
                            background: inPlan ? 'rgba(0,230,138,0.04)' : selected ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
                            border: inPlan ? '1px solid rgba(0,230,138,0.12)' : selected ? '1px solid rgba(99,102,241,0.15)' : '1px solid rgba(255,255,255,0.04)',
                            opacity: inPlan ? 0.5 : 1,
                          }}>
                          <div style={{ width:18, height:18, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
                            background: inPlan ? 'rgba(0,230,138,0.15)' : selected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                            fontSize:10, fontWeight:700, color: inPlan ? '#00e68a' : selected ? '#818cf8' : 'rgba(255,255,255,0.3)' }}>
                            {inPlan ? '✓' : selected ? '✓' : ''}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                              <span style={{ fontSize:9, fontWeight:600, color: inPlan ? 'rgba(255,255,255,0.4)' : '#ffffff' }}>{item.nameRu}</span>
                              <span style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.4)', padding:'0px 3px', borderRadius:3, background:'rgba(255,255,255,0.04)' }}>{item.dose}</span>
                              {isRecommended && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', fontWeight:700 }}>рек.</span>}
                              {inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>в плане</span>}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:1 }}>{item.desc}</div>
                            {itemDomains.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                {itemDomains.map(d => (
                                  <span key={d.id} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:d.color+'18', color:d.color, fontWeight:600 }}>{d.label}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Safety-флаг: серотонин + СИОЗС */}
                  <div style={{ fontSize:7, color:'rgba(168,85,247,0.7)', lineHeight:1.35, marginTop:6, padding:'5px 8px', borderRadius:6, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.18)' }}>
                    ⚠️ При приёме СИОЗС/СИОЗСН (антидепрессанты) избегайте 5-HTP и L-триптофан — риск серотонинового синдрома. Стимуляторы (амфетамины/модафинил): не добавляйте ночные дофаминергики.
                  </div>

                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setStackModulePopup(null); setNeuroConfirm(false); }} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>Отмена</button>
                     <button onClick={() => {
                       if (neuroSelected.size === 0) return;
                       setNeuroConfirm(true);
                       setStackModulePopup(null);
                     }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', border:'none', color:'#000',
                       background: neuroSelected.size > 0 ? 'linear-gradient(135deg,#818cf8,#6366f1)' : 'rgba(255,255,255,0.06)',
                     }}>
                       ✅ Добавить ({neuroSelected.size} веществ)
                     </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Старый попап для остальных модулей
        const { analysis, contextSummary } = analyzeStackModule(stackModulePopup, state, rec);
        const stackMeta = ALL_STACKS.find(s => s.id === stackModulePopup);
        const iconAndColor: Record<string, { icon: string; col: string }> = {
          mega_total_support_35: { icon: '🚀', col: '#f87171' },
        };
        const meta = iconAndColor[stackModulePopup] || { icon: '📦', col: '#818cf8' };
        const alreadyActive = selectedStacks.includes(stackModulePopup);
        const recommendedCount = analysis.filter(a => a.recommended && !a.inPlan).length;
        return (
           <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setStackModulePopup(null)}>
             <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:360, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
                <div style={{ height:3, background:`linear-gradient(90deg,${meta.col},${meta.col}88)` }} />
               <div style={{ flex:'1 1 0%', minHeight:0, padding:'16px 14px 16px', overflowY:'auto' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                 <span style={{ fontSize:13, fontWeight:800, color:meta.col }}>{meta.icon} {stackMeta?.name || stackModulePopup}</span>
                 <button onClick={() => setStackModulePopup(null)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', lineHeight:1.5, marginBottom:8 }}>{stackMeta?.problem || ''}</div>
                <div style={{ fontSize:10, fontWeight:700, color:'#ffffff', marginBottom:4 }}>📊 Анализ контекста</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.5, marginBottom:10, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  {contextSummary || 'Нет активных показаний'}
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:'#ffffff', marginBottom:6 }}>💊 Вещества в модуле ({analysis.length})</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
                  {analysis.map((a, i) => (
                    <div key={i} style={{ padding:'6px 8px', borderRadius:8, fontSize:8, background: a.inPlan ? 'rgba(0,230,138,0.06)' : a.recommended ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', border:`1px solid ${a.inPlan ? 'rgba(0,230,138,0.15)' : a.recommended ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                        <span style={{ fontWeight:700, color:'#ffffff' }}>{a.subName} <span style={{ color:'rgba(255,255,255,0.4)', fontWeight:500 }}>{a.dose}</span></span>
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
                  <button onClick={() => setStackModulePopup(null)} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>Отмена</button>
                  <button onClick={() => {
                    if (!alreadyActive) setSelectedStacks(prev => [...prev, stackModulePopup]);
                    setStackModulePopup(null);
                  }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', background: alreadyActive ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${meta.col},${meta.col}cc)`, border:'none', color: alreadyActive ? 'rgba(255,255,255,0.55)' : '#000' }}>
                    {alreadyActive ? '✓ Уже добавлен' : `Добавить модуль (${recommendedCount} рек.)`}
                  </button>
                </div>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginTop:6, textAlign:'center' }}>Модуль добавляется поверх пресета. Дубли с планом автоматически исключаются.</div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* ── Карточка подтверждения для суставного модуля ── */}
      {articularConfirm && !stackModulePopup && (
        <div style={{ marginBottom:8, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(22,163,74,0.04))', border:'2px solid rgba(34,197,94,0.25)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#22c55e', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
            🦴 Суставы/Связки — подтверждение
          </div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginBottom:5, lineHeight:1.3 }}>
            Выбрано <b style={{color:'#4ade80'}}>{articularSelected.size}</b> веществ:
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
            {Array.from(articularSelected).map(sid => (
              <span key={sid} style={{ fontSize:8, padding:'2px 6px', borderRadius:5, fontWeight:600, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.2)', color:'#4ade80' }}>
                {subNameRu(sid)}
              </span>
            ))}
          </div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.3 }}>
            Вещества будут добавлены в план поддержки. Дубли с уже назначенными автоматически исключаются.
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setArticularConfirm(false); setArticularPreset(null); setArticularSelected(new Set()); setStackModulePopup('articular_stack'); }}
              style={{ flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
              ✕ Отмена
            </button>
            <button onClick={() => {
              const newSubs = Array.from(articularSelected).filter(sid => !(rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid)));
              setAddedSubs(prev => [...new Set([...prev, ...newSubs])]);
              setArticularConfirm(false);
              setStackModulePopup(null);
              if (!selectedStacks.includes('articular_stack')) setSelectedStacks(prev => [...prev, 'articular_stack']);
            }} style={{ flex:2, padding:'8px', borderRadius:8, fontSize:9, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', color:'#000' }}>
              ✅ Подтвердить и добавить в план
            </button>
          </div>
        </div>
      )}

      {/* ── Карточка подтверждения для нейропротекторного модуля ── */}
      {neuroConfirm && !stackModulePopup && (
        <div style={{ marginBottom:8, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(79,70,229,0.04))', border:'2px solid rgba(99,102,241,0.25)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#818cf8', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
            🧠 Нейропротекция — подтверждение
          </div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginBottom:5, lineHeight:1.3 }}>
            Выбрано <b style={{color:'#a5b4fc'}}>{neuroSelected.size}</b> веществ:
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
            {Array.from(neuroSelected).map(sid => (
              <span key={sid} style={{ fontSize:8, padding:'2px 6px', borderRadius:5, fontWeight:600, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc' }}>
                {subNameRu(sid)}
              </span>
            ))}
          </div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.3 }}>
            Вещества будут добавлены в план поддержки. Дубли с уже назначенными автоматически исключаются.
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setNeuroConfirm(false); setNeuroPreset(null); setNeuroSelected(new Set()); setStackModulePopup('neuroprotection_stack'); }}
              style={{ flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
              ✕ Отмена
            </button>
            <button onClick={() => {
              const newSubs = Array.from(neuroSelected).filter(sid => !(rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid)));
              setAddedSubs(prev => [...new Set([...prev, ...newSubs])]);
              setNeuroConfirm(false);
              setStackModulePopup(null);
              if (!selectedStacks.includes('neuroprotection_stack')) setSelectedStacks(prev => [...prev, 'neuroprotection_stack']);
            }} style={{ flex:2, padding:'8px', borderRadius:8, fontSize:9, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,#818cf8,#6366f1)', border:'none', color:'#000' }}>
              ✅ Подтвердить и добавить в план
            </button>
          </div>
        </div>
      )}

      {/* ===== КАРТОЧКА СИМПТОМОВ ===== */}
      <div style={{ margin:'6px 0', borderRadius:10, overflow:'hidden' }}>
        <div onClick={() => setShowSymptoms(!showSymptoms)} style={{ padding:'7px 9px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius: showSymptoms ? '10px 10px 0 0' : 10 }}>
          <span style={{ fontSize:9, fontWeight:700, color:'#818cf8' }}>
            🩺 Симптомы (отметьте актуальные) {symptoms.length > 0 ? `(${symptoms.length})` : ''}
          </span>
          <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showSymptoms ? '▲ скрыть' : '▼ показать'}</span>
        </div>
        {showSymptoms && (
          <div style={{ padding:'7px 9px', background:'rgba(99,102,241,0.03)', border:'1px solid rgba(99,102,241,0.1)', borderTop:'none', borderRadius:'0 0 10px 10px', display:'flex', flexWrap:'wrap', gap:3 }}>
            {([
              ['gynecomastia','Гино'],['edema_severe','Отёки'],['joint_pain','Суставы'],
              ['insomnia','Бессонница'],['anxiety','Тревога'],['low_libido','Либидо↓'],
              ['hair_loss','Выпадение волос'],['prostate_symptoms','Простата'],
              ['headache','Головная боль'],['palpitations','Сердцебиение'],
              ['acne','Акне'],['mood_swings','Настроение'],
              ] as const).map(([sym, label]) => {
              const active = symptoms.includes(sym);
              return (
                <button key={sym} onClick={() => setSymptoms(prev => active ? prev.filter(s => s !== sym) : [...prev, sym])}
                  style={{ padding:'3px 7px', borderRadius:6, fontSize:8, fontWeight:600, cursor:'pointer', border:`1px solid ${active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`, background: active ? 'rgba(99,102,241,0.15)' : 'transparent', color: active ? '#a5b4fc' : 'rgba(255,255,255,0.55)' }}>
                  {active ? '✓' : ''} {label}
                </button>
              );
            })}
          </div>
        )}
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
        <div style={{ fontSize:8, fontWeight:500, color:'rgba(255,255,255,0.55)', marginBottom:6, lineHeight:1.4 }}>
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

      {/* ===== РУЧНОЙ РЕЖИМ: всегда видимый план из выбранных стеков ===== */}
      {level === 'manual' && manualResultSubs.length > 0 && (
        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.22)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:800, color:'#c084fc' }}>📦 Ручной план: {manualResultSubs.length} препарат(ов) из {selectedStacks.length} стеков</span>
            <button onClick={() => setShowManualPopup(true)} style={{ fontSize:11, fontWeight:700, cursor:'pointer', padding:'4px 9px', borderRadius:6, background:'rgba(168,85,247,0.14)', border:'1px solid rgba(168,85,247,0.3)', color:'#c084fc' }}>⚙️ Изменить</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {manualResultSubs.map((ms) => {
              const cat = SUPPORT_CATALOG_DATA[ms.id];
              return (
                <div key={ms.id} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontWeight:600, color:'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || ms.id}</span>
                  {ms.dose && <span style={{ color:'#00e68a', marginLeft:4 }}>{ms.dose}</span>}
                  {ms.timing && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:4 }}>{ms.timing}</span>}
                  <span style={{ color:'rgba(255,255,255,0.3)', marginLeft:4, fontSize:10 }}>· {ms.stack}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== НАЗНАЧЕНИЕ (результат) ===== */}
      {finalRec && finalRec.subs.length > 0 && (
        <div>
          <div onClick={() => setShowPrescription(!showPrescription)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#ffffff', display:'flex', alignItems:'center', gap:4 }}>
              💊 Назначено {finalRec.subs.length} препаратов
              {finalRec.titrationFactors && finalRec.titrationFactors.size > 0 && (
                <span style={{ fontSize:8, fontWeight:600, color:'#f59e0b', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.15)' }}>↑{finalRec.titrationFactors.size}</span>
              )}
            </span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showPrescription ? '▲ скрыть' : '▼ показать'}</span>
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

      {/* ===== ТОКСИКОЛОГИЧЕСКИЙ КОНТРОЛЬ ДОЗ (UL + титрация) ===== */}
      {finalRec && toxWarnings.length > 0 && (
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4, display:'flex', alignItems:'center', gap:4 }}>
            ⚠️ Контроль дозировок ({toxWarnings.length})
          </div>
          {toxWarnings.map((w, i) => {
            const isDanger = w.severity === 'danger';
            const isTitr = w.severity === 'titrate';
            const col = isDanger ? '#ef4444' : isTitr ? '#f59e0b' : '#fbbf24';
            const bg = isDanger ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)';
            const bd = isDanger ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.2)';
            const tag = isDanger ? 'ПРЕВЫШЕН UL' : isTitr ? 'ТИТРАЦИЯ' : 'ВНИМАНИЕ';
            return (
              <div key={i} style={{ margin:'3px 0', padding:'6px 8px', borderRadius:8, background:bg, border:`1px solid ${bd}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
                  <span style={{ fontSize:7, fontWeight:800, color:col, padding:'1px 5px', borderRadius:4, background:bg, border:`1px solid ${bd}` }}>{tag}</span>
                  <span style={{ fontSize:9, fontWeight:700, color:'#ffffff' }}>{subNameRu(w.substanceId)}</span>
                </div>
                <div style={{ fontSize:8, color:col, lineHeight:1.4 }}>{w.message}</div>
                {w.percentUL > 0 && <div style={{ fontSize:7, color:'rgba(255,255,255,0.55)', marginTop:2, lineHeight:1.4 }}>→ {w.percentUL}% от {isTitr ? 'оптимума' : 'UL'} ({w.totalDose} / {w.ul} мг)</div>}
              </div>
            );
          })}
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:3 }}>UL — верхний допустимый предел (элементарное вещество). Титрация — доза выше клинического оптимума, рекомендуется циклирование.</div>
        </div>
      )}

      {/* ===== СИНЕРГИЯ СТЕКА ===== */}
      {finalRec && synergyDesc.length > 0 && (
        <div style={{ marginTop:8 }}>
          <div onClick={() => setShowSynergy(!showSynergy)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:4 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#a78bfa' }}>🧬 Синергия стека поддержки</span>
            <span style={{ fontSize:7, color:'rgba(255,255,255,0.55)' }}>{showSynergy ? '▲' : '▼'}</span>
          </div>
          {showSynergy && (
            <div style={{ padding:'6px 10px', borderRadius:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.12)' }}>
              {synergyDesc.map((s, i) => <div key={i} style={{ fontSize:8, color:'#c4b5fd', marginBottom:3, lineHeight:1.5 }}>{s}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Нутри-корректировки по анализам */}
      {finalRec && finalRec.nutritionTips && finalRec.nutritionTips.length > 0 && (() => {
        const tipsByMarker: Record<string, { action: string; target: string; tier: number }[]> = {};
        for (const t of finalRec.nutritionTips!) {
          const m = (t as any).marker || 'общее';
          if (!tipsByMarker[m]) tipsByMarker[m] = [];
          tipsByMarker[m].push({ action: t.action, target: t.target, tier: (t as any).tier || 1 });
        }
        const markers = Object.keys(tipsByMarker);
        const total = finalRec.nutritionTips.length;
        const hasHigh = finalRec.nutritionTips.some((t: any) => t.tier >= 2);

        return (
        <div style={{ marginTop:6 }}>
          <div onClick={() => setShowNutrition(!showNutrition)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showNutrition ? '8px 8px 0 0' : 8, background: hasHigh ? 'rgba(245,158,11,0.06)' : 'rgba(0,230,138,0.04)', border:'1px solid ' + (hasHigh ? 'rgba(245,158,11,0.15)' : 'rgba(0,230,138,0.12)') }}>
            <span style={{ fontSize:10, fontWeight:700, color: hasHigh ? '#f59e0b' : '#22c55e', display:'flex', alignItems:'center', gap:5 }}>
              🥗 Питание по анализам ({total})
              {hasHigh && <span style={{ fontSize:7, fontWeight:600, color:'#f59e0b', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.12)' }}>требует коррекции</span>}
            </span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showNutrition ? '▲ скрыть' : '▼ показать'}</span>
          </div>
          {showNutrition && (
            <div style={{ padding:'6px 9px', background:'rgba(0,0,0,0.15)', border:'1px solid ' + (hasHigh ? 'rgba(245,158,11,0.1)' : 'rgba(0,230,138,0.08)'), borderTop:'none', borderRadius:'0 0 8px 8px' }}>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:5, lineHeight:1.4 }}>
                Рекомендации по питанию на основе отклонений лабораторных маркеров. Сгруппированы по показателю.
              </div>
              {markers.map(marker => {
                const tips = tipsByMarker[marker];
                const maxTier = Math.max(...tips.map(t => t.tier));
                const tierColor = maxTier >= 3 ? '#ef4444' : maxTier >= 2 ? '#f59e0b' : '#22c55e';
                const tierBg = maxTier >= 3 ? 'rgba(239,68,68,0.06)' : maxTier >= 2 ? 'rgba(245,158,11,0.05)' : 'rgba(34,197,94,0.04)';
                const tierBorder = maxTier >= 3 ? 'rgba(239,68,68,0.12)' : maxTier >= 2 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.08)';
                const tierLabel = maxTier >= 3 ? '⛔ Критично' : maxTier >= 2 ? '⚠ Требует внимания' : '🟢 Профилактика';
                return (
                  <div key={marker} style={{ marginBottom:5, padding:'5px 7px', borderRadius:6, background:tierBg, border:`1px solid ${tierBorder}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                      <span style={{ fontSize:8, fontWeight:700, color:'#ffffff' }}>{marker.toUpperCase()}</span>
                      <span style={{ fontSize:7, fontWeight:600, color:tierColor, padding:'1px 4px', borderRadius:3, background:`${tierColor}15` }}>{tierLabel}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      {tips.map((t, i) => (
                        <div key={i} style={{ fontSize:8, color:'rgba(240,240,245,0.9)', lineHeight:1.4, display:'flex', gap:4 }}>
                          <span style={{ color:tierColor, flexShrink:0, fontWeight:700 }}>{maxTier >= 2 ? '⚠' : '•'}</span>
                          <span>
                            <span style={{ fontWeight:600, color:'#ffffff' }}>{t.action}</span>
                            <span style={{ opacity:0.6, marginLeft:4 }}>→ {t.target}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        );
      })()}

      {/* Warnings: multi-oral, GH+insulin, winny+oxy */}
      {finalRec && (() => {
        const warnings: string[] = [];
        const flags = finalRec.pedFlags;
        if (flags) {
          if (flags.isMultiOral) warnings.push('⚠ Более 1 орального 17α — резко ↑ гепатотоксичность');
          if (flags.isGHPlusInsulin) warnings.push('⚠ GH + Инсулин — высокий риск гипогликемии');
          if (flags.isWinnyPlusOxy) warnings.push('🛑 WINSTROL + ANADROL — критическая комбинация (гепатотоксичность + ↓HDL до 50%). ОБЯЗАТЕЛЬНЫЙ протокол защиты включён. LFT каждые 2 нед, не дольше 4 нед');
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

      {/* Динамический график мониторинга (из движка по PED/фазе) */}
      {finalRec && finalRec.monitoringPlan && (
        <div style={{ marginTop:6 }}>
          <div onClick={() => setShowMonitoringPlan(!showMonitoringPlan)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showMonitoringPlan ? '8px 8px 0 0' : 8, background:'rgba(96,165,250,0.07)', border:'1px solid rgba(96,165,250,0.18)' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#60a5fa', display:'flex', alignItems:'center', gap:5 }}>
              🩻 График мониторинга анализов
              <span style={{ fontSize:7, fontWeight:600, color:'rgba(96,165,250,0.5)', padding:'1px 5px', borderRadius:4, background:'rgba(96,165,250,0.1)' }}>по вашему курсу</span>
            </span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showMonitoringPlan ? '▲ скрыть' : '▼ показать'}</span>
          </div>
          {showMonitoringPlan && (
            <div style={{ padding:'8px 9px', background:'rgba(96,165,250,0.03)', border:'1px solid rgba(96,165,250,0.1)', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:5, lineHeight:1.4 }}>
                Персональный график лабораторного контроля, сформированный по вашим препаратам и фазе курса.
              </div>
              {finalRec.monitoringPlan.split('\n').filter(Boolean).map((line, i) => (
                <div key={i} style={{ fontSize:8, color:'rgba(240,240,245,0.9)', lineHeight:1.5, marginBottom:3, paddingLeft:8, borderLeft:'2px solid rgba(96,165,250,0.3)' }}>{line}</div>
              ))}
</div>
      )}
    </div>
  )}

      {/* Прогноз ребаунда гормонов после отмены */}
      {finalRec && (() => {
        // Build ReboundInput from context
        const peds = (ctx.pedDoses || ctx.aasIds?.map((id: string) => ({ id, pClass: 'aas_unknown' })) || []);
        if (!peds.length) return null;
        
        // Lazy import to avoid circular deps
        const { calculateReboundTrajectory, getReboundSummary } = require('../../../engines/rebound-modeling.engine');
        
        const cycleWeeks = state.goals?.cycleWeeks || 12;
        const pctProtocol = rec?.pedFlags?.hasTest ? 'hcg+clomid' : 'clomid+nolva';

        const fp: any = state.labs?.fullPanel || {};
        const reboundInput: any = {
          peds: peds.map((p: any) => ({ id: p.id, pClass: p.pClass, mgPerWeek: p.mgPerWeek, iuPerDay: p.iuPerDay, mcgPerDay: p.mcgPerDay })),
          cycleWeeks,
          pctProtocol,
          pctStartWeek: undefined,
          userProfile: {
            age: state.profile?.age || 30,
            baselineTT: fp.TESTOSTERONE || 650,
            baselineE2: fp.ESTRADIOL || 28,
            baselinePRL: fp.PROLACTIN || 14,
            baselineCortisol: fp.CORTISOL || 450,
            baselineSHBG: fp.SHBG || 30,
            baselineLH: fp.LH || 5,
            baselineFSH: fp.FSH || 4,
          },
        };
        
        try {
          const rebound = calculateReboundTrajectory(reboundInput);
          const summary = getReboundSummary(rebound);
          
          return (
            <div style={{ marginTop:6 }}>
              <div onClick={() => setShowRebound(!showRebound)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showRebound ? '8px 8px 0 0' : 8, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.18)' }}>
                <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b', display:'flex', alignItems:'center', gap:5 }}>
                  📉 Прогноз ребаунда после отмены
                  <span style={{ fontSize:7, fontWeight:600, color:'rgba(245,158,11,0.5)', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.1)' }}>по вашему курсу</span>
                </span>
                <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showRebound ? '▲ скрыть' : '▼ показать'}</span>
              </div>
              {showRebound && (
                <div style={{ padding:'8px 9px', background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.1)', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:5, lineHeight:1.4 }}>
                    Прогноз восстановления гормонов за 24 недели после курса. Основан на ПК-фармакокинетике, ПКТ и клинических базах.
                  </div>
                  
                  {/* Summary cards */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:6, marginBottom:8 }}>
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#f59e0b' }}>Восстановление</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{rebound.overallRecoveryWeek || '?'} нед</div>
                    </div>
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#22c55e' }}>HPTA (LH+FSH+TT)</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{rebound.hptaRecoveryWeek || '?'} нед</div>
                    </div>
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#ef4444' }}>E2 ребаунд</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{rebound.e2.overshootWeek ? `пик нед ${rebound.e2.overshootWeek}` : 'нет'} / rec {rebound.e2.recoveredWeek || '?'} нед</div>
                    </div>
                  </div>
                  
                  {/* Per-marker mini cards */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {['tt','ft','e2','prl','lh','fsh','cortisol','shbg'].map(marker => {
                      const t = rebound[marker as keyof typeof rebound];
                      if (!t) return null;
                      const recColor = t.recoveredWeek && t.recoveredWeek <= 12 ? '#22c55e' : t.recoveredWeek && t.recoveredWeek <= 20 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={marker} style={{ padding:'5px 7px', borderRadius:5, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', minWidth:80 }}>
                          <div style={{ fontSize:7, fontWeight:700, color:marker === 'e2' ? '#f59e0b' : marker === 'prl' ? '#ec4899' : marker === 'cortisol' ? '#ef4444' : '#fff' }}>
                            {marker.toUpperCase()}
                          </div>
                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>
                            {t.recoveredWeek ? `${t.recoveredWeek} нед` : '—'}
                            {t.overshootWeek && <span style={{ color:'#f59e0b', marginLeft:2 }}>↑{t.overshootWeek}</span>}
                          </div>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                            баз: {t.baseline.toFixed(1)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Risk flags */}
                  {rebound.riskFlags.length > 0 && (
                    <div style={{ marginTop:8, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#ef4444', marginBottom:3 }}>⚠ Риск-факторы</div>
                      {rebound.riskFlags.map((rf: string, i: number) => (
                        <div key={i} style={{ fontSize:8, color:'#fca5a5', marginBottom:2, lineHeight:1.4, paddingLeft:10, borderLeft:'2px solid rgba(239,68,68,0.3)' }}>{rf}</div>
                      ))}
                    </div>
                  )}
                  
                  {/* Clinical notes */}
                  <div style={{ marginTop:8, padding:'6px 8px', borderRadius:6, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.12)' }}>
                    <div style={{ fontSize:7, fontWeight:700, color:'#60a5fa', marginBottom:3 }}>📋 Клинические заметки</div>
                    {['tt','ft','e2','prl','lh','fsh','cortisol','shbg'].flatMap(marker => {
                      const t = rebound[marker as keyof typeof rebound];
                      return t?.clinicalNotes?.map((note: string, i: number) => (
                        <div key={`${marker}-${i}`} style={{ fontSize:8, color:'rgba(240,240,245,0.9)', marginBottom:1, lineHeight:1.4, paddingLeft:8, borderLeft:'2px solid rgba(96,165,250,0.3)' }}>{note}</div>
                      )) || [];
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        } catch {
          return null;
        }
      })()}
      {finalRec && finalRec.subs.length > 1 && (() => {
        const interactions = checkInteractions(finalRec.subs.map(s => s.substanceId));
        if (interactions.length === 0) return null;

        function fmtSub(id: string): string {
          if (id.startsWith('@')) {
            const classLabels: Record<string, string> = {
              '@statin': 'статины', '@raas': 'РААС-препараты (ACEi/ARB)',
              '@antidiabetic': 'антидиабетические', '@macrolide': 'макролиды',
              '@anticoagulant': 'антикоагулянты', '@cyp3a4_inhibitor': 'CYP3A4-ингибиторы',
              '@cyp3a4_substrate': 'CYP3A4-субстраты', '@alpha_blocker': 'α-блокаторы',
              '@d2_antagonist': 'D2-антагонисты', '@alcohol': 'алкоголь',
              '@nsaid': 'НПВС', '@contrast': 'контрастные вещества',
              '@ssri': 'СИОЗС', '@tetracycline': 'тетрациклины',
              '@levothyroxine': 'L-тироксин',
            };
            return classLabels[id] || id;
          }
          return subNameRu(id);
        }

        const groups: Record<string, DrugInteraction[]> = { block: [], warn: [], monitor: [] };
        for (const intr of interactions) {
          groups[intr.severity].push(intr);
        }

        const hasBlock = groups.block.length > 0;
        const total = interactions.length;
        const sevLabel: Record<string, string> = { block: '⛔ Запрещено', warn: '⚠ Осторожно', monitor: '🔬 Контроль' };
        const sevColor: Record<string, string> = { block: '#fca5a5', warn: '#fbbf24', monitor: '#60a5fa' };
        const sevBg: Record<string, string> = { block: 'rgba(239,68,68,0.08)', warn: 'rgba(245,158,11,0.06)', monitor: 'rgba(96,165,250,0.04)' };

        return (
          <div style={{ marginTop:6 }}>
            <div onClick={() => setShowInteractions(!showInteractions)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showInteractions ? '8px 8px 0 0' : 8, background: hasBlock ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.05)', border:'1px solid ' + (hasBlock ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.12)') }}>
              <span style={{ fontSize:10, fontWeight:700, color: hasBlock ? '#ef4444' : '#f59e0b', display:'flex', alignItems:'center', gap:5 }}>
                {hasBlock ? '⛔ Взаимодействия' : '⚠ Взаимодействия'} ({total})
                <span style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.3)' }}>
                  {groups.block.length > 0 && `⛔${groups.block.length} `}
                  {groups.warn.length > 0 && `⚠${groups.warn.length} `}
                  {groups.monitor.length > 0 && `🔬${groups.monitor.length}`}
                </span>
              </span>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showInteractions ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showInteractions && (
              <div style={{ padding:'6px 9px', background:'rgba(0,0,0,0.12)', border:'1px solid ' + (hasBlock ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.08)'), borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:5, lineHeight:1.4 }}>
                  Проверено {finalRec.subs.length} веществ на попарные взаимодействия. Учитываются фармакокинетика (CYP450, транспортёры) и фармакодинамика.
                </div>
                {(['block', 'warn', 'monitor'] as const).map(sev => {
                  const items = groups[sev];
                  if (items.length === 0) return null;
                  return (
                    <div key={sev} style={{ marginBottom:5, padding:'5px 7px', borderRadius:6, background:sevBg[sev], border:`1px solid ${sevColor[sev]}18` }}>
                      <div style={{ fontSize:8, fontWeight:700, color:sevColor[sev], marginBottom:3 }}>{sevLabel[sev]} ({items.length})</div>
                      {items.map((intr, i) => (
                        <div key={i} style={{ fontSize:8, color:sevColor[sev], marginBottom:3, lineHeight:1.4, paddingLeft:2 }}>
                          <div style={{ fontWeight:700, marginBottom:1 }}>
                            <span style={{ fontSize:9, marginRight:2 }}>{sev === 'block' ? '⛔' : sev === 'warn' ? '⚠' : '🔬'}</span>
                            <span style={{ color:'#fff' }}>{fmtSub(intr.a)}</span>
                            <span style={{ opacity:0.5, margin:'0 3px' }}>+</span>
                            <span style={{ color:'#fff' }}>{fmtSub(intr.b)}</span>
                          </div>
                          <div style={{ opacity:0.8, marginBottom:1 }}>
                            <span style={{ fontWeight:600, opacity:0.6 }}>Механизм: </span>{intr.reason}
                          </div>
                          <div style={{ fontSize:7, opacity:0.6 }}>
                            <span style={{ fontWeight:600 }}>Действие: </span>{intr.action}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
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
          <div style={{ marginTop:6 }}>
            <div onClick={() => setShowContraindications(!showContraindications)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showContraindications ? '8px 8px 0 0' : 8, background: hasAbs ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border:'1px solid ' + (hasAbs ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)') }}>
              <span style={{ fontSize:10, fontWeight:700, color: hasAbs ? '#ef4444' : '#f59e0b' }}>
                {hasAbs ? '⛔ Противопоказания' : '⚠ Противопоказания и осторожности'} ({total})
              </span>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showContraindications ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showContraindications && (
              <div style={{ padding:'6px 9px 8px', background: hasAbs ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.03)', border:'1px solid ' + (hasAbs ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)'), borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                {Object.entries(grouped).map(([id, g]) => {
                  const all = [...g.abs, ...g.rel];
                  return (
                    <div key={id} style={{ marginBottom: all.length > 0 ? 4 : 0 }}>
                      <div style={{ fontSize:8, fontWeight:700, color:'#ffffff', marginBottom:2, marginTop:1 }}>{subNameRu(id)}</div>
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
            )}
          </div>
        );
      })()}

      {/* ===== МОНИТОРИНГ АНАЛИЗОВ (врачебный протокол) ===== */}
      {finalRec && finalRec.subs.length > 0 && (() => {
        const subs = finalRec.subs;
        const hasHepatic = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('liv')));
        const hasCardio = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('cv')));
        const hasRenal = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('ren')));
        const hasHemat = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('hem')));
        const hasCns = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('cns')));
        const hasRepro = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('rep')));

        // ── Персональный список маркеров, привязанный к конкретным веществам плана ──
        const personalMarkers = (() => {
          const map: Record<string, { what: string; when: string; target: string; subs: string[] }> = {};
          for (const s of subs) {
            const cat = SUPPORT_CATALOG_DATA[s.substanceId];
            if (!cat?.monitoring) continue;
            for (const m of cat.monitoring) {
              const key = (m.what || '').trim().toLowerCase();
              if (!key) continue;
              if (!map[key]) map[key] = { what: m.what, when: m.when || '', target: m.targetRange || '', subs: [] };
              const nm = cat.nameRu || cat.name || s.substanceId;
              if (!map[key].subs.includes(nm)) map[key].subs.push(nm);
            }
          }
          return Object.values(map).sort((a, b) => b.subs.length - a.subs.length);
        })();

        // ── Ведущие вещества по каждой системе (привязка панелей к плану) ──
        const driversBySystem: Record<string, string[]> = {
          hep: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('liv'))).map(s => subNameRu(s.substanceId)),
          cardio: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('cv'))).map(s => subNameRu(s.substanceId)),
          renal: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('ren'))).map(s => subNameRu(s.substanceId)),
          hema: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('hem'))).map(s => subNameRu(s.substanceId)),
          horm: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('rep'))).map(s => subNameRu(s.substanceId)),
          meta: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('hem') || m.startsWith('cv'))).map(s => subNameRu(s.substanceId)),
          thy: subs.filter(s => ['selenium', 'iodine', 't3', 't4'].includes(s.substanceId)).map(s => subNameRu(s.substanceId)),
          vit: subs.map(s => subNameRu(s.substanceId)),
        };

        return (
          <div style={{ marginTop:6 }}>
            <div onClick={() => setShowMonitoring(!showMonitoring)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showMonitoring ? '8px 8px 0 0' : 8, background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)' }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#60a5fa', display:'flex', alignItems:'center', gap:5 }}>
                🩻 Мониторинг анализов и показателей
                <span style={{ fontSize:7, fontWeight:600, color:'rgba(96,165,250,0.5)', padding:'1px 5px', borderRadius:4, background:'rgba(96,165,250,0.1)' }}>врачебный протокол</span>
              </span>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showMonitoring ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showMonitoring && (
              <div style={{ padding:'8px 9px', background:'rgba(96,165,250,0.03)', border:'1px solid rgba(96,165,250,0.1)', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                {/* ── Витальные показатели (ежедневно) ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#93c5fd', marginBottom:3 }}>📊 Витальные показатели (ежедневно)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#f87171', marginBottom:1 }}>❤️ АД (утром, покой)</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>Цель: &lt;130/85 (идеал &lt;120/80)<br/>При ↑ &gt;140/90 — коррекция</div>
                    </div>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#fbbf24', marginBottom:1 }}>💓 ЧСС (утром, покой)</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>Цель: 60–80 уд/мин<br/>Тахикардия &gt;90 — ЭКГ, коррекция</div>
                    </div>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#4ade80', marginBottom:1 }}>⚖️ Вес (еженедельно)</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>Контроль задержки воды<br/>↑ &gt;2 кг/нед — отёки, Na⁺</div>
                    </div>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#a78bfa', marginBottom:1 }}>🌡️ Температура</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>При симптомах — инфекция<br/>↑ на фоне ААС — риск абсцесса</div>
                    </div>
                  </div>
                </div>

                {/* ── Лабораторный мониторинг ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#60a5fa', marginBottom:3 }}>🧪 Лабораторный мониторинг</div>

                  {/* Персональный список маркеров (привязка к веществам плана) */}
                  <div style={{ padding:'6px 7px', borderRadius:6, background:'rgba(96,165,250,0.10)', border:'1px solid rgba(96,165,250,0.18)', marginBottom:4 }}>
                    <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', marginBottom:3 }}>🎯 Персональные маркеры ({personalMarkers.length}) — по вашему плану из {subs.length} веществ</div>
                    {personalMarkers.length === 0 && (
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>Для назначенных веществ не заданы специфические маркеры мониторинга — см. базовые панели ниже.</div>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {personalMarkers.map((m, mi) => (
                        <div key={mi} style={{ padding:'4px 6px', borderRadius:5, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize:7, fontWeight:700, color:'#bfdbfe', marginBottom:1 }}>{m.what}</div>
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.55)', lineHeight:1.4 }}>
                            <span style={{ color:'#94a3b8', fontWeight:600 }}>Когда:</span> {m.when || '—'}
                            {m.target ? <> · <span style={{ color:'#94a3b8', fontWeight:600 }}>Цель:</span> {m.target}</> : null}
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                            {m.subs.map((sn, si) => (
                              <span key={si} style={{ fontSize:6, color:'#e2e8f0', padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.14)', border:'1px solid rgba(96,165,250,0.22)' }}>{sn}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.12)', marginBottom:4 }}>
                    <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', marginBottom:2 }}>⏱️ Периодичность сдачи</div>
                    <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>
                      <span style={{ color:'#60a5fa', fontWeight:600 }}>До курса:</span> полная базовая панель (все маркеры ниже)<br/>
                      <span style={{ color:'#fbbf24', fontWeight:600 }}>На курсе:</span> каждые <b>4 недели</b> (общий + биохимия + гормоны)<br/>
                      <span style={{ color:'#4ade80', fontWeight:600 }}>ПКТ:</span> каждые <b>2–4 недели</b> (гормональная панель + печень)<br/>
                      <span style={{ color:'#a78bfa', fontWeight:600 }}>После ПКТ:</span> через <b>8–12 недель</b> (контроль восстановления)
                    </div>
                  </div>
                </div>

                {/* ── Панели по системам (с привязкой к веществам) ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#ffffff', marginBottom:4 }}>📋 Системные панели ({subs.length} веществ в плане)</div>

                  {[{ id:'hep', icon:'🫁', name:'Печёночная панель', color:'#f59e0b', active:hasHepatic, markers:'АЛТ, АСТ, ГГТ, ЩФ, билирубин общий/прямой, альбумин, ПТИ', freq:'Каждые 4 нед', targets:'АЛТ/АСТ <40 Ед/л, ГГТ <55, билирубин <21 мкмоль/л', alert:'АЛТ >80 → снижение доз · >200 → СТОП' },
                    { id:'cardio', icon:'❤️', name:'Кардио-липидная панель', color:'#f87171', active:hasCardio, markers:'ЛПНП, ЛПВП, ТГ, АпоВ, Лп(а), hs-СРБ, Д-димер, тропонин I (при боли)', freq:'Каждые 4 нед', targets:'ЛПНП <2.6, ЛПВП >1.0, ТГ <1.7, hs-СРБ <1.0', alert:'ЛПНП >4.0 → статины · Д-димер >0.5 → УЗДГ вен' },
                    { id:'renal', icon:'💧', name:'Почечная панель', color:'#38bdf8', active:hasRenal, markers:'Креатинин, рСКФ (CKD-EPI), цистатин C, мочевина, мочевая кислота, электролиты (Na⁺, K⁺, Cl⁻), общий белок мочи, микроальбуминурия', freq:'Каждые 4 нед', targets:'Креатинин <115, рСКФ >90, K⁺ 3.5–5.0, микроальбумин <30 мг/сут', alert:'Креатинин >130 → УЗИ почек · K⁺ <3.5/>5.5 → ЭКГ' },
                    { id:'hema', icon:'🩸', name:'Гематологическая панель', color:'#ef4444', active:hasHemat, markers:'ОАК: HCT, Hgb, RBC, PLT, WBC, ретикулоциты, ферритин, сыв. железо, коагулограмма (МНО, АЧТВ)', freq:'Каждые 4 нед', targets:'HCT 40–50% (♂), Hgb 140–170 г/л, PLT 150–400×10⁹/л', alert:'HCT >54% → кровопускание · >60% → СТОП + госпитализация' },
                    { id:'horm', icon:'🧬', name:'Гормональная панель', color:'#a78bfa', active:hasRepro || subs.some(s => (s.mechsCovered||[]).some(m => m.startsWith('rep')||m.startsWith('hem'))), markers:'Тестостерон общ./своб., эстрадиол (чувств.), пролактин, ЛГ, ФСГ, SHBG, кортизол (утро), ДГТ, прогестерон', freq:'Каждые 4 нед (на курсе), каждые 2 нед (ПКТ)', targets:'E2 20–50 пг/мл (♂ на курсе), пролактин <15 нг/мл, кортизол 140–690 нмоль/л', alert:'E2 >60 → ↑ИА · пролактин >25 → каберголин · ЛГ<1.0 → ХГЧ' },
                    { id:'meta', icon:'🍬', name:'Метаболическая панель', color:'#f97316', active:hasHemat || hasCardio, markers:'Глюкоза натощак, HbA1c, инсулин, HOMA-IR, гомоцистеин, СРБ', freq:'Каждые 4–8 нед', targets:'Глюкоза <5.6, HbA1c <5.7%, HOMA-IR <2.5, гомоцистеин <10', alert:'HbA1c >6.0 → метформин · глюкоза >11 → ER · HOMA-IR >3 → берберин' },
                    { id:'thy', icon:'🦋', name:'Тиреоидная панель', color:'#22d3ee', active:subs.some(s => s.substanceId === 'selenium' || s.substanceId === 'iodine' || s.substanceId === 't3' || s.substanceId === 't4'), markers:'ТТГ, Т3 своб., Т4 своб., АТ-ТПО', freq:'Каждые 8 нед (при приёме T3/T4 — каждые 4 нед)', targets:'ТТГ 0.4–4.0, Т3 св. 3.5–6.5, Т4 св. 11.5–22.7', alert:'ТТГ >4.5 → гипотиреоз · ТТГ <0.1 → гипертиреоз · ↑T3 → ↓дозу' },
                    { id:'vit', icon:'💊', name:'Витамины и минералы', color:'#4ade80', active:true, markers:'Витамин D (25-OH), B12, фолат, ферритин, Mg²⁺, Zn²⁺, Se, Ca²⁺ общ., фосфор', freq:'Каждые 8 нед', targets:'D3 50–80 нг/мл, B12 200–900, фолат >4, ферритин 50–200, Mg²⁺ 0.8–1.0, Zn²⁺ 70–140', alert:'D3 <30 → нагрузка 50K МЕ/нед · ферритин <30 → Fe²⁺ + vitC' },
                  ].map(panel => {
                    const drivers = driversBySystem[panel.id] || [];
                    return (
                    <div key={panel.id} style={{ padding:'5px 7px', borderRadius:6, marginBottom:3, background: panel.active ? `${panel.color}08` : 'rgba(255,255,255,0.01)', border:`1px solid ${panel.active ? panel.color+'18' : 'rgba(255,255,255,0.04)'}`, opacity: panel.active ? 1 : 0.6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                        <span style={{ fontSize:11 }}>{panel.icon}</span>
                        <span style={{ fontSize:8, fontWeight:700, color: panel.active ? panel.color : 'rgba(255,255,255,0.55)' }}>{panel.name}</span>
                        {!panel.active && <span style={{ fontSize:6, color:'rgba(255,255,255,0.3)', padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.04)' }}>плановая</span>}
                      </div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.5, marginLeft:16 }}>
                        <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>Маркеры:</span> {panel.markers}<br/>
                        <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>Частота:</span> {panel.freq}<br/>
                        <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>Цели:</span> {panel.targets}
                        {panel.active && <><br/><span style={{ fontWeight:600, color:panel.color }}>⚠ Тревога:</span> <span style={{ color:panel.color, opacity:0.85 }}>{panel.alert}</span></>}
                      </div>
                      {panel.active && drivers.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:3, marginLeft:16 }}>
                          <span style={{ fontSize:6, color:'rgba(255,255,255,0.4)' }}>вещества плана: </span>
                          {drivers.map((dn, di) => (
                            <span key={di} style={{ fontSize:6, color:'#e2e8f0', padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>{dn}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* ── Инструментальный мониторинг ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#a78bfa', marginBottom:3 }}>🖥️ Инструментальный мониторинг</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>ЭКГ</span><br/>Исходно + каждые 6 мес<br/>QTc, гипертрофия ЛЖ
                    </div>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>ЭхоКГ</span><br/>Ежегодно (GH/ААС &gt;1 года)<br/>ГЛЖ, ФВ, клапаны
                    </div>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>УЗИ печени</span><br/>Каждые 6 мес<br/>Стеатоз, фиброз, размер
                    </div>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>УЗИ почек</span><br/>Ежегодно<br/>Размер, паренхима, ЧЛС
                    </div>
                  </div>
                </div>

                {/* ── Дневник самоконтроля ── */}
                <div style={{ marginBottom:4 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#fbbf24', marginBottom:3 }}>📝 Дневник самоконтроля (ежедневно)</div>
                  <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.1)' }}>
                    <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.8 }}>
                      {[
                        ['❤️', 'АД утром (сист/диаст) + пульс'],
                        ['😴', 'Качество сна (1–5) + часы'],
                        ['😤', 'Настроение/агрессия (1–5)'],
                        ['🔥', 'Либидо (1–5)'],
                        ['⚖️', 'Вес утром (еженедельно)'],
                        ['💪', 'Отёки голеней/лица (да/нет)'],
                        ['🩺', 'Гинекомастия (нет / чувств. / уплотнение)'],
                        ['🧠', 'Головные боли / шум в ушах'],
                      ].map(([icon, text], i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ width:16, textAlign:'center', flexShrink:0 }}>{icon}</span>
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Экстренные показания ── */}
                <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ fontSize:7, fontWeight:700, color:'#fca5a5', marginBottom:2 }}>🚨 Немедленно обратиться к врачу:</div>
                  <div style={{ fontSize:6, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                    • АД &gt;160/100 на фоне покоя<br/>
                    • ЧСС &gt;120 в покое / аритмия<br/>
                    • Боль в груди / одышка / кровохарканье<br/>
                    • Желтуха (пожелтение кожи/склер)<br/>
                    • Отёки лица/голеней + олигурия (&lt;500 мл/сут)<br/>
                    • Сильная головная боль + нарушение зрения<br/>
                    • Судороги / потеря сознания<br/>
                    • Температура &gt;38.5°C + боль в месте инъекции (абсцесс)
                  </div>
                </div>

                {/* ===== ДИНАМИЧЕСКИЙ СЛОЙ БЕЗОПАСНОСТИ (з движка) ===== */}
                <CalcSafetyLayer rec={finalRec} planResult={planResult} />

              </div>
            )}
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