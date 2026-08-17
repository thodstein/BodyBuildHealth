import {
  type CalculatorState, type CalculatorResult, type RiskSystemId,
  type SynergyId, type TimelineWeekData,
  SYNERGY_ID_SUBSTANCES,
} from './types';
import {
  getBlacklist, canonId, sameClassIds, calcAllRisks, buildTzInput, tzToScores,
  synergyScoreWithPlan, conflictScoreWithPlan, applyTitration, calcLabDeltas,
  generateSchedule, checkDepletionCascade, checkUpperLimits, aggregateDailyLoad,
  toSystemRisksFromTz, toSystemRisks, getContraindicationAlerts,
  generateSynergyRecommendations,
  SYS_META, TZ_AUTO_BLACKLIST,
  PHASE_BLOCKLIST,
} from './engine-helpers';
import { evaluateRecommendations } from '../recommendation-engine';
import { calculateTzSpecRisk, calculateTzSpecRiskTimeline, type TzSpecInput, type TzSpecResult } from '../risk-engine-tz-spec';
import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { PHARMACY_DB } from '../../data/support-db/pharmacy-db';
import { getPrioritySubstances, getSubstancePriority, type SeverityLevel } from '../../data/lab-priority-map';
import { checkContraindications } from '../../data/substance-contraindications';
import { checkInteractions } from '../../data/drug-interactions';
import { resolvePlan } from '../tz-mapper-engine';
import type { SupportLevel } from '../tz-bridge-mechanism';
import { buildMapperCtx } from './mapper-ctx';

const AUTO_DOCTOR_ONLY = new Set([
  'warfarin', 'enoxaparin', 'sulodexide', 'lumbrokinase',
  'dipyridamole', 'pentoxifylline',
]);
const AUTO_PLAN_LIMIT: Record<string, number> = { basic: 28, mid: 40, max: 48, boost: 56 };
const COURSE_FOUNDATION = ['hydration', 'cardio_aerobic', 'electrolyte_balance', 'daily_steps', 'no_smoking', 'no_alcohol'];

function isAutoDoctorOnly(id: string): boolean {
  return AUTO_DOCTOR_ONLY.has(canonId(id));
}

// ═══════════════════════════════════════════════════════════════
//  ЕДИНСТВЕННЫЙ движок поддержки — calculateSupportTZ
//  Все вещества (mandatory + recommendations + TZ selection + boost +
//  joint + neuro + repro) попадают в ЕДИНЫЙ массив `substances`.
//  boostAdded / jointSubs / neuroSubs — ТОЛЬКО теги для UI-бейджей.
// ═══════════════════════════════════════════════════════════════

