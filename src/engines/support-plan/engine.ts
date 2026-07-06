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
} from './engine-helpers';
import { evaluateRecommendations } from '../recommendation-engine';
import { calculateTzSpecRisk, calculateTzSpecRiskTimeline, type TzSpecInput, type TzSpecResult } from '../risk-engine-tz-spec';
import { SUPPLEMENTS_DB } from '../../data/support-db/supplements';
import { PHARMACY_DB } from '../../data/support-db/pharmacy-db';

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

    // ── 1. Обязательные препараты на курсе ААС (mandatory logic) ──
    if (state.pharma.aas.length > 0) {
      if (!state.pharma.hasHCG && !isUsed('hcg')) { substances.push('hcg'); markUsed('hcg'); }
      const hasArom = state.pharma.aas.some((a: any) => (a.id||'').toLowerCase().includes('test') || (a.id||'').toLowerCase().includes('meth'));
      if (hasArom && !state.pharma.hasAI && !isUsed('anastrozole') && !isUsed('tamoxifen')) { substances.push('anastrozole'); markUsed('anastrozole'); }
      if (state.pharma.aas.some((a: any) => ['tren','nandrolone','deca','npp','trest'].some(x => (a.id||'').toLowerCase().includes(x)))) {
        if (!state.pharma.hasCaber && !isUsed('cabergoline')) { substances.push('cabergoline'); markUsed('cabergoline'); }
      }
    }

    // ── 2. Рекомендации по анализам ──
    const resultPre: any = { selectedSubstances: substances, schedule: [], synergyIdsUsed: synergyIds, overallRiskBefore: 0, overallRiskAfter: 0 };
    const recommendations = evaluateRecommendations(state, resultPre);
    for (const rec of recommendations)
      for (const sub of rec.substances)
        if (!isUsed(sub.id)) { substances.push(sub.id); markUsed(sub.id); }

    // 2a. Отмечаем какие системы уже покрыты рекомендациями
    const recCoveredSystems = new Set<string>();
    for (const rec of recommendations) {
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

    if (Object.keys(allDb).length > 0) {
      const baseRange = levelTargets[state.powerLevel] ?? [40, 50];
      const targetMax = Math.max(5, baseRange[1] - (state.boostEnabled ? 5 : 0));
      const targetMin = Math.max(5, baseRange[0] - (state.boostEnabled ? 5 : 0));
      const target = targetMin;
      const maxPerSys = (maxPerSystem[state.powerLevel] ?? 2) + (state.boostEnabled ? 1 : 0);

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
          if (isUsed(id) || !entries.length) continue;
          if (tBoosterBlacklist.has(id)) continue;
          if (TZ_AUTO_BLACKLIST.has(id)) continue;
          let matchCount = 0; let totalK = 0;
          for (const e of entries) {
            if (systemsNeedingCoverage.includes(e.organId as RiskSystemId)) { matchCount++; totalK += e.k; }
          }
          if (matchCount > 0) {
            const synBonus = synergyScoreWithPlan(id, substances);
            scored.push([id, matchCount, totalK, synBonus]);
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
            if (isUsed(id)) continue;
            if (tBoosterBlacklist.has(id)) continue;
            if (TZ_AUTO_BLACKLIST.has(id)) continue;
            if (conflictScoreWithPlan(id, substances) > 0) continue;
            for (const e of entries) {
              if ((e.organId === tzSys || e.organId === sys) && e.k > 0) {
                const synBonus = synergyScoreWithPlan(id, substances);
                const compositeScore = e.k + synBonus * 0.3;
                if (!best || compositeScore > (best[1] + best[2] * 0.3)) {
                  best = [id, e.k, synBonus];
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
            if (isUsed(id)) continue;
            if (tBoosterBlacklist.has(id)) continue;
            if (TZ_AUTO_BLACKLIST.has(id)) continue;
            if (conflictScoreWithPlan(id, substances) > 0) continue;
            const hasSys = entries.some(e => e.organId === tzSys || e.organId === sys);
            if (!hasSys) continue;
            const synScore = synergyScoreWithPlan(id, substances);
            if (synScore < 4) continue;
            const bestK = Math.max(...entries.filter(e => e.organId === tzSys || e.organId === sys).map(e => e.k));
            if (!bestBoost || synScore > bestBoost[1] || (synScore === bestBoost[1] && bestK > bestBoost[2])) {
              bestBoost = [id, synScore, bestK];
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

    // ── 4. Суставы: добавляем в ЕДИНЫЙ substances, тег в jointSubs ──
    const jointSubs: string[] = [];
    if (state.jointMode) {
      const jointIds = ['collagen','glucosamine','msm','boswellia','chondroitin_sulfate','hyaluronic_acid','bpc157','tb500','vitamin_c','curcumin','omega3'];
      for (const jid of jointIds) {
        if (!isUsed(jid)) { substances.push(jid); markUsed(jid); jointSubs.push(jid); }
      }
    }

    // ── 5. Репродуктивная система: добавляем в ЕДИНЫЙ substances ──
    if (state.reproMode) {
      const reproIds = ['hcg','zinc','vitamin_d3','coq10','ashwagandha','saw_palmetto'];
      for (const rid of reproIds) {
        if (!isUsed(rid)) { substances.push(rid); markUsed(rid); }
      }
    }

    // ── 6. Нейропротекция: добавляем в ЕДИНЫЙ substances, тег в neuroSubs ──
    const neuroSubs: string[] = [];
    if (state.neuroMode) {
      const neuroIds = ['nac','alpha_lipoic','omega3','coq10','magnesium','lions_mane','theanine','tyrosine','vitamin_b6','vitamin_b12','folate','ashwagandha','bromantan','fasoracetam','huperzine','semax','cerebrolysin'];
      for (const nid of neuroIds) {
        if (!isUsed(nid)) { substances.push(nid); markUsed(nid); neuroSubs.push(nid); }
      }
    }

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

    const tzInputFinal = buildTzInput(state, substances);
    if (tzInputFinal) {
      tzResultFinal = calculateTzSpecRisk(tzInputFinal);
      finalScores = tzToScores(tzResultFinal, oldScores);
      overallRaw = tzResultFinal.overallRaw;
      overallAfterSupport = tzResultFinal.overallAfter;
    } else {
      finalScores = oldScores;
      overallRaw = Math.round(Math.max(...Object.values(oldScores)));
      const cw = state.courseWeek ?? 1;
      const weekProtectionBonus = Math.min(0.15, cw * 0.015);
      const protBase = 0.3 + (synergyIds.length * 0.02) + weekProtectionBonus;
      const levelMult = state.powerLevel === 'max' ? 0.65 : state.powerLevel === 'mid' ? 0.50 : 0.35;
      const protection = Math.min(0.85, protBase + levelMult);
      overallAfterSupport = Math.round(Math.max(5, overallRaw - Math.round(overallRaw * protection)));
    }

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

    const result: CalculatorResult = {
      risk: { systems: [], overallRaw, overallAfterSupport, timestamp: new Date().toISOString() },
      schedule, selectedSubstances: substances,
      jointSubs: jointSubs.length > 0 ? jointSubs : undefined,
      neuroSubs: neuroSubs.length > 0 ? neuroSubs : undefined,
      synergyIdsUsed: synergyIds,
      titrationApplied: titration,
      labDeltas, overallRiskBefore: overallRaw, overallRiskAfter: overallAfterSupport,
      contraindicationAlerts: getContraindicationAlerts(state),
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
      result.profile = {
        weight: s.weight || 80, age: s.age || 30, sex: (s.sex || 'male') as 'male' | 'female',
        height: s.height, bodyfat: s.bodyFat,
        workoutsPerWeek: s.workoutsPerWeek || 3, avgWorkoutMinutes: s.avgWorkoutMinutes || 60,
        sleepHours: s.sleepHours || 7, stressLevel: s.stressLevel || 4,
        smoker: s.smoker || false, alcohol: s.alcohol || 'rare', caffeineMg: s.caffeineMg || 100,
      };
      if (s.genetics && !result.genetics) {
        result.genetics = {
          cyp19a1: s.genetics.CYP19A1 || s.genetics.cyp19a1 || 'unknown',
          srd5a2: s.genetics.SRD5A2 || s.genetics.srd5a2 || 'unknown',
          arSensitivity: s.genetics.AR || s.genetics.ar || 'unknown',
          mthfr: s.genetics.MTHFR || s.genetics.mthfr || 'unknown',
        };
      }
      if (!result.contraindications) {
        const ci = s.chronicConditions || [];
        result.contraindications = {
          allergies: (s.foodAllergies || []).join(', '),
          hasCVD: ci.includes('heart') || ci.includes('hypertension'),
          hasThrombophilia: false,
          hasGI: false,
          hasProstateIssues: false,
          hasDiabetes: ci.includes('diabetes'),
          hasEpilepsy: false,
          hasMentalIllness: false,
          hasLiverDisease: ci.includes('liver'),
          hasKidneyDisease: ci.includes('kidney'),
        };
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
  return result;
}