export function calculateSupportTZ(state: CalculatorState): CalculatorResult {
  try {
    const blacklist = getBlacklist(state);
    const synergyIds: SynergyId[] = [];
    const substances: string[] = [];
    const used = new Set<string>();
    const usedCanon = new Set<string>();

    const markUsed = (id: string) => {
      used.add(id);
      usedCanon.add(canonId(id));
      for (const alt of sameClassIds(id)) {
        used.add(alt);
        usedCanon.add(canonId(alt));
      }
    };
    const isUsed = (id: string): boolean => used.has(id) || usedCanon.has(canonId(id));
    for (const b of blacklist) { used.add(b); usedCanon.add(canonId(b)); }
    // Каберголин — только lab-gated. Не позволяем breadth/targeted подбору
    // автоматически протащить его в план при отсутствии подтверждённого PRL.
    const prlRaw = state.labs?.fullPanel?.panelSex?.Prolactin;
    const prlValue = prlRaw != null ? Number.parseFloat(String(prlRaw)) : NaN;
    const hasConfirmedPrl = Number.isFinite(prlValue) && prlValue > 25;
    if (!hasConfirmedPrl && !state.pharma.hasCaber) {
      used.add('cabergoline');
      usedCanon.add(canonId('cabergoline'));
    }
    // Phase-блэклист: Т-бустеры на курсе, AI на ПКТ и т.д.
    const phaseKey = state.pharma?.phase || 'course';
    const phaseBlocked = PHASE_BLOCKLIST[phaseKey];
    if (phaseBlocked) for (const b of phaseBlocked) { used.add(b); usedCanon.add(canonId(b)); }

    // Массив фазовых назначений (обоснования для UI).
    // Заполняется параллельно с markUsed, чтобы зафиксировать потерянную ранее логику.
    type PhaseDrug = {
      id: string;
      reason: string;
      trigger: string;
      category: string;
    };
    const phaseAssignedDrugs: PhaseDrug[] = [];
    const protocolWarnings: string[] = [];

    // ── 1. ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ: resolvePlan (тот же путь, что у CalcMapper) ──
    // Фармакологический протокол, фаза, база курса, PED-бустеры и lab-назначения
    // строятся ОДИН раз в tz-mapper-engine; calculateSupportTZ использует его же.
    let unifiedRec: ReturnType<typeof resolvePlan> | null = null;
    try {
      const unifiedLevel: SupportLevel = state.powerLevel === 'boost' ? 'max'
        : state.powerLevel === 'basic' ? 'base'
        : state.powerLevel === 'max' ? 'max' : 'medium';
      unifiedRec = resolvePlan(buildMapperCtx(state, unifiedLevel));
    } catch { unifiedRec = null; }
    const useLegacyMandatory = !unifiedRec || unifiedRec.subs.length === 0;
    if (unifiedRec) {
      for (const s of unifiedRec.subs) {
        if (!isUsed(s.substanceId)) { substances.push(s.substanceId); markUsed(s.substanceId); }
      }
      for (const pd of unifiedRec.phaseAssignedDrugs || []) {
        if (!phaseAssignedDrugs.some(x => x.id === pd.substanceId)) {
          phaseAssignedDrugs.push({ id: pd.substanceId, reason: pd.reason, trigger: pd.trigger, category: pd.category });
        }
      }
      if (unifiedRec.protocolWarnings?.length) protocolWarnings.push(...unifiedRec.protocolWarnings);
    }

    // ── 1a. Обязательные препараты на курсе ААС (legacy fallback) ──
    if (useLegacyMandatory && state.pharma.aas.length > 0) {
      const aasIds = state.pharma.aas.map((a: any) => (a.id||'').toLowerCase());
      const hasTest = aasIds.some(id => id.includes('test'));
      const hasTren = aasIds.some(id => id.includes('tren'));
      const hasNandrolone = aasIds.some(id => ['nandrolone','deca','npp'].some(x => id.includes(x)));
      const hasBoldenone = aasIds.some(id => id.includes('bold') || id.includes('equipoise'));
      const totalAasDose = state.pharma.aas.reduce((sum: number, a: any) => sum + (Number(a.doseMgWeek) || 0), 0);
      const highHematologicLoad = totalAasDose >= 500 || hasTren || hasNandrolone || hasBoldenone;
      const hasOral = state.pharma.aas.some((a: any) =>
        a.form === 'oral' ||
        ['oxandrolone','anavar','stanozolol','winstrol','methandienone','dianabol',
         'fluoxymesterone','halotestin','oxymetholone','anadrol','turinabol',
         'oral_turinabol','methyltestosterone','cheque_drops']
           .some(x => (a.id||'').toLowerCase().includes(x)));
      const prlRaw = state.labs?.fullPanel?.panelSex?.Prolactin;
      const prl = prlRaw != null ? Number.parseFloat(String(prlRaw)) : NaN;
      if ((hasTren || hasNandrolone || hasBoldenone) && (!Number.isFinite(prl) || prl <= 25)) {
        protocolWarnings.push('⚠ КАБЕРГОЛИН НЕ НАЗНАЧЕН: для 19-nor нужен PRL, повторное подтверждение/макропролактин и обязательное назначение врача. Не принимать профилактически.');
      }

      // База активного курса: всегда присутствует в расчёте риска.
      // Это не препараты и не должна учитываться как pill burden.
      for (const foundationId of COURSE_FOUNDATION) {
        if (!isUsed(foundationId)) { substances.push(foundationId); markUsed(foundationId); }
      }

      // hCG при любом AAS
      if (!state.pharma.hasHCG && !isUsed('hcg')) {
        substances.push('hcg'); markUsed('hcg');
        phaseAssignedDrugs.push({
          id: 'hcg',
          reason: 'ХГЧ 500 МЕ 2р/нед, схема 3/1 (3 нед приём, 1 нед отдых). Имитирует ЛГ → поддержание клеток Лейдига, профилактика атрофии яичек на фоне экзогенного тестостерона.',
          trigger: 'AAS в курсе + отсутствует в плане (hasHCG=false)',
          category: 'hcg',
        });
      }

      // Кардио-контур высокой PED-нагрузки: минимальный старт с обязательным
      // контролем АД/ЧСС. Safety/contraindications остаются отдельным слоем.
      if (totalAasDose >= 500 || hasTren || hasNandrolone || hasBoldenone) {
        if (!isUsed('tadalafil')) { substances.push('tadalafil'); markUsed('tadalafil'); }
        if (!isUsed('telmisartan')) { substances.push('telmisartan'); markUsed('telmisartan'); }
        if (!isUsed('nebivolol')) { substances.push('nebivolol'); markUsed('nebivolol'); }
      }

      if (highHematologicLoad) {
        for (const id of ['nattokinase', 'serrapeptase', 'bromelain']) {
          if (!isUsed(id)) { substances.push(id); markUsed(id); }
        }
        for (const id of ['hesperidin', 'pycnogenol', 'citrulline']) {
          if (!isUsed(id)) { substances.push(id); markUsed(id); }
        }
      }
      if (hasTest && !isUsed('bergamot')) { substances.push('bergamot'); markUsed('bergamot'); }
      for (const id of ['tmg', 'astaxanthin']) {
        if (!isUsed(id)) { substances.push(id); markUsed(id); }
      }

      // Антиароматаза при тестостероне/метилтестостероне
      if (hasTest && !state.pharma.hasAI && !isUsed('anastrozole') && !isUsed('tamoxifen')) {
        substances.push('anastrozole'); markUsed('anastrozole');
        phaseAssignedDrugs.push({
          id: 'anastrozole',
          reason: 'Анастрозол 0.5 мг 2р/нед (титровать по E2). Тестостерон ароматизируется в эстрадиол → контроль E2 (цель 20-40 pg/mL) для профилактики гинекомастии и задержки воды.',
          trigger: 'Тестостеронсодержащий AAS в курсе + нет AI/SERM',
          category: 'ai',
        });
      }

      // Нандролон: обязательный нейро/NO-модулятор профиля 19-nor.
      if (hasNandrolone && !isUsed('agmatine')) {
        substances.push('agmatine'); markUsed('agmatine');
        phaseAssignedDrugs.push({
          id: 'agmatine',
          reason: 'Агматин 1 г 2р/день — обязательный компонент поддержки нандролона: NMDA/NO-модуляция и дофаминергический/эндотелиальный контур.',
          trigger: 'Нандролон/NPP/Deca в курсе',
          category: 'neuro_protection',
        });
      }

      // Тренболон → NAC + астрагал + кордицепс (нефропротекция)
      if (hasTren) {
        if (!isUsed('nac')) {
          substances.push('nac'); markUsed('nac');
          phaseAssignedDrugs.push({
            id: 'nac',
            reason: 'NAC 1200 мг/день. Донатор глутатиона → защита проксимальных канальцев почек от окислительного стресса, который индуцируется тренболоном (метаболиты 17β-OH-Tren).',
            trigger: 'Тренболон в курсе (нефропротекция)',
            category: 'renal_protection',
          });
        }
        if (!isUsed('astragalus')) {
          substances.push('astragalus'); markUsed('astragalus');
          phaseAssignedDrugs.push({
            id: 'astragalus',
            reason: 'Астрагал 500 мг/день. Сапонины ↓ протеинурии, анти-AP-1 → защита клубочков от гипертензии/воспаления на тренболоне.',
            trigger: 'Тренболон в курсе (нефропротекция)',
            category: 'renal_protection',
          });
        }
        if (!isUsed('cordyceps')) {
          substances.push('cordyceps'); markUsed('cordyceps');
          phaseAssignedDrugs.push({
            id: 'cordyceps',
            reason: 'Кордицепс 1 г/день. ↓ гиперфильтрации клубочков, противовоспалительный эффект на почки на тренболоне.',
            trigger: 'Тренболон в курсе (нефропротекция)',
            category: 'renal_protection',
          });
        }
        for (const id of ['magnesium_l_threonate', 'phosphatidylserine', 'vitamin_b12', 'theanine', 'glycine']) {
          if (!isUsed(id)) { substances.push(id); markUsed(id); }
        }
        for (const id of ['alpha_lipoic', 'curcumin', 'berberine', 'dandelion', 'hesperidin']) {
          if (!isUsed(id)) { substances.push(id); markUsed(id); }
        }
      }

      // Оральные 17α-алкилированные → TUDCA + NAC (гепатопротекция)
      if (hasOral) {
        if (!isUsed('tudca')) {
          substances.push('tudca'); markUsed('tudca');
          phaseAssignedDrugs.push({
            id: 'tudca',
            reason: 'TUDCA 500 мг/день. Гидрофильная жёлчная кислота → снижение ER-стресса гепатоцитов, ↑ BSEP-зависимый жёлчеотток. 17α-алкилированные оралы индуцируют холестаз.',
            trigger: 'Оральный 17α-алкил AAS в курсе (гепатопротекция)',
            category: 'hepatic_protection',
          });
        }
        if (!isUsed('nac')) {
          substances.push('nac'); markUsed('nac');
          phaseAssignedDrugs.push({
            id: 'nac',
            reason: 'NAC 1200 мг/день. ↑ Глутатион → связывание токсичных метаболитов 17α-алкилов (фаза II конъюгация). Защита гепатоцитов от цитолиза.',
            trigger: 'Оральный 17α-алкил AAS в курсе (гепатопротекция)',
            category: 'hepatic_protection',
          });
        }
        if (!isUsed('milk_thistle')) {
          substances.push('milk_thistle'); markUsed('milk_thistle');
          phaseAssignedDrugs.push({
            id: 'milk_thistle',
            reason: 'Силимарин 280 мг/день. Стабилизация мембран гепатоцитов, ↓ перекисного окисления, ↑ РНК-полимеразы I для синтеза белка.',
            trigger: 'Оральный 17α-алкил AAS в курсе (гепатопротекция)',
            category: 'hepatic_protection',
          });
        }
      }
    }

    // ── 2. Рекомендации по анализам (фильтрация по severity → level) ──
    // basic: только critical/high; mid: +medium; max: +low; boost: все
    const recSeverityByLevel: Record<string, Set<string>> = {
      basic: new Set(['critical', 'high']),
      mid:   new Set(['critical', 'high', 'medium']),
      max:   new Set(['critical', 'high', 'medium', 'low']),
      boost: new Set(['critical', 'high', 'medium', 'low', 'info']),
    };
    const allowedSeverity = recSeverityByLevel[state.powerLevel] ?? recSeverityByLevel.mid;
    const resultPre: any = { selectedSubstances: substances, schedule: [], synergyIdsUsed: synergyIds, overallRiskBefore: 0, overallRiskAfter: 0 };
    const recommendations = evaluateRecommendations(state, resultPre);
    // При наличии единого плана (resolvePlan) старые рекомендации не дублируются:
    // resolvePlan уже покрывает lab-driven назначения через tier/lab-подбор.
    const filteredRecs = useLegacyMandatory ? recommendations.filter(r => allowedSeverity.has(r.severity)) : [];
    for (const rec of filteredRecs)
      for (const sub of rec.substances)
        if (!isAutoDoctorOnly(sub.id) && !isUsed(sub.id)) { substances.push(sub.id); markUsed(sub.id); }

    // 2a. Отмечаем какие системы уже покрыты рекомендациями
    const recCoveredSystems = new Set<string>();
    for (const rec of filteredRecs) {
      if (rec.system) recCoveredSystems.add(rec.system);
      if (rec.id === 'estradiol' || rec.id === 'prolactin' || rec.id === 'hcg' || rec.id === 'always_hcg') recCoveredSystems.add('reproductive');
      if (rec.id === 'hepatic') recCoveredSystems.add('hepatic');
      if (rec.id === 'hct') recCoveredSystems.add('hematologic');
      if (rec.id === 'lipid' || rec.id === 'bp') recCoveredSystems.add('cardio');
      if (rec.id === 'neuro') recCoveredSystems.add('neuro');
    }

    // ── 3. TZ-подбор: breadth + targeted ──
    interface DBEntry { organId: string; mechId: string; k: number; q: string; }
    const allDb: Record<string, DBEntry[]> = {};
    const _mergedDb: Record<string, DBEntry[]> = {};
    Object.assign(_mergedDb, SUPPLEMENTS_DB || {}, PHARMACY_DB || {});
    for (const [id, entries] of Object.entries(_mergedDb)) {
      if (!entries || entries.length === 0) continue;
      if (TZ_AUTO_BLACKLIST.has(id)) continue;
      allDb[id] = entries;
    }

    const sysCoverageCount: Record<string, number> = {};
    for (const subId of substances) {
      const entries = allDb[subId];
      if (entries) {
        for (const e of entries) {
          sysCoverageCount[e.organId] = (sysCoverageCount[e.organId] || 0) + 1;
        }
      }
    }

    const riskSystems: RiskSystemId[] = ['cardio','hepatic','renal','neuro','endocrine','hematologic','reproductive','musculoskeletal'];
    const levelTargets: Record<string, [number, number]> = {
      basic: [55, 65], mid: [45, 55], max: [30, 45], boost: [15, 30],
    };
    const maxPerSystem: Record<string, number> = { basic: 2, mid: 3, max: 4, boost: 5 };
    const boostAdded: string[] = [];

    // ── TZ Risk: рассчитываем риск БЕЗ поддержки для отбора веществ ──
    const oldScores = calcAllRisks(state);
    const tzInputPre = buildTzInput(state, []);
    const tzResultPre = tzInputPre ? calculateTzSpecRisk(tzInputPre) : null;
    const scoresPre = tzResultPre ? tzToScores(tzResultPre, oldScores) : oldScores;

    if (useLegacyMandatory && Object.keys(allDb).length > 0) {
      const baseRange = levelTargets[state.powerLevel] ?? [40, 50];
      const targetMax = Math.max(5, baseRange[1] - (state.boostEnabled ? 5 : 0));
      const targetMin = Math.max(5, baseRange[0] - (state.boostEnabled ? 5 : 0));
      const target = targetMin;
      const maxPerSys = (maxPerSystem[state.powerLevel] ?? 2) + (state.boostEnabled ? 1 : 0);

      // ── Priority bonus from lab-priority-map ──
      // Substances that are 1st/2nd choice for active lab markers get a scoring bonus
      const priorityBonus = new Map<string, number>();
      const fp = state.labs?.fullPanel;
      if (fp) {
        const labChecks: Array<{ panel: keyof typeof fp; key: string; marker: string; higherIsWorse: boolean; threshold: number }> = [
          { panel: 'panelBiochem', key: 'ALT', marker: 'ALT', higherIsWorse: true, threshold: 40 },
          { panel: 'panelBiochem', key: 'AST', marker: 'AST', higherIsWorse: true, threshold: 40 },
          { panel: 'panelBiochem', key: 'GGT', marker: 'GGT', higherIsWorse: true, threshold: 55 },
          { panel: 'panelBiochem', key: 'Bilirubin', marker: 'Bilirubin', higherIsWorse: true, threshold: 21 },
          { panel: 'panelBiochem', key: 'Glucose', marker: 'GLU', higherIsWorse: true, threshold: 5.6 },
          { panel: 'panelBiochem', key: 'Homocysteine', marker: 'HOMOCYSTEINE', higherIsWorse: true, threshold: 15 },
          { panel: 'panelBiochem', key: 'CRP', marker: 'CRP', higherIsWorse: true, threshold: 5 },
          { panel: 'panelBiochem', key: 'Creatinine', marker: 'Creatinine', higherIsWorse: true, threshold: 105 },
          { panel: 'panelLipid', key: 'LDL', marker: 'LDL', higherIsWorse: true, threshold: 3 },
          { panel: 'panelLipid', key: 'Triglycerides', marker: 'Triglycerides', higherIsWorse: true, threshold: 1.7 },
          { panel: 'panelHematology', key: 'HCT', marker: 'HCT', higherIsWorse: true, threshold: 48 },
          { panel: 'panelCoagulation', key: 'D-dimer', marker: 'D-dimer', higherIsWorse: true, threshold: 0.5 },
          { panel: 'panelSex', key: 'E2', marker: 'E2', higherIsWorse: true, threshold: 40 },
          { panel: 'panelSex', key: 'Prolactin', marker: 'PRL', higherIsWorse: true, threshold: 25 },
          { panel: 'panelSex', key: 'Cortisol', marker: 'CORTISOL', higherIsWorse: true, threshold: 550 },
          { panel: 'panelThyroid', key: 'TSH', marker: 'TSH', higherIsWorse: true, threshold: 4.5 },
          { panel: 'panelVitamin', key: 'Vitamin D (25-OH)', marker: 'VITD', higherIsWorse: false, threshold: 30 },
          { panel: 'panelVitamin', key: 'B12', marker: 'B12', higherIsWorse: false, threshold: 210 },
          { panel: 'panelIron', key: 'Ferritin', marker: 'FERRITIN', higherIsWorse: true, threshold: 300 },
        ];
        for (const lc of labChecks) {
          const pv = fp[lc.panel] as Record<string, string> | undefined;
          if (!pv) continue;
          const raw = parseFloat(pv[lc.key]);
          if (isNaN(raw)) continue;
          const triggered = lc.higherIsWorse ? raw > lc.threshold : raw < lc.threshold;
          if (!triggered) continue;
          const sev: SeverityLevel = lc.higherIsWorse
            ? (raw > lc.threshold * 3 ? 'severe' : raw > lc.threshold * 2 ? 'moderate' : 'mild')
            : (lc.threshold / Math.max(raw, 0.01) > 3 ? 'severe' : lc.threshold / Math.max(raw, 0.01) > 2 ? 'moderate' : 'mild');
          const entries = getPrioritySubstances(lc.marker, sev);
          for (const e of entries) {
            const bonus = e.priority === 1 ? 8 : e.priority === 2 ? 4 : e.priority === 3 ? 2 : 1;
            priorityBonus.set(e.substanceId, Math.max(priorityBonus.get(e.substanceId) || 0, bonus));
          }
        }
      }

      const phase = state.pharma?.phase || 'course';
      const skipReproductive = phase === 'course' || phase === 'bridge';
      const skipMusculoskeletal = !state.jointMode;
      const skipNeuro = !state.neuroMode;
      const activeSystems = riskSystems.filter(sys => {
        if (skipReproductive && sys === 'reproductive') return false;
        if (skipMusculoskeletal && sys === 'musculoskeletal') return false;
        if (skipNeuro && sys === 'neuro') return false;
        const score = scoresPre[sys] || 0;
        if (score <= targetMax) return false;
        const tzSys = sys === 'neuro' ? 'cns' : sys;
        const covered = sysCoverageCount[tzSys] || sysCoverageCount[sys] || 0;
        return covered < maxPerSys;
      });

      const tBoosterBlacklist = (phase === 'course' || phase === 'bridge')
        ? new Set<string>(['tribulus','tribulus_terrestris'])
        : new Set<string>();

      // Breadth: broad-spectrum для систем без покрытия
      const systemsNeedingCoverage = activeSystems.filter(sys => {
        const tzSys = sys === 'neuro' ? 'cns' : sys;
        return (sysCoverageCount[tzSys] || sysCoverageCount[sys] || 0) === 0;
      });

      if (systemsNeedingCoverage.length > 0) {
        const scored: [string, number, number, number][] = [];
        for (const [id, entries] of Object.entries(allDb)) {
           if (isAutoDoctorOnly(id) || isUsed(id) || !entries.length) continue;
          if (tBoosterBlacklist.has(id)) continue;
          if (TZ_AUTO_BLACKLIST.has(id)) continue;
          let matchCount = 0; let totalK = 0;
          for (const e of entries) {
            if (systemsNeedingCoverage.includes(e.organId as RiskSystemId)) { matchCount++; totalK += e.k; }
          }
          if (matchCount > 0) {
            const synBonus = synergyScoreWithPlan(id, substances);
            const pBonus = priorityBonus.get(id) || 0;
            scored.push([id, matchCount, totalK, synBonus + pBonus]);
          }
        }
        scored.sort((a, b) => (b[1] * 20 + b[2] + b[3] * 3) - (a[1] * 20 + a[2] + a[3] * 3));
        for (const [id] of scored.slice(0, 3)) {
          if (isUsed(id)) continue;
          substances.push(id); markUsed(id);
        }
      }

      // Targeted + итеративный gap-filling
      for (const sys of activeSystems) {
        const tzSys = sys === 'neuro' ? 'cns' : sys;
        let currentCount = sysCoverageCount[tzSys] || sysCoverageCount[sys] || 0;

        while (currentCount < maxPerSys) {
          let best: [string, number, number] | null = null;
          for (const [id, entries] of Object.entries(allDb)) {
            if (isAutoDoctorOnly(id) || isUsed(id)) continue;
            if (tBoosterBlacklist.has(id)) continue;
            if (TZ_AUTO_BLACKLIST.has(id)) continue;
            if (conflictScoreWithPlan(id, substances) > 0) continue;
            for (const e of entries) {
              if ((e.organId === tzSys || e.organId === sys) && e.k > 0) {
                const synBonus = synergyScoreWithPlan(id, substances);
                const pBonus = priorityBonus.get(id) || 0;
                const compositeScore = e.k + (synBonus + pBonus) * 0.3;
                if (!best || compositeScore > (best[1] + best[2] * 0.3)) {
                  best = [id, e.k, synBonus + pBonus];
                }
              }
            }
          }
          if (!best) break;
          substances.push(best[0]); markUsed(best[0]);
          currentCount++;
          sysCoverageCount[tzSys] = currentCount;
          const score = scoresPre[sys] || 0;
          const estimatedRisk = score * Math.pow(1 - best[1], currentCount);
          if (estimatedRisk <= target) break;
        }
      }

      // ── УСИЛЕНИЕ (boost): вещество с максимальной синергией ──
      if (state.boostEnabled) {
        const sortedByRisk = riskSystems
          .filter(sys => {
            if (skipReproductive && sys === 'reproductive') return false;
            if (skipMusculoskeletal && sys === 'musculoskeletal') return false;
            return true;
          })
          .map(sys => ({ sys, risk: scoresPre[sys] || 0 }))
          .sort((a, b) => b.risk - a.risk);

        for (const { sys, risk } of sortedByRisk) {
          if (risk <= target) continue;
          if (boostAdded.length >= 2) break;
          const tzSys = sys === 'neuro' ? 'cns' : sys;
          const currentCount = sysCoverageCount[tzSys] || sysCoverageCount[sys] || 0;
          if (currentCount >= maxPerSys + 1) continue;
          let bestBoost: [string, number, number] | null = null;
          for (const [id, entries] of Object.entries(allDb)) {
            if (isAutoDoctorOnly(id) || isUsed(id)) continue;
            if (tBoosterBlacklist.has(id)) continue;
            if (TZ_AUTO_BLACKLIST.has(id)) continue;
            if (conflictScoreWithPlan(id, substances) > 0) continue;
            const hasSys = entries.some(e => e.organId === tzSys || e.organId === sys);
            if (!hasSys) continue;
            const synScore = synergyScoreWithPlan(id, substances);
            const pBonus = priorityBonus.get(id) || 0;
            if (synScore + pBonus < 4) continue;
            const bestK = Math.max(...entries.filter(e => e.organId === tzSys || e.organId === sys).map(e => e.k));
            if (!bestBoost || (synScore + pBonus) > bestBoost[1] || ((synScore + pBonus) === bestBoost[1] && bestK > bestBoost[2])) {
              bestBoost = [id, synScore + pBonus, bestK];
            }
          }
          if (bestBoost) {
            substances.push(bestBoost[0]); markUsed(bestBoost[0]);
            boostAdded.push(bestBoost[0]); // TAG for UI badge only
            sysCoverageCount[tzSys] = (sysCoverageCount[tzSys] || 0) + 1;
          }
        }
      }
    }

    // ── Level caps для mode-блоков: basic=3, mid=5, max=8, boost=all ──
    const modeCap: Record<string, number> = { basic: 3, mid: 5, max: 8, boost: 99 };
    const modeLimit = modeCap[state.powerLevel] ?? 5;

    // ── 4. Суставы: добавляем prioritized subset, тег в jointSubs ──
    const jointSubs: string[] = [];
    if (state.jointMode) {
      const jointPriority = ['collagen','glucosamine','omega3','curcumin','msm','boswellia','chondroitin_sulfate','hyaluronic_acid','vitamin_c','bpc157','tb500'];
      let added = 0;
      for (const jid of jointPriority) {
        if (added >= modeLimit) break;
        if (!isUsed(jid)) { substances.push(jid); markUsed(jid); jointSubs.push(jid); added++; }
      }
    }

    // ── 5. Репродуктивная система: prioritized subset ──
    if (state.reproMode) {
      const reproPriority = ['hcg','zinc','vitamin_d3','coq10','ashwagandha','saw_palmetto'];
      let added = 0;
      for (const rid of reproPriority) {
        if (added >= modeLimit) break;
        if (!isUsed(rid)) { substances.push(rid); markUsed(rid); added++; }
      }
    }

    // ── 6. Нейропротекция: prioritized subset, тег в neuroSubs ──
    const neuroSubs: string[] = [];
    if (state.neuroMode) {
      const neuroPriority = ['nac','omega3','magnesium','alpha_lipoic','coq10','lions_mane','theanine','tyrosine','vitamin_b6','vitamin_b12','folate','ashwagandha','bromantan','fasoracetam','huperzine','semax','cerebrolysin'];
      let added = 0;
      for (const nid of neuroPriority) {
        if (added >= modeLimit) break;
        if (!isUsed(nid)) { substances.push(nid); markUsed(nid); neuroSubs.push(nid); added++; }
      }
    }

    // Финальный budget после всех автоматических веток. Раньше broad/lab/
    // symptom-рекомендации добавлялись без общего cap и раздували mid-план
    // десятками веществ. Mandatory course profile сохраняется, optional tail
    // обрезается до уровня пользователя.
    const mandatoryIds = new Set<string>(COURSE_FOUNDATION);
      if (state.pharma.aas.length > 0) {
      const hasTestForBudget = state.pharma.aas.some((a: any) => String(a.id || '').toLowerCase().includes('test'));
      ['hcg', 'tadalafil', 'telmisartan', 'nebivolol', 'anastrozole', 'agmatine', 'nac', 'omega3', 'coq10', 'tmg', 'taurine', 'hesperidin', 'pycnogenol', 'citrulline', 'astaxanthin'].forEach(id => mandatoryIds.add(canonId(id)));
      const hasTren = state.pharma.aas.some((a: any) => String(a.id || '').toLowerCase().includes('tren'));
      const hasNand = state.pharma.aas.some((a: any) => ['nandrolone', 'deca', 'npp'].some(x => String(a.id || '').toLowerCase().includes(x)));
      const hasOral = state.pharma.aas.some((a: any) => a.form === 'oral' || /oxandrolone|anavar|stanozolol|winstrol|methandienone|dianabol|oxymetholone|anadrol|turinabol|halotestin|superdrol/i.test(String(a.id || '')));
      if (hasTren) ['astragalus', 'cordyceps', 'magnesium_l_threonate', 'phosphatidylserine', 'vitamin_b12', 'theanine', 'glycine', 'alpha_lipoic', 'curcumin', 'berberine', 'dandelion'].forEach(id => mandatoryIds.add(canonId(id)));
      if (hasNand) mandatoryIds.add(canonId('agmatine'));
      if (hasOral) ['tudca', 'milk_thistle'].forEach(id => mandatoryIds.add(canonId(id)));
      if (hasTren || hasNand || state.pharma.aas.some((a: any) => /bold|equipoise|dhb/i.test(String(a.id || '')))) ['nattokinase', 'serrapeptase', 'bromelain'].forEach(id => mandatoryIds.add(canonId(id)));
      if (hasTestForBudget) mandatoryIds.add(canonId('bergamot'));
    }
    const planLimit = Math.max(AUTO_PLAN_LIMIT[state.powerLevel] ?? AUTO_PLAN_LIMIT.mid, mandatoryIds.size);
    const prioritized = substances.filter(id => mandatoryIds.has(canonId(id)));
    const optional = substances.filter(id => !mandatoryIds.has(canonId(id)) && !isAutoDoctorOnly(id));
    const finalSubstances = [...new Set([...prioritized, ...optional])].slice(0, planLimit);
    substances.splice(0, substances.length, ...finalSubstances);

    // ── 6a. Синергетические пары (комплексный выбор) ──
    // Если выбран один из пары — добавить партнёра автоматически
    const SYNERGY_PAIRS: Record<string, string[]> = {
      serrapeptase: ['nattokinase'],
      nattokinase: ['serrapeptase'],
    };
    for (const [id, partners] of Object.entries(SYNERGY_PAIRS)) {
      if (isUsed(id)) {
        for (const partner of partners) {
          if (!isUsed(partner)) {
            substances.push(partner);
            markUsed(partner);
            const pEntries = allDb[partner];
            if (pEntries) {
              for (const e of pEntries) {
                sysCoverageCount[e.organId] = (sysCoverageCount[e.organId] || 0) + 1;
              }
            }
          }
        }
      }
    }

    const finalAfterSynergy = [...new Set([
      ...substances.filter(id => mandatoryIds.has(canonId(id))),
      ...substances.filter(id => !mandatoryIds.has(canonId(id)) && !isAutoDoctorOnly(id)),
    ])].slice(0, planLimit);
    substances.splice(0, substances.length, ...finalAfterSynergy);

    // ── 7. Финальный расчёт риска С поддержкой (включая ВСЕ вещества) ──
    const titration = applyTitration(substances, state);
    const labDeltas = calcLabDeltas(state);
    const schedule = generateSchedule(substances, synergyIds, titration, state);

    const depletionWarnings = checkDepletionCascade(substances, titration);
    const ulWarnings = checkUpperLimits(substances, titration);
    const dailyLoad = aggregateDailyLoad(substances, titration);

    let overallRaw: number;
    let overallAfterSupport: number;
    let finalScores: Record<RiskSystemId, number>;
    let tzResultFinal: TzSpecResult | null = null;
    let peakWeek = 0;

    // Процедуры (эритроцитаферез/флеботомия) — реальные вмешательства,
    // снижающие hem1 (прямое удаление RBC-массы); включаются в расчёт
    // «с поддержкой» как k-записи (PROCEDURE_DB), не как вещества.
    const procedureIds = (unifiedRec?.procedures || [])
      .filter(p => p.id === 'erythrocytapheresis' || p.id === 'phlebotomy')
      .map(p => p.id);
    let tzInputFinal = buildTzInput(state, [...substances, ...procedureIds]);
    if (!tzInputFinal) {
      tzInputFinal = {
        drugClass: 'aas', drugName: 'none', dose: 0, duration: 12,
        form: 'inject', combinations: 0, labCoverage: 0.3,
        labValues: {}, supportSubstances: substances, drugs: [],
        courseWeek: state.courseWeek,
      };
    }
    tzResultFinal = calculateTzSpecRisk(tzInputFinal);
    finalScores = tzToScores(tzResultFinal, oldScores);
    overallRaw = tzResultFinal.overallRaw;
    overallAfterSupport = tzResultFinal.overallAfter;

    // ── 8. Понедельная динамика риска (timeline) ──
    let timelineData: TimelineWeekData[] | undefined;
    if (tzInputFinal) {
      try {
        const timelineInput: TzSpecInput = {
          ...tzInputFinal,
          supportSubstances: substances,
        };
        const tlRaw = calculateTzSpecRiskTimeline(timelineInput);
        timelineData = tlRaw.map(t => ({
          week: t.week,
          activeDrugs: t.activeDrugs,
          drugConcentrations: t.drugConcentrations,
          organPercents: t.organPercents,
          organAfterPercents: t.organAfterPercents,
          overallRaw: t.overallRaw,
          overallAfter: t.overallAfter,
        }));

        if (timelineData.length > 0) {
          let peak = timelineData[0];
          for (const t of timelineData) {
            if (t.overallRaw > peak.overallRaw) peak = t;
          }
          peakWeek = peak.week;
          overallRaw = peak.overallRaw;
          overallAfterSupport = peak.overallAfter;
          for (const sys of Object.keys(finalScores)) {
            const tzSys = sys === 'neuro' ? 'cns' : sys;
            const peakVal = peak.organPercents[tzSys];
            if (peakVal !== undefined) finalScores[sys as RiskSystemId] = peakVal;
          }
          // Timeline peak is the authoritative display point. Previously the
          // overall values were replaced with peak values while tzResultFinal
          // still contained the current-week organ percentages, producing
          // inconsistent overall-vs-system cards.
          if (tzResultFinal) {
            for (const organ of tzResultFinal.organs) {
              const peakRaw = peak.organPercents[organ.id];
              const peakAfter = peak.organAfterPercents[organ.id];
              if (peakRaw !== undefined) {
                organ.rawPercent = Math.max(0, Math.min(100, peakRaw));
                organ.rawScore = organ.maxRaw * organ.rawPercent / 100;
              }
              if (peakAfter !== undefined) {
                organ.afterPercent = Math.max(0, Math.min(100, peakAfter));
                organ.afterScore = organ.maxRaw * organ.afterPercent / 100;
                organ.k_protect = organ.rawPercent > 0
                  ? Math.round((1 - organ.afterPercent / organ.rawPercent) * 100)
                  : 0;
              }
            }
          }
        }
      } catch {}
    }

    // ── 9. Риск выбранной недели ──
    const cw = state.courseWeek ?? 1;
    let selectedWeekRaw: number | undefined;
    let selectedWeekAfter: number | undefined;
    if (timelineData && timelineData.length > 0) {
      const sw = timelineData.find(t => t.week === cw);
      if (sw) {
        selectedWeekRaw = sw.overallRaw;
        selectedWeekAfter = sw.overallAfter;
      }
    }

    // ── 10. Synergy recommendations (what-if карточка) ──
    // Строим coverage из ВСЕХ веществ (включая joint/neuro)
    const planSystemCoverage = new Set<string>();
    for (const subId of substances) {
      const entries = allDb[subId];
      if (entries) for (const e of entries) planSystemCoverage.add(e.organId === 'cns' ? 'neuro' : e.organId);
    }
    const _phase = state.pharma?.phase || 'course';
    const _skipRepro = _phase === 'course' || _phase === 'bridge';
    const _skipMusculo = !state.jointMode;
    const _skipNeuro = !state.neuroMode;
    const _range = levelTargets[state.powerLevel] ?? [40, 50];
    const _targetMax = Math.max(5, _range[1] - (state.boostEnabled ? 5 : 0));
    const activeSystemsList = riskSystems.filter(sys => {
      if (_skipRepro && sys === 'reproductive') return false;
      if (_skipMusculo && sys === 'musculoskeletal') return false;
      if (_skipNeuro && sys === 'neuro') return false;
      return (scoresPre[sys] || 0) > _targetMax;
    });
    // generateSynergyRecommendations уже фильтрует used substances внутри
    const synergyRecs = generateSynergyRecommendations(substances.slice(), activeSystemsList, allDb, planSystemCoverage);

    // ── DDI (Drug-Drug Interactions) из drug-interactions.ts ──
    const ddiAlerts = checkInteractions(substances);
    const ddiAlertStrings = ddiAlerts.map(i =>
      i.severity === 'block'
        ? `⛔ DDI: ${i.a} + ${i.b}: ${i.reason} — ${i.action}`
        : `⚠ DDI: ${i.a} + ${i.b}: ${i.reason} — ${i.action}`
    );

    // ── Маппинг state.contraindications → healthConditions для checkContraindications ──
    // state.contraindications (hasCVD, hasDiabetes, ...) → condition IDs (ihd, diabetes, ...)
    // которые проверяются в substance-contraindications.ts absoluteConditions/relativeConditions
    const healthConditionsMapped: string[] = [...(state.healthConditions || [])];
    const ci = state.contraindications;
    if (ci.hasCVD || state.cardio.previousCVD) { healthConditionsMapped.push('ihd'); healthConditionsMapped.push('recent_mi'); }
    if (ci.hasDiabetes || state.urinary.diabetes) healthConditionsMapped.push('diabetes');
    if (ci.hasThrombophilia) healthConditionsMapped.push('thrombophilia');
    if (ci.hasGI) healthConditionsMapped.push('peptic_ulcer');
    if (ci.hasProstateIssues) healthConditionsMapped.push('bph');
    if (ci.hasEpilepsy) healthConditionsMapped.push('epilepsy');
    if (ci.hasMentalIllness) healthConditionsMapped.push('bipolar');
    if (ci.hasLiverDisease) healthConditionsMapped.push('severe_hepatic');
    if (ci.hasKidneyDisease) { healthConditionsMapped.push('ckd_stage4_5'); healthConditionsMapped.push('ckd_stage3'); }
    if (state.cardio.hctElevation === 'severe') healthConditionsMapped.push('severe_polycythemia');
    if (state.cardio.bpStage === 'hypertension2') healthConditionsMapped.push('severe_hypertension');
    if (state.cardio.bpStage === 'hypertension1') healthConditionsMapped.push('hypertension');
    if (state.cardio.previousCVD) healthConditionsMapped.push('recent_cabg');
    // Демография
    if ((state.profile.age || 30) > 65) healthConditionsMapped.push('elderly');
    if ((state.profile.age || 30) > 50) healthConditionsMapped.push('age_over_50');

    const result: CalculatorResult = {
      risk: { systems: [], overallRaw, overallAfterSupport, timestamp: new Date().toISOString() },
      schedule, selectedSubstances: substances,
      jointSubs: jointSubs.length > 0 ? jointSubs : undefined,
      neuroSubs: neuroSubs.length > 0 ? neuroSubs : undefined,
      synergyIdsUsed: synergyIds,
      titrationApplied: titration,
      labDeltas, overallRiskBefore: overallRaw, overallRiskAfter: overallAfterSupport,
      contraindicationAlerts: [
        ...getContraindicationAlerts(state),
        ...checkContraindications(substances, healthConditionsMapped).map(a => a.severity === 'absolute'
          ? `⛔ ${a.substanceId}: ${a.message} — ${a.action}`
          : `⚠ ${a.substanceId}: ${a.message} — ${a.action}`),
        ...ddiAlertStrings,
      ],
      negativeBlocks: blacklist,
      comparisonBeforeAfter: (Object.keys(SYS_META) as RiskSystemId[]).map(id => ({
        system: id,
        before: finalScores[id] || 0,
        after: tzResultFinal
          ? (tzResultFinal.organs.find(o => o.id === (id === 'neuro' ? 'cns' : id))?.afterPercent ?? 0)
          : Math.max(0, (finalScores[id] || 0) - Math.round((finalScores[id] || 0) * 0.4)),
      })),
      timeline: timelineData,
      peakWeek,
      selectedWeekRaw,
      selectedWeekAfter,
      synergyRecommendations: synergyRecs.length > 0 ? synergyRecs : undefined,
      boostAdded: boostAdded.length > 0 ? boostAdded : undefined,
      timestamp: new Date().toISOString(),
      depletionWarnings: depletionWarnings.length > 0 ? depletionWarnings : undefined,
      ulWarnings: ulWarnings.length > 0 ? ulWarnings : undefined,
      dailyLoad: Object.keys(dailyLoad).length > 0 ? dailyLoad : undefined,
      phaseAssignedDrugs: phaseAssignedDrugs.length > 0 ? phaseAssignedDrugs : undefined,
      protocolWarnings: protocolWarnings.length > 0 ? protocolWarnings : undefined,
      tzSpecResult: tzResultFinal,
    };
    result.risk.systems = tzResultFinal
      ? toSystemRisksFromTz(tzResultFinal, finalScores, synergyIds.length)
      : toSystemRisks(finalScores, result);
    return result;
  } catch (err: any) {
    console.error('calculateSupportTZ error:', err);
    const fallback: CalculatorResult = {
      risk: { systems: [], overallRaw: 50, overallAfterSupport: 35, timestamp: new Date().toISOString() },
      schedule: [], selectedSubstances: [],
      synergyIdsUsed: [], titrationApplied: {}, labDeltas: [],
      overallRiskBefore: 50, overallRiskAfter: 35,
      contraindicationAlerts: [`Ошибка движка: ${err?.message || 'Неизвестная'}`],
      negativeBlocks: [],
      comparisonBeforeAfter: [],
      timestamp: new Date().toISOString(),
    };
    return fallback;
  }
}

export function hydrateState(): Partial<CalculatorState> {
  const result: Partial<CalculatorState> = {};
  try {
    const saved = localStorage.getItem('he_autocalc_state');
    if (saved) {
      const s = JSON.parse(saved);
      if (s.neuro) result.neuro = s.neuro;
      if (s.psych) result.psych = s.psych;
      if (s.genetics) result.genetics = s.genetics;
      if (s.hepatobiliary) result.hepatobiliary = s.hepatobiliary;
      if (s.cardio) result.cardio = s.cardio;
      if (s.urinary) result.urinary = s.urinary;
      if (s.goals) result.goals = s.goals;
      if (s.nutrition) result.nutrition = s.nutrition;
      if (s.contraindications) result.contraindications = s.contraindications;
      if (s.oda) result.oda = s.oda;
      if (s.dental) result.dental = s.dental;
      if (s.gi) result.gi = s.gi;
      if (s.toxicLoad) result.toxicLoad = s.toxicLoad;
      if (s.epicrisis) result.epicrisis = s.epicrisis;
      if (s.injection) result.injection = s.injection;
      if (s.journal) result.journal = s.journal;
      if (s.labs) result.labs = s.labs;
    }
  } catch {}
  try {
    const raw = localStorage.getItem('he_profile_v2');
    if (raw) {
      const p = JSON.parse(raw);
      const s = p.settings || {};
      // ── ЭТАП 2: nested чтение из UnifiedSettings (исправление flat-ключей) ──
      // Profile: personal + lifestyle
      const personal = s.personal || {};
      const lifestyle = s.lifestyle || {};
      const health = s.health || {};
      const pharma = s.pharma || {};
      result.profile = {
        weight: personal.weight || s.weight || 80,
        age: personal.age || s.age || 30,
        sex: (personal.sex || s.sex || 'male') as 'male' | 'female',
        height: personal.height ?? s.height,
        bodyfat: personal.bodyFat ?? s.bodyFat ?? personal.bodyfat,
        workoutsPerWeek: personal.workoutsPerWeek || s.workoutsPerWeek || 3,
        avgWorkoutMinutes: personal.avgWorkoutMinutes || s.avgWorkoutMinutes || 60,
        sleepHours: lifestyle.sleepHours ?? s.sleepHours ?? 7,
        stressLevel: lifestyle.stressLevel ?? s.stressLevel ?? 4,
        smoker: lifestyle.smoke ?? s.smoker ?? false,
        alcohol: lifestyle.alcohol || s.alcohol || 'rare',
        caffeineMg: lifestyle.caffeineMg ?? s.caffeineMg ?? 100,
      };
      // ── Neuro: из health.* с нормализацией шкалы 1-5 → 0-10 ──
      if (!result.neuro) {
        result.neuro = {
          dopamineScore: health.dopamineScore ?? 3,
          serotoninScore: health.serotoninScore ?? 3,
          gabaBalance: health.gabaBalance || 'balance',
          memoryIssues: health.memoryIssues ?? false,
          focusIssues: health.focusIssues ?? false,
          slowThinking: health.slowThinking ?? false,
          coordinationIssues: health.coordinationIssues ?? false,
          // aggressionScore в профиле 1-5, в калькуляторе 0-10 → ×2
          aggressionScore: (health.aggressionScore ?? 3) * 2,
          headaches: health.headaches ?? false,
          weatherDependent: health.weatherDependent ?? false,
          sleepQuality: health.sleepQuality || lifestyle.sleepQuality || 'good',
        } as any;
      }
      // ── ODA: из health.* с конвертацией jointPainSeverity ──
      if (!result.oda) {
        const jps = health.jointPainSeverity;
        result.oda = {
          jointPain: jps ?? (health.jointPain ? 'moderate' : 'none'),
          ligamentIssues: health.ligamentIssues ?? false,
          backPain: health.backPain ?? false,
          injuries: Array.isArray(health.injuries) ? health.injuries.map((i: any) => typeof i === 'string' ? i : (i?.description || i?.name || '')).filter(Boolean) : [],
        } as any;
      }
      // ── Pharma: из pharma.* с маппингом ──
      if (!result.pharma) {
        const phaseMap: Record<string, string> = { baseline: 'base', course: 'course', bridge: 'bridge', pct: 'pct', post_pct: 'pct', fertility: 'base' };
        // Маппинг currentSubstances → aas с поддержкой разных имён полей (doseMgWeek/weeklyDose/doseMg)
        const csAas = Array.isArray(pharma.currentSubstances) ? pharma.currentSubstances.map((s: any) => ({
          id: s.id || s.substanceId || '',
          doseMgWeek: s.doseMgWeek || s.weeklyDose || s.doseMg || 0,
          weeks: s.weeks || (s.endWeek && s.startWeek != null ? Math.max(1, s.endWeek - s.startWeek) : 0),
          form: s.form || (s.route === 'oral' ? 'oral' : 'inject'),
        })) : [];
        // Вывод PED-флагов и доз из currentSubstances (зеркало course_log)
        const csIds = new Set((pharma.currentSubstances || []).map((s: any) => s.id));
        const csHasAI = ['anastrozole','anastro','letrozole','exemestane'].some(id => csIds.has(id));
        const csHasSERM = ['tamoxifen','clomiphene','enclomiphene'].some(id => csIds.has(id));
        const csHasCaber = csIds.has('caberg') || csIds.has('cabergoline');
        const csHasGH = csIds.has('somatropin') || csIds.has('hgh') || csIds.has('gh');
        const csHasIGF = csIds.has('igf1_lr3') || csIds.has('igf1_des');
        const csHasInsulin = ['ins_short','ins_long','ins_aspart','ins_detemir'].some(id => csIds.has(id));
        const csHasSARMs = ['ostarine','lgd','rad140','s23','andarine'].some(id => csIds.has(id));
        const csHasMGF = csIds.has('mgf');
        let csGhIU = 0, csInsulinIU = 0, csIgfMcg = 0, csClenMcg = 0, csT3Mcg = 0;
        for (const s of (pharma.currentSubstances || [])) {
          const dose = Number((s as any).doseMg || (s as any).doseValue || 0);
          const id = (s as any).id;
          if (id === 'somatropin' || id === 'hgh' || id === 'gh') csGhIU += dose;
          if (['ins_short','ins_long','ins_aspart','ins_detemir'].includes(id)) csInsulinIU += dose;
          if (id === 'igf1_lr3' || id === 'igf1_des') csIgfMcg += dose;
          if (id === 'clenbuterol' || id === 'clen') csClenMcg += dose;
          if (id === 't3' || id === 'liothyronine') csT3Mcg += dose;
        }
        result.pharma = {
          phase: (phaseMap[pharma.phase] || pharma.phase || 'course') as any,
          aas: csAas,
          hasGH: pharma.hasGH ?? csHasGH ?? false,
          hasIGF: pharma.hasIGF ?? csHasIGF ?? false,
          hasInsulin: pharma.hasInsulin ?? csHasInsulin ?? false,
          hasHCG: pharma.hcgEnabled ?? false,
          hasAI: pharma.aiEnabled ?? csHasAI ?? false,
          hasCaber: pharma.hasCaber ?? csHasCaber ?? false,
          hasSERM: pharma.hasSERM ?? csHasSERM ?? false,
          hasSARMs: pharma.hasSARMs ?? csHasSARMs ?? false,
          hasMGF: pharma.hasMGF ?? csHasMGF ?? false,
          hasGLP1: pharma.hasGLP1 ?? false,
          ghIU: pharma.ghIU ?? csGhIU ?? 0,
          insulinIU: pharma.insulinIU ?? csInsulinIU ?? 0,
          igfMcg: pharma.igfMcg ?? csIgfMcg ?? 0,
          clenMcg: pharma.clenMcg ?? csClenMcg ?? 0,
          t3Mcg: pharma.t3Mcg ?? csT3Mcg ?? 0,
        } as any;
      }
      // ── Symptoms: из symptoms.recent → string[] ──
      if (!result.symptoms) {
        const sym = s.symptoms || {};
        const recent = sym.recent || {};
        const activeSymptoms = Object.entries(recent)
          .filter(([_, v]: [string, any]) => v && typeof v === 'object' && v.score > 0)
          .map(([k]) => k);
        if (activeSymptoms.length > 0) {
          (result as any).symptomsList = activeSymptoms;
        }
      }
      // ── Health conditions: из health.chronicConditions ──
      if (!(result as any).healthConditions) {
        (result as any).healthConditions = Array.isArray(health.chronicConditions) ? health.chronicConditions : [];
      }
      // ── Genetics ──
      if (s.genetics && !result.genetics) {
        result.genetics = {
          cyp19a1: s.genetics.CYP19A1 || s.genetics.cyp19a1 || 'unknown',
          srd5a2: s.genetics.SRD5A2 || s.genetics.srd5a2 || 'unknown',
          arSensitivity: s.genetics.AR || s.genetics.ar || 'unknown',
          mthfr: s.genetics.MTHFR || s.genetics.mthfr || 'unknown',
        };
      }
      // ── Contraindications ──
      if (!result.contraindications) {
        const ci = health.chronicConditions || s.chronicConditions || [];
        result.contraindications = {
          allergies: (s.foodAllergies || (s.nutrition && s.nutrition.foodAllergies) || []).join(', '),
          hasCVD: ci.includes('heart') || ci.includes('hypertension') || ci.includes('cvd'),
          hasThrombophilia: ci.includes('thrombophilia'),
          hasGI: ci.includes('gi') || ci.includes('giDisease'),
          hasProstateIssues: ci.includes('prostate'),
          hasDiabetes: ci.includes('diabetes'),
          hasEpilepsy: ci.includes('epilepsy'),
          hasMentalIllness: ci.includes('mental') || ci.includes('mentalIllness'),
          hasLiverDisease: ci.includes('liver'),
          hasKidneyDisease: ci.includes('kidney'),
        };
      }
      // ── Labs: из labs.summary → плоский record (адаптер) ──
      if (!result.labs && s.labs && s.labs.summary) {
        const summary = s.labs.summary || {};
        const flatPanel: Record<string, string> = {};
        for (const [k, v] of Object.entries(summary)) {
          if (v && typeof v === 'object' && (v as any).value != null) {
            flatPanel[k] = String((v as any).value);
          }
        }
        if (Object.keys(flatPanel).length > 0) {
          result.labs = {
            preCourse: null, midCourse: null, postPCT: null,
            fullPanel: { panelBiochem: flatPanel } as any,
          };
        }
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem('he_course_data');
    if (raw) {
      const c = JSON.parse(raw);
      const aas = Array.isArray(c.substances) ? c.substances.filter((s: any) => s.isAAS).map((s: any) => ({ id: s.id || s.substanceId || '', doseMgWeek: s.doseMgWeek || s.dose || 0, weeks: s.weeks || s.durationWeeks || 0 })) : [];
      result.pharma = { phase: c.phase || 'course', aas, hasGH: !!c.ghPeptides, hasIGF: !!c.igf1, hasInsulin: !!c.insulin, hasHCG: !!c.hcg, hasAI: !!c.ai, hasCaber: !!c.caber, hasSERM: !!c.serm, hasSARMs: !!c.sarm, hasMGF: false, hasGLP1: false };
    }
  } catch {}
  if (!result.labs) {
    try {
      const raw = localStorage.getItem('he_labs_history');
      if (raw) {
        const arr = JSON.parse(raw); const l = Array.isArray(arr) ? arr : [];
        const toSlice = (d: any): any => ({ date: d.date || '', panelSex: d.panelSex || d.values || {}, panelBiochem: d.panelBiochem || {}, panelHematology: d.panelHematology || {}, panelThyroid: d.panelThyroid || {}, panelLipid: d.panelLipid || {}, panelIron: d.panelIron || {}, panelVitamin: d.panelVitamin || {}, panelCardiac: d.panelCardiac || {}, panelCoagulation: d.panelCoagulation || {}, panelInflammatory: d.panelInflammatory || {}, panelAdrenal: d.panelAdrenal || {}, panelMineral: d.panelMineral || {}, panelTumor: d.panelTumor || {}, panelUrinalysis: d.panelUrinalysis || {} });
        result.labs = { preCourse: l[0] ? toSlice(l[0]) : null, midCourse: l[1] ? toSlice(l[1]) : null, postPCT: l[2] ? toSlice(l[2]) : null, fullPanel: null };
      }
    } catch {}
  }

  // ── Авто-вывод state-полей из анализов (если карточки убраны из UI) ──
  // Беpём midCourse slice (наиболее актуальный) и выводим hepatobiliary/cardio/urinary
  const labSlice = result.labs?.midCourse || result.labs?.preCourse || result.labs?.fullPanel as any;
  if (labSlice) {
    try {
      const getV = (panel: string, key: string): number | null => {
        const pv = (labSlice as any)[panel] as Record<string, string> | undefined;
        if (!pv) return null;
        const v = parseFloat(pv[key]);
        return isNaN(v) ? null : v;
      };
      const alt = getV('panelBiochem', 'ALT');
      const ast = getV('panelBiochem', 'AST');
      const ggt = getV('panelBiochem', 'GGT');
      const bilirubin = getV('panelBiochem', 'Bilirubin');
      const creatinine = getV('panelBiochem', 'Creatinine');
      const ldl = getV('panelLipid', 'LDL');
      const hdl = getV('panelLipid', 'HDL');
      const tg = getV('panelLipid', 'Triglycerides');
      const hct = getV('panelHematology', 'HCT');

      if (!result.hepatobiliary) result.hepatobiliary = { altAstElevation: 'none', ggtElevation: 'none', bilirubinElevation: 'none', fattyLiver: false, cholecystitis: false, alcoholHistory: 'none' } as any;
      const hep = result.hepatobiliary!;
      if (alt !== null || ast !== null) {
        const maxTransam = Math.max(alt ?? 0, ast ?? 0);
        hep.altAstElevation = maxTransam < 40 ? 'none' : maxTransam < 80 ? 'mild' : maxTransam < 120 ? 'moderate' : 'severe';
      }
      if (ggt !== null) hep.ggtElevation = ggt < 55 ? 'none' : ggt < 100 ? 'mild' : ggt < 200 ? 'moderate' : 'severe';
      if (bilirubin !== null) hep.bilirubinElevation = bilirubin < 21 ? 'none' : bilirubin < 40 ? 'mild' : bilirubin < 60 ? 'moderate' : 'severe';

      if (!result.urinary) result.urinary = { creatinineElevation: 'none', ureaElevation: 'none', proteinuria: false, nephrotoxicDrugs: false, hypertension: false, diabetes: false, urinationPattern: 'normal' } as any;
      if (creatinine !== null) result.urinary!.creatinineElevation = creatinine < 110 ? 'none' : creatinine < 130 ? 'mild' : creatinine < 150 ? 'moderate' : 'severe';

      if (!result.cardio) result.cardio = { bpStage: 'normal', heartRate: 70, ldlElevation: 'none', hctElevation: 'none', hdlLow: false, triglycerides: 'normal', previousCVD: false, familyCVD: false } as any;
      const card = result.cardio!;
      if (ldl !== null) card.ldlElevation = ldl < 3.0 ? 'none' : ldl < 4.0 ? 'mild' : ldl < 5.0 ? 'moderate' : 'severe';
      if (hdl !== null) card.hdlLow = hdl < 1.0;
      if (tg !== null) card.triglycerides = tg < 1.7 ? 'normal' : tg < 2.3 ? 'elevated' : 'high';
      if (hct !== null) card.hctElevation = hct < 52 ? 'none' : hct < 56 ? 'mild' : hct < 60 ? 'moderate' : 'severe';
    } catch {}
  }

  // ── Авто-вывод питания из единого дневника питания ──
  if (!result.nutrition) {
    try {
      const raw = localStorage.getItem('nutrition_diary_v2');
      if (raw) {
        const diary = JSON.parse(raw);
        const today = new Date().toISOString().slice(0, 10);
        const todayEntries = Object.values(diary?.[today]?.meals || {}).flatMap((items: any) => Array.isArray(items) ? items : []);
        if (todayEntries.length > 0) {
          const totals = todayEntries.reduce((acc: any, e: any) => ({
            calories: (acc.calories || 0) + (e.kcal || 0),
            proteinG: (acc.proteinG || 0) + (e.p || 0),
            fatG: (acc.fatG || 0) + (e.f || 0),
            carbsG: (acc.carbsG || 0) + (e.c || 0),
            fiberG: (acc.fiberG || 0) + (e.fiber || 0),
            waterL: (acc.waterL || 0) + (e.water || 0),
          }), {});
          result.nutrition = {
            calories: Math.round(totals.calories || 0),
            proteinG: Math.round(totals.proteinG || 0),
            fatG: Math.round(totals.fatG || 0),
            carbsG: Math.round(totals.carbsG || 0),
            fiberG: Math.round(totals.fiberG || 0),
            waterL: Math.round((totals.waterL || 0) * 10) / 10,
            omega3: false, sodiumMg: 3500, potassiumMg: 4500, saltIntake: 'normal',
          } as any;
        }
      }
    } catch {}
  }

  return result;
}
