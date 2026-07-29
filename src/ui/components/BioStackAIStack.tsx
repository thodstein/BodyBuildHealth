import React, { useState, useMemo, useCallback, useRef } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack, findReplacement, findSupplements, findComplexForStack, type ReplacementResult, type ReplacementType, type ComplexMatch } from '../../engines/supplement-finder.engine';

import { SUPPORT_CATALOG_DATA, CATEGORY_LABELS, ALL_INTERACTIONS, ALL_SUBSTANCES } from '../../data/support-database';
import { decodeGarbled } from '../../utils/text-sanitizer';
import { GlassCard, StatBox, ORGANS, toFinderProfile, ConfirmModal, showToast, PRICE_RUB, estCost, SubstanceMechanismCard, SubstanceTzCard } from './BioStackAIConstants';
import { SUPPLEMENT_COMPOSITION, COMPONENT_TO_COMPLEX } from '../../data/support-meta';
import type { LinkedData } from '../../core/data-link';
import { checkStackToxicity, checkNutrientConflicts, optimizeTiming, findAbsorptionEnhancers, getReminderConfig, saveReminderConfig, scheduleTelegramReminder } from '../../engines/biostack-safety.engine';
import { getStackEffectiveness, trackStackStart } from '../../engines/biostack-feedback.engine';
import { getStackCostBreakdown, buildBudgetStack } from '../../engines/biostack-budget.engine';
import { LAB_MARKER_MAP } from '../../data/lab-marker-map';
import { getEvidenceGrade, findMeaningfulReplacement, selectStack } from '../../engines/biostack-clinical-v2.engine';

const STK_EVIDENCE: Record<string, { label: string; color: string }> = {
  A: { label: 'A', color: '#22c55e' },
  B: { label: 'B', color: '#f59e0b' },
  C: { label: 'C', color: '#6366f1' },
};

const DOMAIN_LABELS_RU: Record<string, string> = {
  antioxidant: 'Антиоксидантная защита',
  hepatic: 'Печень и детокс',
  cardio: 'Сердце и сосуды',
  neuro: 'Нервная система',
  metabolic: 'Метаболизм и энергия',
  detox: 'Детоксикация',
  immune: 'Иммунитет',
  hormonal: 'Гормональная регуляция',
  membrane: 'Клеточные мембраны',
  adaptogen: 'Адаптогенная поддержка',
  general: 'Общая поддержка',
};

function getTitration(id: string, cat: any): string | null {
  const needy = ['ashwagandha', 'rhodiola', 'shilajit', 'berberine', 'tongkat_ali', 'fadogia', 'ashwa', 'probiotics', 'bromelain', 'serrapeptase', 'nattokinase'];
  const lc = id.toLowerCase();
  const catNames = (cat?.category || []).map((c: string) => c.toLowerCase());
  if (needy.some(n => lc.includes(n))) {
    return 'Начать с ½ дозы, увеличивать каждые 3-4 дня на 25% до полной. Контроль ЖКТ.';
  }
  if (catNames.includes('adaptogen') || catNames.includes('hormonal') || catNames.includes('thyroid')) {
    return 'Рекомендуется начать с ½ дозы, титровать в течение 5-7 дней.';
  }
  return null;
}

export function StackTab({ profile, stackIds, setStackIds, allStacks, activeStackIdx, setActiveStackIdx, createStack, deleteStack, renameStack, linked }: {
  profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void;
  allStacks: string[][]; activeStackIdx: number; setActiveStackIdx: (i: number) => void;
  createStack: () => void; deleteStack: (i: number) => void; renameStack: (i: number, name: string) => void;
  linked?: LinkedData;
}) {
  // Stack actions popup state (must be at top level — Rules of Hooks)
  const [actOpen, setActOpen] = useState(false);
  const explanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    const fp = toFinderProfile(profile);
    return explainStack(stackIds, fp);
  }, [stackIds, profile]);

  const synergyExplanation = useMemo(() => {
    if (stackIds.length < 2) return null;

    const pairDetails: Array<{ a: string; b: string; text: string; strength: string; domain: string }> = [];
    const roles: Record<string, string> = {};
    const domainSet = new Set<string>();
    const mechCoverage = new Map<string, string[]>();

    for (const id of stackIds) {
      const cat = SUPPORT_CATALOG_DATA[id];
      if (!cat) continue;
      const name = cat.nameRu || cat.name || id;
      (cat.mechanisms || []).forEach(m => {
        if (!mechCoverage.has(m)) mechCoverage.set(m, []);
        mechCoverage.get(m)!.push(name);
      });
    }

    const DOMAIN_KEYWORDS: Record<string, string[]> = {
      antioxidant: ['ANTIOXIDANT', 'GLUTATHIONE', 'NRF2', 'ROS', 'OXIDATIVE'],
      hepatic: ['LIVER', 'HEPAT', 'BILE', 'CHOLESTASIS', 'GLUTATHIONE'],
      cardio: ['HEART', 'CARDIO', 'VESSEL', 'COENZYME', 'COQ'],
      neuro: ['NEURO', 'GABA', 'DOPAMINE', 'NMDA', 'MYELIN', 'COGNITIVE'],
      metabolic: ['AMPK', 'INSULIN', 'MITOCHONDRIAL', 'GLUCOSE', 'LIPID'],
      detox: ['DETOX', 'CYP450', 'PHASE_II', 'AMMONIA'],
      immune: ['IMMUNE', 'ANTIINFLAMMATORY', 'NFKB', 'CYTOKINE'],
      hormonal: ['TESTOSTERONE', 'AROMATASE', 'PROLACTIN', 'THYROID', 'ESTROGEN'],
      membrane: ['MEMBRANE', 'PHOSPHOLIPID', 'BILE_ACID'],
      adaptogen: ['ADAPTOGEN', 'CORTISOL', 'STRESS', 'ADRENAL'],
    };

    for (let i = 0; i < stackIds.length; i++) {
      for (let j = i + 1; j < stackIds.length; j++) {
        const a = SUPPORT_CATALOG_DATA[stackIds[i]];
        const b = SUPPORT_CATALOG_DATA[stackIds[j]];
        if (!a || !b) continue;

        const nameA = a.nameRu || a.name || '';
        const nameB = b.nameRu || b.name || '';
        const allMechs = [...(a.mechanisms || []), ...(b.mechanisms || [])];

        let domain = 'general';
        for (const [d, kws] of Object.entries(DOMAIN_KEYWORDS)) {
          if (allMechs.some(m => kws.some(kw => m.includes(kw)))) {
            domain = d; domainSet.add(d); break;
          }
        }

        const syns = ALL_INTERACTIONS.filter((int: any) =>
          (int.substanceA === stackIds[i] && int.substanceB === stackIds[j]) ||
          (int.substanceA === stackIds[j] && int.substanceB === stackIds[i])
        );

        if (syns.length > 0) {
          const maxS = syns.reduce((max: number, s: any) => Math.max(max, ['LOW','MEDIUM','HIGH'].indexOf(s.severity || 'MEDIUM')), 0);
          const strength = ['LOW','MEDIUM','HIGH'][maxS];
          const desc = syns.map((s: any) => `${s.effect}${s.mechanism ? ` (${s.mechanism})` : ''}`).join('; ');
          pairDetails.push({ a: nameA, b: nameB, text: desc, strength, domain });
        } else {
          const shared = (a.mechanisms || []).filter((m: string) => (b.mechanisms || []).includes(m));
          if (shared.length > 0) {
            pairDetails.push({ a: nameA, b: nameB, text: `Общая область: ${DOMAIN_LABELS_RU[domain] || 'Общая поддержка'}`, strength: 'MEDIUM', domain });
          } else {
            pairDetails.push({ a: nameA, b: nameB, text: 'Независимые механизмы — взаимодополнение', strength: 'LOW', domain });
          }
        }
      }
    }

    for (const id of stackIds) {
      const cat = SUPPORT_CATALOG_DATA[id];
      if (!cat) { roles[id] = 'support'; continue; }
      const uniqueMechs = (cat.mechanisms || []).filter(m => (mechCoverage.get(m)?.length || 0) === 1);
      const isCore = cat.tier === 'core' || cat.bestForCourse;
      if (isCore) roles[id] = 'core';
      else if (uniqueMechs.length > 0) roles[id] = 'coverage';
      else if ((cat.mechanisms || []).length >= 2) roles[id] = 'synergy';
      else roles[id] = 'support';
    }

    const contributions: Array<{ id: string; text: string }> = [];
    for (const id of stackIds) {
      const cat = SUPPORT_CATALOG_DATA[id];
      if (!cat) continue;
      const uniqueMechs = (cat.mechanisms || []).filter(m => (mechCoverage.get(m)?.length || 0) === 1);
      if (uniqueMechs.length > 0) {
        const ruMech = (cat.mechanismOfAction || cat.description || 'уникальная поддержка').slice(0, 50);
        contributions.push({ id, text: `Единственный источник: ${ruMech}` });
      }
    }

    const domainLabels: Record<string, string> = {
      antioxidant: 'антиоксидантная защита', hepatic: 'гепатопротекция', cardio: 'кардиопротекция',
      neuro: 'нейропротекция', metabolic: 'метаболическая поддержка', detox: 'детоксикация',
      immune: 'иммунная модуляция', hormonal: 'гормональная регуляция', membrane: 'мембранная защита',
      adaptogen: 'адаптогенная поддержка',
    };
    const activeDomains = [...domainSet];
    const cascadeDesc = activeDomains.length > 0
      ? `Принцип: ${activeDomains.map(d => DOMAIN_LABELS_RU[d] || domainLabels[d] || d).join(' → ')}. ${pairDetails.length} синергетических пар, ${contributions.length} уникальных вкладов.`
      : `Стек из ${stackIds.length} препаратов: ${pairDetails.length} взаимодействий.`;

    return { cascadeDesc, pairs: pairDetails, roles, contributions, domains: activeDomains, coverage: [...mechCoverage.entries()].map(([m, ids]) => ({ mechanism: m, coveredBy: ids })) };
  }, [stackIds]);

  const stackSystems = useMemo(() => {
    if (stackIds.length === 0) return [];
    const sys = new Set<string>();
    for (const id of stackIds) {
      const cat = SUPPORT_CATALOG_DATA[id];
      (cat?.systems || []).forEach((s: string) => sys.add(s));
    }
    return [...sys];
  }, [stackIds]);

  const [replacePopup, setReplacePopup] = useState<{ id: string; type: ReplacementType; results: { key: ReplacementType; label: string; icon: string; results: ReplacementResult[] }[]; loading: boolean; name: string } | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const openReplacePopup = useCallback((id: string, name: string) => {
    let fp;
    try { fp = toFinderProfile(profile || ({} as any)); } catch { fp = undefined as any; }
    let allTypes = REPLACE_TYPES.map(rt => {
      const results = findReplacement(id, rt.key, fp);
      return { key: rt.key, label: rt.label, icon: rt.icon, results };
    });
    let nonEmpty = allTypes.filter(t => t.results.length > 0);
    if (nonEmpty.length === 0) {
      // Резерв: если ID не резолвится в каталог (старый/повреждённый стек),
      // подбираем функциональные аналоги по всему каталогу, чтобы попап замены не был пустым.
      const fb: ReplacementResult[] = findSupplements({ profile: fp, maxResults: 15, excludeIds: [id] })
        .filter(c => c.id.toLowerCase() !== id.toLowerCase())
        .slice(0, 8)
        .map<ReplacementResult>(c => ({
          originalId: id,
          replacementId: c.id,
          replacementName: c.name,
          type: 'functional',
          reason: 'Альтернатива из подбора',
          explanation: `Подобрано по профилю. ${(c.mechanisms || []).slice(0, 2).join(', ')}`,
          tierLabel: c.tier || 'standard',
          tierChange: 'same',
          safetyNote: '',
          bestForm: c.bestForm || '',
          priceDelta: 'same',
          safetyDelta: 0,
          personalMatch: true,
        }));
      allTypes = allTypes.map(t => (t.key === 'functional' ? { ...t, results: fb } : t));
      nonEmpty = allTypes.filter(t => t.results.length > 0);
    }
    setReplacePopup({ id, type: nonEmpty[0]?.key || 'functional', results: allTypes, loading: false, name });
  }, [profile]);

  const switchReplaceType = useCallback((type: ReplacementType) => {
    if (!replacePopup) return;
    setReplacePopup(prev => prev ? { ...prev, type } : null);
  }, [replacePopup]);

  const REPLACE_TYPES: { key: ReplacementType; label: string; icon: string }[] = [
    { key: 'direct_analog', label: 'Прямые аналоги', icon: '🔄' },
    { key: 'functional', label: 'Функциональные', icon: '⚙' },
    { key: 'safer', label: 'Безопаснее', icon: '🛡️' },
    { key: 'stronger', label: 'Сильнее', icon: '⚡' },
    { key: 'cheaper', label: 'Дешевле', icon: '💰' },
    { key: 'stack_to_single', label: 'Стек→Один', icon: '⬇' },
    { key: 'single_to_stack', label: 'Один→Стек', icon: '⬆' },
  ];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const dragNode = useRef<number | null>(null);
  const [savedStacks, setSavedStacks] = useState<string[][]>(() => {
    try { return JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]'); } catch { return []; }
  });
  const [confirmClear, setConfirmClear] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  // Track stack start date for effectiveness feedback
  React.useEffect(() => { trackStackStart(stackIds); }, [stackIds]);

  const handleRemove = useCallback((id: string) => {
    setStackIds(stackIds.filter(s => s !== id));
  }, [stackIds, setStackIds]);

  const handleReplace = useCallback((oldId: string, newId: string) => {
    const oldLow = (oldId || '').toLowerCase();
    if (!oldLow || !newId) return;
    setStackIds(stackIds.map(s => s.toLowerCase() === oldLow ? newId : s));
  }, [stackIds, setStackIds]);

  const handleSaveStack = useCallback(() => {
    if (stackIds.length === 0) return;
    const existing: string[][] = JSON.parse(localStorage.getItem('he_finder_saved_stacks') || '[]');
    const updated = [stackIds, ...existing].slice(0, 10);
    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
    setSavedStacks(updated);
  }, [stackIds]);

  const handleClear = useCallback(() => {
    setStackIds([]);
  }, [setStackIds]);



  /* ── Drag & Drop ── */
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragNode.current = idx;
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setDraggedIdx(idx), 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(idx);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const fromIdx = dragNode.current;
    if (fromIdx === null || fromIdx === toIdx) { setDraggedIdx(null); setDropTarget(null); return; }
    const arr = [...stackIds];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    setStackIds(arr);
    setDraggedIdx(null);
    setDropTarget(null);
    dragNode.current = null;
  }, [stackIds, setStackIds]);

  const handleDragEnd = useCallback(() => {
    setDraggedIdx(null);
    setDropTarget(null);
    dragNode.current = null;
  }, []);

  /* ── Compliance Tracker ── */
  const todayKey = new Date().toISOString().slice(0, 10);
  const [compliance, setCompliance] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem('he_biostack_compliance') || '{}'); } catch { return {}; }
  });
  const todayTaken = compliance[todayKey] || [];

  const toggleTaken = useCallback((id: string) => {
    setCompliance(prev => {
      const taken = prev[todayKey] || [];
      const next = taken.includes(id) ? taken.filter(x => x !== id) : [...taken, id];
      const updated = { ...prev, [todayKey]: next };
      localStorage.setItem('he_biostack_compliance', JSON.stringify(updated));
      return updated;
    });
  }, [todayKey]);

  const todayPct = stackIds.length > 0 ? Math.round(todayTaken.length / stackIds.length * 100) : 0;
  const streakDays = (() => {
    let streak = 0;
    const d = new Date();
    while (true) {
      const k = d.toISOString().slice(0, 10);
      const t = compliance[k];
      if (!t || t.length === 0) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  })();

  /* ── Stack Actions ── */
  const [actionResult, setActionResult] = useState<{ title: string; sections: Array<{ icon: string; text: string; color?: string }>; resultStack?: string[] } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const ACTIONS: { id: string; label: string; icon: string; color: string; run: () => void }[] = useMemo(() => [
    { id: 'best', label: 'Собрать лучший', icon: '🏆', color: '#8b5cf6',
      run: () => {
        setActionLoading('best');
        setTimeout(() => {
          const fp = toFinderProfile(profile);
          const lab = (linked as any)?.labAnalysis || null;
          const r = buildStack({ baseIds: [], targetSize: 10, autoFill: true, profile: fp });
          // Клинический шлюз безопасности (как в buildClinicalStack) — единый safety-путь
          const gate = selectStack(r.stack, profile, 'comprehensive', lab);
          const finalStack = gate.ids;
          const removed = r.stack.filter(id => !finalStack.includes(id));
          const exp = explainStack(finalStack, fp);
          const lines = finalStack.map(id => { const c = SUPPORT_CATALOG_DATA[id]; return `• ${c?.nameRu || c?.name || id}`; });
          const disp = synergyExplanation;
          setActionResult({
            title: '🏆 Лучший стек (клинически отфильтрован)',
            sections: [
              { icon: '📋', text: `Состав (${finalStack.length}):\n${lines.join('\n')}`, color: '#8b5cf6' },
              { icon: '🎯', text: `Синергия: ${exp.totalSynergyScore} • Покрытие: ${exp.completeness}% • Механизмов: ${exp.coverage.mechanisms.length}`, color: '#22c55e' },
              { icon: '🔄', text: `Пар синергии: ${exp.pairwiseSynergies.length} из ${(finalStack.length * (finalStack.length - 1)) / 2} возможных`, color: '#60a5fa' },
              { icon: '⚡', text: disp ? disp.cascadeDesc : `Принцип: ${finalStack.length} компонентов, подобранных под профиль`, color: '#f59e0b' },
              ...(removed.length > 0 ? [{ icon: '🛡️', text: `Отсеяно клиническим шлюзом (${removed.length}): противопоказания / ЛС-конфликты / UL`, color: '#ef4444' }] : []),
            ],
            resultStack: finalStack,
          });
          setActionLoading(null);
        }, 500);
      }},
    { id: 'optimize', label: 'Оптимизировать', icon: '⚡', color: '#f59e0b',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('optimize');
        setTimeout(() => {
          const fp = toFinderProfile(profile);
          const lab = (linked as any)?.labAnalysis || null;
          const r = buildStack({ baseIds: stackIds, targetSize: Math.max(stackIds.length, 10), autoFill: true, profile: fp });
          // Клинический шлюз безопасности (как в buildClinicalStack) — единый safety-путь
          const finalStack = selectStack(r.stack, profile, 'comprehensive', lab).ids;
          const exp = explainStack(finalStack, fp);
          const added = finalStack.filter(id => !stackIds.includes(id));
          const removed = stackIds.filter(id => !finalStack.includes(id));
          const addedLines = added.map(id => { const c = SUPPORT_CATALOG_DATA[id]; return `• +${c?.nameRu || c?.name || id}`; });
          const removedLines = removed.map(id => { const c = SUPPORT_CATALOG_DATA[id]; return `• -${c?.nameRu || c?.name || id}`; });
          setActionResult({
            title: '⚡ Оптимизированный стек (клинически отфильтрован)',
            sections: [
              ...(addedLines.length > 0 ? [{ icon: '✅', text: `Добавлено (${addedLines.length}):\n${addedLines.join('\n')}`, color: '#22c55e' }] : []),
              ...(removedLines.length > 0 ? [{ icon: '❌', text: `Удалено (${removedLines.length}):\n${removedLines.join('\n')}`, color: '#ef4444' }] : []),
              ...(addedLines.length === 0 && removedLines.length === 0 ? [{ icon: '💡', text: 'Стек оптимален — изменений не требуется', color: '#22c55e' }] : []),
              { icon: '📊', text: `Синергия: ${exp.totalSynergyScore} (было ${explanation?.totalSynergyScore ?? 0}) • Покрытие: ${exp.completeness}% (было ${explanation?.completeness ?? 0}%)`, color: '#60a5fa' },
            ],
            resultStack: finalStack,
          });
          setActionLoading(null);
        }, 500);
      }},
    { id: 'risks', label: 'Убрать риски', icon: '🛡️', color: '#ef4444',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('risks');
        setTimeout(() => {
          const risky = new Set<string>();
          const conflictDetails: string[] = [];
          for (const a of stackIds) {
            for (const b of stackIds) {
              if (a === b) continue;
              const pair = ALL_INTERACTIONS.find(inx =>
                (inx.substanceA === a && inx.substanceB === b) || (inx.substanceA === b && inx.substanceB === a));
              if (pair && pair.severity === 'HIGH' && (pair.type === 'conflict' || pair.type === 'caution')) {
                if (!risky.has(a) || !risky.has(b)) {
                  const nA = SUPPORT_CATALOG_DATA[a]?.nameRu || SUPPORT_CATALOG_DATA[a]?.name || a;
                  const nB = SUPPORT_CATALOG_DATA[b]?.nameRu || SUPPORT_CATALOG_DATA[b]?.name || b;
                  conflictDetails.push(`• ${nA} + ${nB}: ${pair.effect || 'конфликт'}`);
                }
                risky.add(a); risky.add(b);
              }
            }
          }
          const clean = stackIds.filter(id => !risky.has(id));
          if (clean.length === stackIds.length) {
            setActionResult({ title: '🛡️ Риски не найдены', sections: [{ icon: '✅', text: 'В вашем стеке нет критических взаимодействий.', color: '#22c55e' }] });
          } else {
            const lines = stackIds.filter(id => risky.has(id)).map(id => { const c = SUPPORT_CATALOG_DATA[id]; return `• ${c?.nameRu || c?.name || id} (удалён)`; });
            setActionResult({
              title: `🛡️ Убрано ${risky.size} рискованных`,
              sections: [
                { icon: '🚫', text: `Найдены конфликты:\n${conflictDetails.join('\n')}`, color: '#ef4444' },
                { icon: '🗑', text: `Удалены:\n${lines.join('\n')}`, color: '#f59e0b' },
                { icon: '✅', text: `Осталось: ${clean.length} компонентов`, color: '#22c55e' },
              ],
              resultStack: clean,
            });
          }
          setActionLoading(null);
        }, 400);
      }},
    { id: 'cheaper', label: 'Сделать дешевле', icon: '💰', color: '#22c55e',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('cheaper');
        setTimeout(() => {
          const fp = toFinderProfile(profile);
          const swaps: Array<{ fromId: string; fromName: string; toId: string; toName: string; saving: number }> = [];
          const ns = [...stackIds];
          for (let i = 0; i < ns.length; i++) {
            const id = ns[i];
            const replacements = findReplacement(id, 'cheaper', fp);
            if (replacements.length > 0) {
              const best = replacements[0];
              if (SUPPORT_CATALOG_DATA[best.replacementId]) {
                const fromCost = PRICE_RUB[id] || estCost(id);
                const toCost = PRICE_RUB[best.replacementId] || estCost(best.replacementId);
                if (toCost < fromCost) {
                  swaps.push({
                    fromId: id, fromName: SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id,
                    toId: best.replacementId, toName: best.replacementName,
                    saving: fromCost - toCost,
                  });
                  ns[i] = best.replacementId;
                }
              }
            }
          }
          if (swaps.length === 0) {
            setActionResult({ title: '💰 Оптимизация стоимости', sections: [{ icon: '💡', text: 'Не найдено более дешёвых аналогов в базе. Все вещества уже оптимальны по цене.', color: '#22c55e' }] });
          } else {
            const totalSaving = swaps.reduce((s, x) => s + x.saving, 0);
            const swapLines = swaps.map(s =>
              `• ${s.fromName} (${PRICE_RUB[s.fromId] || estCost(s.fromId)}₽) → ${s.toName} (${PRICE_RUB[s.toId] || estCost(s.toId)}₽) — экономия ${s.saving}₽`
            );
            setActionResult({
              title: `💰 ${swaps.length} замен — экономия ~${totalSaving}₽/мес`,
              sections: [
                { icon: '🔄', text: swapLines.join('\n'), color: '#22c55e' },
                { icon: '💰', text: `Экономия: ${totalSaving}₽/мес (${totalSaving * 12}₽/год)`, color: '#22c55e' },
              ],
              resultStack: ns,
            });
          }
          setActionLoading(null);
        }, 400);
      }},
    { id: 'safer', label: 'Сделать безопаснее', icon: '🛡️', color: '#ec4899',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('safer');
        setTimeout(() => {
          const fp = toFinderProfile(profile);
          const swaps: Array<{ fromId: string; fromName: string; toId: string; toName: string; reason: string }> = [];
          const ns = [...stackIds];
          for (let i = 0; i < ns.length; i++) {
            const id = ns[i];
            const replacements = findReplacement(id, 'safer', fp);
            if (replacements.length > 0) {
              const best = replacements[0];
              if (best.safetyDelta > 0 && SUPPORT_CATALOG_DATA[best.replacementId]) {
                swaps.push({
                  fromId: id, fromName: SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id,
                  toId: best.replacementId, toName: best.replacementName, reason: best.reason,
                });
                ns[i] = best.replacementId;
              }
            }
          }
          if (swaps.length === 0) {
            setActionResult({ title: '🛡️ Оптимизация безопасности', sections: [{ icon: '💡', text: 'Все вещества уже оптимальны по безопасности. Замен не найдено.', color: '#22c55e' }] });
          } else {
            const lines = swaps.map(s => `• ${s.fromName} → ${s.toName}: ${s.reason}`);
            setActionResult({
              title: `🛡️ ${swaps.length} замен на более безопасные`,
              sections: [
                { icon: '🔄', text: lines.join('\n'), color: '#ec4899' },
                { icon: '🛡️', text: 'Замены снижают риск побочных эффектов, сохраняя эффективность', color: '#22c55e' },
              ],
              resultStack: ns,
            });
          }
          setActionLoading(null);
        }, 400);
      }},
    { id: 'budget', label: 'Оптимизировать бюджет', icon: '💵', color: '#06b6d4',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('budget');
        setTimeout(() => {
          const fp = toFinderProfile(profile);
          const currentCost = stackIds.reduce((s, id) => s + (PRICE_RUB[id] || estCost(id)), 0);
          const targetBudget = Math.max(1500, Math.round(currentCost * 0.7));
          const result = buildBudgetStack(fp, targetBudget, undefined, []);
          const curNames = stackIds.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id);
          const budgetNames = result.stack.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id);
          const onlyCur = curNames.filter(n => !budgetNames.includes(n));
          const onlyBud = budgetNames.filter(n => !curNames.includes(n));
          const common = curNames.filter(n => budgetNames.includes(n));
          setActionResult({
            title: `💵 Бюджетная оптимизация · ~${result.totalCost}₽`,
            sections: [
              { icon: '💰', text: `Текущий: ~${currentCost}₽ (${stackIds.length} БАДов)`, color: '#8b5cf6' },
              { icon: '💵', text: `Оптимизированный: ~${result.totalCost}₽ (${result.stack.length} БАДов)`, color: '#06b6d4' },
              { icon: '🔄', text: result.message, color: '#22c55e' },
              ...(onlyCur.length > 0 ? [{ icon: '➖', text: `Убраны: ${onlyCur.slice(0, 5).join(', ')}`, color: '#ef4444' }] : []),
              ...(onlyBud.length > 0 ? [{ icon: '➕', text: `Добавлены: ${onlyBud.slice(0, 5).join(', ')}`, color: '#22c55e' }] : []),
              ...(result.savings.length > 0 ? [{ icon: '💰', text: `Экономия: ${result.savings.reduce((s,x)=>s+x.saved,0)}₽ на исключённых БАДах`, color: '#22c55e' }] : []),
            ],
            resultStack: result.stack,
          });
          setActionLoading(null);
        }, 500);
      }},
    { id: 'complex', label: 'Собрать в комплекс', icon: '📦', color: '#f59e0b',
      run: () => {
        if (stackIds.length < 2) return;
        setActionLoading('complex');
        setTimeout(() => {
          const merges: { targetId: string; targetName: string; ids: string[]; coverage: number }[] = [];
          // Check SUPPLEMENT_COMPOSITION: find complexes whose components are in the stack
          for (const [complexId, components] of Object.entries(SUPPLEMENT_COMPOSITION)) {
            const inStack = components.filter(c => stackIds.some(s => s.toLowerCase() === c.toLowerCase()));
            if (inStack.length >= 2 && SUPPORT_CATALOG_DATA[complexId]) {
              merges.push({
                targetId: complexId,
                targetName: SUPPORT_CATALOG_DATA[complexId]?.nameRu || SUPPORT_CATALOG_DATA[complexId]?.name || complexId,
                ids: inStack,
                coverage: inStack.length / components.length,
              });
            }
          }
          // Also check COMPONENT_TO_COMPLEX for reverse matches
          for (const sid of stackIds) {
            const complexes = COMPONENT_TO_COMPLEX[sid] || COMPONENT_TO_COMPLEX[sid.toLowerCase()] || [];
            for (const cid of complexes) {
              if (merges.some(m => m.targetId === cid)) continue;
              const components = SUPPLEMENT_COMPOSITION[cid] || [];
              const inStack = components.filter(c => stackIds.some(s => s.toLowerCase() === c.toLowerCase()));
              if (inStack.length >= 2 && SUPPORT_CATALOG_DATA[cid]) {
                merges.push({
                  targetId: cid,
                  targetName: SUPPORT_CATALOG_DATA[cid]?.nameRu || SUPPORT_CATALOG_DATA[cid]?.name || cid,
                  ids: inStack,
                  coverage: inStack.length / stackIds.length,
                });
              }
            }
          }
          // Algorithmic: findSingleReplacementForStack is separate - use findComplexForStack
          const algoMatches = findComplexForStack(stackIds);
          for (const m of algoMatches) {
            if (!merges.some(x => x.targetId === m.complexId)) {
              merges.push({
                targetId: m.complexId,
                targetName: m.complexName,
                ids: m.matchedIds,
                coverage: m.coverage,
              });
            }
          }

          if (merges.length === 0) {
            setActionResult({
              title: '📦 Комплексы не найдены',
              sections: [{ icon: '💡', text: 'В базе нет комплексов, покрывающих 2+ вещества из вашего стека. Попробуйте поиск вручную.', color: '#f59e0b' }],
            });
          } else {
            const best = merges.sort((a, b) => b.coverage - a.coverage);
            const lines = best.slice(0, 5).map(m => {
              const names = m.ids.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id).join(', ');
              return `• ${m.targetName} → заменяет ${m.ids.length} шт: ${names} (покрытие ${Math.round(m.coverage * 100)}%)`;
            });
            setActionResult({
              title: `📦 Найдено ${merges.length} комплексов`,
              sections: [
                { icon: '📦', text: `Можно заменить ${best[0]?.ids.length || 0} веществ на один комплекс:\n${lines.join('\n')}`, color: '#fbbf24' },
                { icon: '💡', text: 'Комплекс заменяет несколько отдельных препаратов — меньше капсул, проще приём.', color: '#f59e0b' },
              ],
              resultStack: best.length > 0
                ? [...stackIds.filter(s => !best[0].ids.some(rid => rid.toLowerCase() === s.toLowerCase())), best[0].targetId]
                : stackIds,
            });
          }
          setActionLoading(null);
        }, 500);
      }},
    { id: 'why', label: 'Почему мне хуже', icon: '🤔', color: '#60a5fa',
      run: () => {
        if (stackIds.length === 0) return;
        setActionLoading('why');
        setTimeout(() => {
          const issues: string[] = [];
          const goods: string[] = [];
          for (const id of stackIds) {
            const cat = SUPPORT_CATALOG_DATA[id];
            if (!cat) continue;
            const organs = (cat as any).organs || (cat as any).targetOrgans || [];
            if (profile.drugAllergies?.some(a => a.toLowerCase().includes('penicillin')) && organs.some((o: string) => ['HEART', 'VESSELS'].includes(o))) {
              issues.push(`• ${cat.nameRu || cat.name} — влияет на ССС. При аллергии на пенициллины — контроль.`);
            }
            if (profile.drugAllergies?.some(a => a.toLowerCase().includes('sulfa')) && organs.some((o: string) => ['KIDNEY', 'RENAL'].includes(o))) {
              issues.push(`• ${cat.nameRu || cat.name} — нагрузка на почки. При аллергии на сульфаниламиды — осторожно.`);
            }
            if (organs.some((o: string) => ['LIVER'].includes(o))) {
              goods.push(`• ${cat.nameRu || cat.name} — ✅ поддерживает печень`);
            }
            if (organs.some((o: string) => ['HEART', 'CARDIO'].includes(o))) {
              goods.push(`• ${cat.nameRu || cat.name} — ✅ поддерживает ССС`);
            }
            if (!cat.dosage) {
              issues.push(`• ${cat.nameRu || cat.name} — ⚠ нет дозировки.`);
            }
          }
          const secs: Array<{ icon: string; text: string; color?: string }> = [];
          if (issues.length > 0) secs.push({ icon: '⚠️', text: `Проблемы:\n${issues.join('\n')}`, color: '#ef4444' });
          if (goods.length > 0) secs.push({ icon: '✅', text: `Совпадения с профилем:\n${goods.join('\n')}`, color: '#22c55e' });
          if (issues.length === 0 && goods.length === 0) secs.push({ icon: '💡', text: 'Все компоненты соответствуют профилю.', color: '#22c55e' });
          setActionResult({ title: '🤔 Анализ совместимости с профилем', sections: secs });
          setActionLoading(null);
        }, 500);
      }},
  ], [stackIds, profile, explanation, synergyExplanation, linked]);

  const catLabel = (c: string) => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] || c;

  const cardHeaderS: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
    padding: '8px 10px', borderRadius: 10,
    background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.04)',
  };
  const cardBodyS: React.CSSProperties = {
    padding: '0 10px 10px', marginTop: -4, borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    background: 'rgba(24,24,27,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderTop: 'none',
  };

  const SYSTEM_LABELS_RU: Record<string, string> = {
    hepatic: '🫁 Печень', cardio: '❤️ ССС', renal: '🫘 Почки', neuro: '🧠 Нервная',
    endocrine: '⚖️ Эндокринная', reproductive: '🧬 Репродуктивная', immune: '🛡️ Иммунитет',
    musculo: '💪 Опорно-двиг.', metabolic: '⚡ Метаболизм', gi: '🫃 ЖКТ',
    покровная: '🧴 Кожа', гепатобилиарная: '🫁 Печень+Жёлчь', иммунная: '🛡️ Иммунная',
  };
  /* ── Helpers for stack names ── */
  const stackName = (ids: string[], idx: number): string => {
    const stored = localStorage.getItem(`he_biostack_name_${idx}`);
    if (stored) return stored;
    const top = ids.slice(0, 3).map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id).filter(Boolean);
    if (top.length === 0) return `Стек ${idx + 1}`;
    return top.join(', ') + (ids.length > 3 ? ` +${ids.length - 3}` : '');
  };
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const multiStackHeader = (
    <div>
      <div style={{ display: 'flex', gap: 3, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {allStacks.map((stk, idx) => (
          <div key={idx} onClick={() => { setActiveStackIdx(idx); setEditingIdx(null); }}
            onContextMenu={e => { e.preventDefault(); setEditingIdx(idx); setEditName(stackName(stk, idx)); }}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, padding: '5px 8px', borderRadius: 12,
              cursor: 'pointer', fontSize: 8, fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 160,
              background: activeStackIdx === idx ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
              border: activeStackIdx === idx ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.04)',
              color: activeStackIdx === idx ? '#00e68a' : 'rgba(255,255,255,0.5)',
            }}>
            <span>{stk.length > 0 ? '📋' : '📭'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{stackName(stk, idx)}</span>
            {allStacks.length > 1 && (
              <span onClick={e => { e.stopPropagation(); deleteStack(idx); }}
                style={{ marginLeft: 2, fontSize: 7, color: '#ef4444', cursor: 'pointer' }}>✕</span>
            )}
          </div>
        ))}
        <button onClick={createStack} style={{
          flexShrink: 0, padding: '5px 10px', borderRadius: 12, fontSize: 8, fontWeight: 600, cursor: 'pointer',
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#a78bfa',
        }}>+</button>
      </div>
      {editingIdx !== null && (
        <div style={{ padding: '4px 0', marginBottom: 8, display: 'flex', gap: 4 }}>
          <input value={editName} onChange={e => setEditName(e.target.value)}
            style={{ flex: 1, padding: '4px 8px', borderRadius: 6, fontSize: 8, background: '#202023', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
            placeholder="Название стека" autoFocus />
          <button onClick={() => { renameStack(editingIdx, editName); setEditingIdx(null); }}
            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 8, fontWeight: 600, cursor: 'pointer', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>✓</button>
          <button onClick={() => setEditingIdx(null)}
            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>✕</button>
        </div>
      )}
    </div>
  );

  if (stackIds.length === 0) {
    return (
      <div style={{ paddingBottom: 80 }}>
        {multiStackHeader}

        <div style={{ textAlign: 'center', paddingTop: 30, paddingBottom: 50 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Стек пуст</div>
          <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5, marginBottom: 20 }}>
            Добавьте препараты через вкладки «🔍 Поиск» или «🧩 Сборка» — переключайтесь сверху
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => {
              try { localStorage.setItem('he_biostack_tab', 'select'); window.location.reload(); } catch {}
            }} style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.25)', color: '#00e68a',
            }}>🔍 Перейти к поиску</button>
            <button onClick={() => {
              try { localStorage.setItem('he_biostack_tab', 'build'); window.dispatchEvent(new CustomEvent('he_biostack_smart_build')); } catch {}
            }} style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#8b5cf6',
            }}>🤖 Умная сборка</button>
          </div>

        {/* ═══ Saved stacks ═══ */}
        {savedStacks.length > 0 && (
          <GlassCard title="💾 Сохранённые стеки" icon="📂" color="#8b5cf6">
            {savedStacks.map((stk, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Стек #{i + 1} ({stk.length} шт)</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setStackIds(stk)}
                    style={{ padding: '4px 10px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                      background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a' }}>
                    📥 Загрузить
                  </button>
                  <button onClick={() => {
                    const updated = savedStacks.filter((_, j) => j !== i);
                    localStorage.setItem('he_finder_saved_stacks', JSON.stringify(updated));
                    setSavedStacks(updated);
                  }}
                    style={{ padding: '4px 8px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </GlassCard>
        )}


      </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {multiStackHeader}

      <GlassCard title={`📋 Стек • ${stackIds.length} компонентов`} icon="📊" color="#00e68a">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginBottom: 6 }}>
          <StatBox label="Компонентов" value={stackIds.length} color="#00e68a" />
          <StatBox label="Синергия" value={explanation?.totalSynergyScore ?? 0} color="#8b5cf6" />
          <StatBox label="Покрытие" value={`${explanation?.completeness ?? 0}%`} color="#60a5fa" />
          <StatBox label="С дозой" value={`${explanation?.totalDoseCount ?? 0}/${stackIds.length}`} color="#f59e0b" />
        </div>
        {stackIds.length > 8 && (
          <div style={{ fontSize: 8, color: '#f59e0b', padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)', marginBottom: 6 }}>
            ⚠ Превышен лимит (8) — рекомендуется сократить стек
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <button onClick={handleSaveStack} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a',
          }}>💾 Сохранить стек</button>
          <button onClick={() => setSwapMode(!swapMode)} title="Клик по названию → замена вместо раскрытия" style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            background: swapMode ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
            border: swapMode ? '1.5px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
            color: swapMode ? '#ef4444' : 'rgba(255,255,255,0.5)',
          }}>🔁 {swapMode ? 'Свап ON' : 'Свап-режим'}</button>
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 4, justifyContent: 'flex-end' }}>
          <button onClick={() => {
            const data = JSON.stringify({ stackIds, date: new Date().toISOString(), profile: {} });
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `biostack_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('📤 Стек экспортирован', 'success');
          }} style={{
            padding: '3px 8px', borderRadius: 6, fontSize: 7, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
          }}>📤</button>
          <button onClick={() => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.onchange = (e: any) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(reader.result as string);
                  if (data.stackIds && Array.isArray(data.stackIds)) {
                    setStackIds(data.stackIds);
                    showToast('📥 Стек импортирован', 'success');
                  }
                } catch { showToast('❌ Ошибка импорта', 'error'); }
              };
              reader.readAsText(file);
            };
            input.click();
          }} style={{
            padding: '3px 8px', borderRadius: 6, fontSize: 7, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
          }}>📥</button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button onClick={() => {
            try {
              let arr: any[] = JSON.parse(localStorage.getItem('he_my_stacks') || '[]');
              if (!arr.find((x:any) => x.id === 'biostack_' + stackIds.join('_'))) {
                const subNames = stackIds.slice(0,3).map((id:string) => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id).join(', ');
                arr.push({
                  id: 'biostack_' + stackIds.join('_'), name: 'BioStack AI: ' + subNames + (stackIds.length > 3 ? ' и ещё ' + (stackIds.length-3) : ''),
                  description: synergyExplanation?.cascadeDesc || 'Собран в BioStack AI',
                  system: (stackSystems || []).join(', ') || 'Мультисистемная', subs: stackIds,
                  dosages: {}, timingSummary: '',
                  monitoring: '', specialInstructions: '', contraindications: '', warnings: '',
                  synergyScore: explanation?.totalSynergyScore ?? 0,
                  source: 'BioStack AI', date: new Date().toISOString()
                });
                localStorage.setItem('he_my_stacks', JSON.stringify(arr));
                showToast('✅ Стек сохранён в Мои стеки', 'success');
              } else {
                showToast('ℹ️ Стек уже в Моих стеках', 'info');
              }
            } catch {}
          }} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#818cf8',
          }}>📦 В мои стеки</button>
          <button onClick={() => {
            try {
              const planSubs = { stackIds, dosages: {} as Record<string, { mg: number; timing: string }>, date: new Date().toISOString() };
              for (const id of stackIds) {
                const cat = SUPPORT_CATALOG_DATA[id];
                if (cat?.dosage) {
                  const weightAdj = profile.weight > 90 ? 1.3 : 1.0;
                  planSubs.dosages[id] = { mg: Math.round((cat.dosage.mg || 500) * weightAdj), timing: cat.dosage.timing || 'утро' };
                } else {
                  planSubs.dosages[id] = { mg: 500, timing: 'утро' };
                }
              }
              localStorage.setItem('he_biostack_to_plan', JSON.stringify(planSubs));
              showToast('📋 Стек отправлен в план поддержки! Перейдите в Поддержка → фармплан', 'success');
            } catch {}
          }} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: '#00e68a',
          }}>📋 В план</button>
          <button onClick={() => {
            const lines: string[] = [];
            lines.push(`🧬 BioStack AI — Стек (${stackIds.length} веществ)`);
            lines.push('');
            for (const id of stackIds) {
              const cat = SUPPORT_CATALOG_DATA[id];
              const name = cat?.nameRu || cat?.name || id;
              const dose = cat?.dosage?.mg ? `${cat.dosage.mg} мг` : '—';
              const timing = (cat as any)?.timingDosage || cat?.dosage?.timing || '—';
              const tier = cat?.tier || '';
              lines.push(`• ${name} [${tier}] — ${dose} × ${timing}`);
            }
            if (synergyExplanation) {
              lines.push('');
              lines.push(`🧬 ${synergyExplanation.cascadeDesc}`);
            }
            if (explanation) {
              lines.push(`🎯 Синергия: ${explanation.totalSynergyScore} • Покрытие: ${explanation.completeness}%`);
            }
            const cost = stackIds.reduce((s, id) => s + (PRICE_RUB[id] || 0), 0);
            lines.push(`💰 ~${cost.toLocaleString()} ₽/мес`);
            navigator.clipboard.writeText(lines.join('\n'));
            showToast('📋 Стек скопирован в буфер обмена', 'success');
          }} style={{
            padding: '8px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', color: '#a855f7',
          }}>📋</button>
          <button onClick={() => setConfirmClear(true)} style={{
            flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444',
          }}>🗑 Очистить</button>
        </div>
      </GlassCard>

      {confirmClear && (
        <ConfirmModal
          title="🗑 Очистить стек?"
          text={`Вы уверены, что хотите удалить все ${stackIds.length} препаратов из текущего стека?`}
          confirmLabel="🗑 Очистить"
          cancelLabel="Отмена"
          onConfirm={() => { setConfirmClear(false); handleClear(); }}
          onCancel={() => setConfirmClear(false)}
          confirmColor="#ef4444"
        />
      )}

      {/* 🧬 Почему этот стек работает */}
      {synergyExplanation && (
        <GlassCard title="🧬 Почему этот стек работает" icon="🧬" color="#a855f7">
          <div style={{ fontSize: 12, color: 'rgba(235,235,245,0.8)', lineHeight: 1.5, marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)' }}>
            {synergyExplanation.cascadeDesc}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>🔬 Области покрытия ({synergyExplanation.domains.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {synergyExplanation.domains.map(d => (
                <span key={d} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600 }}>
                  {DOMAIN_LABELS_RU[d] || d}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>🎯 Роли в стеке</div>
              {(['core','synergy','coverage','support'] as const).map(role => {
                const subs = stackIds.filter(id => synergyExplanation.roles[id] === role);
                if (subs.length === 0) return null;
                const rl: Record<string, string> = { core: 'Основные', synergy: 'Синергисты', coverage: 'Покрытие', support: 'Вспомог.' };
                const rc: Record<string, string> = { core: '#00e68a', synergy: '#8b5cf6', coverage: '#60a5fa', support: 'rgba(255,255,255,0.4)' };
                return <div key={role} style={{ fontSize: 11, color: rc[role], marginBottom: 2 }}><strong>{rl[role]}</strong> ({subs.length})</div>;
              })}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>🔄 Пары ({synergyExplanation.pairs.length})</div>
              {synergyExplanation.pairs.slice(0, 6).map((p, i) => (
                <div key={i} style={{ fontSize: 11, color: 'rgba(235,235,245,0.75)', lineHeight: 1.4, padding: '2px 0' }}>
                  {p.a.split(' ').slice(0, 2).join(' ')} + {p.b.split(' ').slice(0, 2).join(' ')}
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4, marginLeft: 6,
                    background: p.strength === 'HIGH' ? 'rgba(34,197,94,0.1)' : p.strength === 'MEDIUM' ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.04)',
                    color: p.strength === 'HIGH' ? '#22c55e' : p.strength === 'MEDIUM' ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                  }}>{p.strength === 'HIGH' ? '🟢' : p.strength === 'MEDIUM' ? '🟡' : '⚪'}</span>
                </div>
              ))}
              {synergyExplanation.pairs.length > 6 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>+{synergyExplanation.pairs.length - 6} ещё</div>}
            </div>
          </div>

          {synergyExplanation.contributions.length > 0 && (
            <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.06)' }}>
              <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>💡 Уникальный вклад:</div>
              {synergyExplanation.contributions.map((c, i) => (
                <div key={i} style={{ fontSize: 11, color: '#4ade80', lineHeight: 1.4, marginBottom: 2 }}>
                  • <strong>{SUPPORT_CATALOG_DATA[c.id]?.nameRu || SUPPORT_CATALOG_DATA[c.id]?.name || c.id}</strong> — {c.text}
                </div>
              ))}
            </div>
          )}

          {explanation?.warnings && explanation.warnings.length > 0 && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>⚠️ Предупреждения</div>
              {explanation.warnings.slice(0, 5).map((w: string, i: number) => <div key={i} style={{ fontSize: 10, color: '#f87171', lineHeight: 1.4 }}>• {w}</div>)}
            </div>
          )}

          {explanation?.timingNotes && explanation.timingNotes.length > 0 && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>⏰ Разнесено по времени (для безопасности)</div>
              {explanation.timingNotes.map((tn: any, i: number) => (
                <div key={i} style={{ fontSize: 10, color: '#93c5fd', lineHeight: 1.4 }}>
                  💡 {tn.note}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* ✅ Compliance Check */}
      <GlassCard title={`✅ Комплаенс • ${todayPct}% сегодня`} icon="✅" color="#22c55e">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: todayPct + '%', height: '100%', borderRadius: 3, background: todayPct >= 80 ? '#22c55e' : todayPct >= 50 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: todayPct >= 80 ? '#22c55e' : todayPct >= 50 ? '#f59e0b' : '#ef4444' }}>{todayTaken.length}/{stackIds.length}</span>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>🔥 {streakDays} дней</span>
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {stackIds.map(id => {
            const cat = SUPPORT_CATALOG_DATA[id];
            const taken = todayTaken.includes(id);
            return (
              <button key={id} onClick={() => toggleTaken(id)} style={{
                padding: '8px 10px', borderRadius: 10, fontSize: 8, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: taken ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${taken ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
                color: taken ? '#22c55e' : 'rgba(255,255,255,0.4)',
                textDecoration: taken ? 'line-through' : 'none',
              }}>
                {taken ? '✅' : '○'} {cat?.nameRu || cat?.name || id}
              </button>
            );
          })}
        </div>
        {/* Механизмы веществ — модель ориентированная на механизмы из калькулятора поддержки */}
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>🧬 Механизмы веществ (по органам/системам)</summary>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {stackIds.map(id => {
              const cat = SUPPORT_CATALOG_DATA[id];
              return (
                <div key={id} style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 8, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{cat?.nameRu || cat?.name || id}</div>
                  <SubstanceMechanismCard id={id} />
                  <SubstanceTzCard id={id} />
                </div>
              );
            })}
          </div>
        </details>
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
          Нажмите на препарат, чтобы отметить как принятый
        </div>

        {/* Compliance 7-day history chart */}
        {stackIds.length > 0 && (
          <div style={{ marginTop: 8, padding: '8px 0 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>📈 Последние 7 дней</div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 40 }}>
              {(() => {
                const days: Array<{ key: string; label: string; taken: number; total: number }> = [];
                const d = new Date();
                for (let i = 6; i >= 0; i--) {
                  const k = d.toISOString().slice(0, 10);
                  const t = compliance[k]?.length || 0;
                  days.push({ key: k, label: d.toLocaleDateString('ru', { weekday: 'short' }).slice(0, 2), taken: t, total: stackIds.length });
                  d.setDate(d.getDate() - 1);
                }
                const maxH = 36;
                return days.map(day => {
                  const h = day.total > 0 ? Math.max(2, (day.taken / day.total) * maxH) : 2;
                  const color = day.taken === 0 ? 'rgba(255,255,255,0.08)' : day.taken >= day.total ? '#22c55e' : day.taken >= day.total * 0.5 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={day.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)' }}>{day.taken}</span>
                      <div style={{ width: '70%', height: h, borderRadius: '2px 2px 0 0', background: color, transition: 'height 0.3s' }} title={`${day.taken}/${day.total}`} />
                      <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)' }}>{day.label}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </GlassCard>

      {/* ⏰ Timing overload warning */}
      {(() => {
        const timingCounts: Record<string, number> = {};
        for (const id of stackIds) {
          const cat = SUPPORT_CATALOG_DATA[id];
          if (!cat) continue;
          const t = (cat as any)?.timingDosage || cat?.dosage?.timing || '';
          if (t && t !== '—') {
            timingCounts[t] = (timingCounts[t] || 0) + 1;
          }
        }
        const overloaded = Object.entries(timingCounts).filter(([, n]) => n >= 3);
        if (overloaded.length > 0) {
          return (
            <GlassCard title="⏰ Перегрузка по времени приёма" icon="⏰" color="#f59e0b" style={{ marginBottom: 10 }}>
              {overloaded.map(([timing, count]) => (
                <div key={timing} style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.1)', marginBottom: 4, fontSize: 8, color: '#fbbf24' }}>
                  ⚠ {count} препаратов в одно время ({timing}). Рекомендуется разнести приём.
                </div>
              ))}
            </GlassCard>
          );
        }
        return null;
      })()}

      {/* 🔬 Nutrient competition warnings */}
      {(() => {
        const compWarnings = checkNutrientConflicts(stackIds);
        const timingRecs = optimizeTiming(stackIds);
        const absEnhancers = findAbsorptionEnhancers(stackIds).filter(e => !e.inStack);
        if (compWarnings.length === 0 && timingRecs.length === 0 && absEnhancers.length === 0) return null;
        return (
          <GlassCard title="🥗 Нутрициология: оптимизация усвоения" icon="🥗" color="#f59e0b">
            {compWarnings.length > 0 && (
              <div style={{ marginBottom: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.1)' }}>
                <div style={{ fontSize: 7, fontWeight: 600, color: '#fbbf24', marginBottom: 3 }}>⚡ Конкуренция нутриентов — разнесите приём:</div>
                {compWarnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 7, color: '#fbbf24', lineHeight: 1.3, marginBottom: 2 }}>
                    {w.nameA} + {w.nameB}: {w.effect} → {w.recommendation}
                  </div>
                ))}
              </div>
            )}
            {timingRecs.length > 0 && (
              <div style={{ marginBottom: 6, padding: '4px 6px', borderRadius: 6, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.1)' }}>
                <div style={{ fontSize: 7, fontWeight: 600, color: '#60a5fa', marginBottom: 3 }}>🕐 Оптимизация времени приёма:</div>
                {timingRecs.map((r, i) => (
                  <div key={i} style={{ fontSize: 7, color: '#60a5fa', lineHeight: 1.3, marginBottom: 2 }}>
                    {r.name}: сейчас «{r.currentTiming}» → лучше «{r.type === 'fat_soluble' ? 'с жирной едой' : r.type === 'sedative' ? 'вечером' : r.type === 'stimulant' ? 'утром' : 'с едой'}» ({r.reason.slice(0, 80)})
                  </div>
                ))}
              </div>
            )}
            {absEnhancers.length > 0 && (
              <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.1)' }}>
                <div style={{ fontSize: 7, fontWeight: 600, color: '#22c55e', marginBottom: 3 }}>💡 Улучшите усвоение — добавьте в стек:</div>
                {absEnhancers.slice(0, 3).map((e, i) => (
                  <div key={i} style={{ fontSize: 7, color: '#22c55e', lineHeight: 1.3, marginBottom: 1 }}>
                    {e.targetName} + {e.enhancerName}: {e.effect.slice(0, 80)}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        );
      })()}

      {/* 🛡️ Toxicity check */}
      {(() => {
        const toxWarnings = checkStackToxicity(stackIds);
        if (toxWarnings.length === 0) return null;
        return (
          <GlassCard title="🛡️ Проверка дозировок (UL)" icon="🛡️" color="#ef4444">
            {toxWarnings.map((w, i) => (
              <div key={i} style={{
                padding: '4px 6px', borderRadius: 6, marginBottom: 2,
                background: w.severity === 'danger' ? 'rgba(239,68,68,0.08)' : w.severity === 'warning' ? 'rgba(251,191,36,0.08)' : 'rgba(34,197,94,0.06)',
                border: `1px solid ${w.severity === 'danger' ? 'rgba(239,68,68,0.15)' : w.severity === 'warning' ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.1)'}`,
              }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: w.severity === 'danger' ? '#ef4444' : w.severity === 'warning' ? '#fbbf24' : '#22c55e', lineHeight: 1.3 }}>
                  {w.message}
                </div>
              </div>
            ))}
          </GlassCard>
        );
      })()}

      {/* 📊 Эффективность стека (feedback loop) */}
      {(() => {
        const feedback = getStackEffectiveness(stackIds, [], 14);
        if (!feedback || feedback.symptomTrends.length === 0) return null;
        return (
          <GlassCard title={`📊 Эффективность стека · ${feedback.overallScore}/100`} icon="📊" color={feedback.overallScore >= 60 ? '#22c55e' : feedback.overallScore >= 40 ? '#f59e0b' : '#ef4444'}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <StatBox label="Улучшается" value={feedback.improvingGoals.length} color="#22c55e" />
              <StatBox label="Ухудшается" value={feedback.worseningGoals.length} color="#ef4444" />
              <StatBox label="Стабильно" value={feedback.stableGoals.length} color="#f59e0b" />
              <StatBox label="Симптомов" value={feedback.symptomTrends.length} color="#60a5fa" />
            </div>
            {feedback.symptomTrends.slice(0, feedbackExpanded ? 99 : 4).map((t, i) => (
              <div key={i} style={{ fontSize: 7, color: t.trend === 'improving' ? '#22c55e' : t.trend === 'worsening' ? '#ef4444' : 'rgba(255,255,255,0.4)', lineHeight: 1.3, marginBottom: 1 }}>
                {t.trend === 'improving' ? '✅' : t.trend === 'worsening' ? '⚠' : '•'} {t.label}: {t.startAvg} → {t.endAvg} ({(t.delta > 0 ? '↓' : '↑')}{Math.abs(t.delta)})
                {t.relatedGoals.length > 0 && <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 2 }}>🎯 {t.relatedGoals.join(', ')}</span>}
              </div>
            ))}
            {feedback.symptomTrends.length > 4 && (
              <button onClick={() => setFeedbackExpanded(!feedbackExpanded)} style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 7, cursor: 'pointer', marginTop: 2,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
              }}>{feedbackExpanded ? 'Свернуть' : `+ ещё ${feedback.symptomTrends.length - 4}`}</button>
            )}
            {feedback.recommendations.length > 0 && (
              <div style={{ marginTop: 4, padding: '4px 6px', borderRadius: 6, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.1)' }}>
                {feedback.recommendations.slice(0, 2).map((r, i) => (
                  <div key={i} style={{ fontSize: 7, color: '#60a5fa', lineHeight: 1.3 }}>{r}</div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
              Период: {feedback.startDate} — {feedback.endDate}
            </div>
          </GlassCard>
        );
      })()}

      {/* 🔬 Лабораторная корреляция стека */}
      {(() => {
        const affectedMarkers = LAB_MARKER_MAP.filter(m =>
          m.correctionIds.some(cid => stackIds.some(sid => sid.toLowerCase().includes(cid.toLowerCase()) || cid.toLowerCase().includes(sid.toLowerCase())))
        );
        if (affectedMarkers.length === 0) return null;
        return (
          <GlassCard title={`🔬 Влияние стека на анализы · ${affectedMarkers.length} маркеров`} icon="🔬" color="#60a5fa">
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {affectedMarkers.slice(0, 12).map((m, i) => {
                const affectingSubs = stackIds.filter(sid =>
                  m.correctionIds.some(cid => sid.toLowerCase().includes(cid.toLowerCase()) || cid.toLowerCase().includes(sid.toLowerCase()))
                );
                return (
                  <span key={i} title={`Влияет: ${affectingSubs.map(s => SUPPORT_CATALOG_DATA[s]?.nameRu || s).join(', ')}`}
                    style={{ padding: '2px 6px', borderRadius: 6, fontSize: 7, fontWeight: 600,
                      background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.12)', color: '#60a5fa' }}>
                    {m.name} ← {affectingSubs.length} БАД
                  </span>
                );
              })}
            </div>
            <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
              Маркеры, на которые БАДы в стеке оказывают корректирующее влияние
            </div>
          </GlassCard>
        );
      })()}

      {/* 🔔 Telegram напоминания */}
      {(() => {
        const config = getReminderConfig();
        const toggle = () => {
          const updated = { ...config, enabled: !config.enabled };
          saveReminderConfig(updated);
          if (updated.enabled) scheduleTelegramReminder(updated);
          window.dispatchEvent(new Event('storage'));
        };
        const tg = (window as any).Telegram?.WebApp;
        if (!tg) return null;
        return (
          <GlassCard title="🔔 Напоминания Telegram" icon="🔔" color="#8b5cf6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#fff', marginBottom: 1 }}>
                  {config.enabled ? '🔔 Включены' : '🔕 Выключены'}
                </div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
                  {config.enabled ? `Утро ${config.morningTime} · Вечер ${config.eveningTime}` : 'Нажмите для включения ежедневных напоминаний'}
                </div>
              </div>
              <button onClick={toggle} style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                background: config.enabled ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${config.enabled ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
                color: config.enabled ? '#00e68a' : 'rgba(255,255,255,0.5)',
              }}>{config.enabled ? 'ON' : 'OFF'}</button>
            </div>
          </GlassCard>
        );
      })()}

      {/* 🚀 Действия со стеком — компактная кнопка-попап */}
      {(() => {
        return (
          <>
            <button onClick={() => setActOpen(true)} style={{
              width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 11, fontWeight: 800,
              cursor: 'pointer', marginBottom: 6,
              background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border: 'none', color: '#fff',
              boxShadow: '0 2px 12px rgba(139,92,246,0.15)',
            }}>
              🚀 Действия со стеком
            </button>

            {actOpen && <div style={{
              position: 'fixed', inset: 0, zIndex: 250,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.85)'
            }} onClick={() => setActOpen(false)}>
              <div onClick={e => e.stopPropagation()} style={{
                width: '88%', maxWidth: 360, maxHeight: '75vh', borderRadius: 16,
                background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
              }}>
                <div style={{ height: 3, background: 'linear-gradient(90deg,#8b5cf6,#6d28d9)' }} />
                <div style={{ padding: '14px 16px', maxHeight: 'calc(75vh - 3px)', overflowY: 'auto' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd', marginBottom: 10 }}>🚀 Действия со стеком</div>

                  {ACTIONS.map(a => (
                    <button key={a.id} onClick={() => { a.run(); setActOpen(false); }} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '10px 14px', marginBottom: 4, borderRadius: 10,
                      cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      background: actionLoading === a.id ? `${a.color}15` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${actionLoading === a.id ? a.color : 'rgba(255,255,255,0.06)'}`,
                      color: actionLoading === a.id ? a.color : 'rgba(255,255,255,0.8)',
                    }}>
                      <span style={{ fontSize: 18 }}>{a.icon}</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.label}</div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                          {a.id === 'best' ? 'Сборка оптимального стека под ваш профиль' :
                           a.id === 'optimize' ? 'Добавить недостающие компоненты' :
                           a.id === 'risks' ? 'Убрать конфликтующие препараты' :
                           a.id === 'cheaper' ? 'Найти бюджетные аналоги' :
                           a.id === 'safer' ? 'Заменить на более безопасные аналоги' :
                           a.id === 'budget' ? 'Собрать стек под заданный бюджет' :
                           a.id === 'complex' ? 'Заменить N препаратов одним комплексом' :
                           'Анализ совместимости с профилем'}
                        </div>
                      </div>
                    </button>
                  ))}

                  <button onClick={() => {
                    setActOpen(false);
                     const result = selectStack(stackIds, profile, 'comprehensive');
                     const curNames = stackIds.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id);
                     const altNames = result.ids.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id);
                     const common = curNames.filter(n => altNames.includes(n));
                     const onlyCur = curNames.filter(n => !altNames.includes(n));
                     const onlyAlt = altNames.filter(n => !curNames.includes(n));
                     setActionResult({
                       title: '⚖ Сравнение: текущий vs клинический алгоритм',
                       sections: [
                         { icon: '📋', text: `Текущий (${stackIds.length}): ${curNames.join(', ')}`, color: '#8b5cf6' },
                         { icon: '🩺', text: `Клинический (${result.ids.length}): ${altNames.join(', ')}`, color: '#60a5fa' },
                         ...(common.length > 0 ? [{ icon: '🔄', text: `Общие (${common.length}): ${common.join(', ')}`, color: '#22c55e' }] : []),
                         ...(onlyCur.length > 0 ? [{ icon: '➖', text: `Только в текущем: ${onlyCur.join(', ')}`, color: '#f59e0b' }] : []),
                         ...(onlyAlt.length > 0 ? [{ icon: '➕', text: `Только в клиническом: ${onlyAlt.join(', ')}`, color: '#22c55e' }] : []),
                         ...(result.hardStops.length > 0 ? [{ icon: '🛑', text: `Жёсткие стопы: ${result.hardStops.map(h => h.substanceName).join(', ')}`, color: '#ef4444' }] : []),
                         ...(result.drugExclusions.length > 0 ? [{ icon: '⚠️', text: `Исключения по ЛС: ${result.drugExclusions.map(e => e.drug + '→' + e.substanceName).join(', ')}`, color: '#f59e0b' }] : []),
                       ],
                     });
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '10px 14px', marginBottom: 4, borderRadius: 10,
                    cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa',
                  }}>
                    <span style={{ fontSize: 18 }}>⚖</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>Сравнить по действию</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>Smart-алгоритм vs текущий стек</div>
                    </div>
                  </button>

                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '8px 0 4px' }}>
                    Нажмите вне окна для закрытия
                  </div>
                </div>
              </div>
            </div>}
          </>
        );
      })()}

      {actionResult && (
        <GlassCard title={actionResult.title} icon="📊" color="#8b5cf6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {actionResult.sections.map((sec, i) => (
              <div key={i} style={{
                padding: '5px 8px', borderRadius: 6,
                background: sec.color ? `${sec.color}08` : 'rgba(255,255,255,0.02)',
                border: sec.color ? `1px solid ${sec.color}15` : '1px solid rgba(255,255,255,0.03)',
              }}>
                <div style={{ fontSize: 9, color: sec.color || 'rgba(255,255,255,0.6)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                  {sec.icon && <span style={{ marginRight: 4 }}>{sec.icon}</span>}{sec.text}
                </div>
              </div>
            ))}
          </div>
          {actionResult.resultStack && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button onClick={() => { setStackIds(actionResult.resultStack!); setActionResult(null); }} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
              }}>📥 Применить стек</button>
              <button onClick={() => setActionResult(null)} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
              }}>✕</button>
            </div>
          )}
          {!actionResult.resultStack && (
            <button onClick={() => setActionResult(null)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 7, fontWeight: 600, cursor: 'pointer', marginTop: 4,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
            }}>✕ Закрыть</button>
          )}
        </GlassCard>
      )}

      {explanation?.warnings && explanation.warnings.length > 0 && (
        <GlassCard title="⚠ Предупреждения" icon="⚠" color="#ef4444">
          {explanation.warnings.slice(0, 6).map((w, i) => (
            <div key={i} style={{ fontSize: 9, color: '#f87171', lineHeight: 1.4, padding: '2px 0' }}>• {w}</div>
          ))}
        </GlassCard>
      )}

      {/* ── Одна карточка со всеми препаратами стека ── */}
      <GlassCard title={`📦 Препараты стека · ${stackIds.length} шт`} icon="📋" color="#00e68a" style={{ marginBottom: 10 }}>
        {explanation?.substances.map((entry, idx) => {
          const cat = SUPPORT_CATALOG_DATA[entry.id]
            || SUPPORT_CATALOG_DATA[entry.id?.toUpperCase()]
            || SUPPORT_CATALOG_DATA[(entry.id || '').toLowerCase()]
            || SUPPORT_CATALOG_DATA[entry.id?.replace(/-/g, '_')];
          if (!cat) {
            return (
              <div key={entry.id || idx} style={{
                padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{entry.name || entry.id}</div>
              </div>
            );
          }
          const isExpanded = expanded[entry.id];
          const isDragging = draggedIdx === idx;
          const isDropOver = dropTarget === idx && draggedIdx !== idx;
          const synergiesInStack = explanation.substances
            .filter(s => s.id !== entry.id)
            .map(s => {
              const found = entry.synergiesWith.find(x => x.with === s.id);
              return found ? { name: s.name || '', effect: found.effect } : null;
            })
            .filter((x): x is { name: string; effect: string } => x !== null);

          return (
            <div key={entry.id} draggable onDragStart={e => handleDragStart(e, idx)} onDragOver={e => handleDragOver(e, idx)}
              onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, idx)} onDragEnd={handleDragEnd}
              className={isDragging ? 'bio-dragging' : isDropOver ? 'bio-drag-over' : ''}
              style={{ marginBottom: 4, transition: 'all 0.15s ease' }}>
              <div onClick={() => {
                if (swapMode) { openReplacePopup(entry.id, cat.nameRu || cat.name); }
                else { setExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] })); }
              }} style={{
                ...cardHeaderS, margin: isExpanded ? '0 0 0 0' : '0',
                borderBottomLeftRadius: isExpanded ? 0 : 8, borderBottomRightRadius: isExpanded ? 0 : 8,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 1 }}>
                    {cat.nameRu || cat.name}
                    {(() => { const g = getEvidenceGrade(entry.id); const ev = STK_EVIDENCE[g] || STK_EVIDENCE.C; return <span key="ev" title={`Доказательность: ${g}`} style={{ padding: '1px 4px', borderRadius: 4, fontSize: 6, fontWeight: 700, marginLeft: 5, background: ev.color + '18', color: ev.color, border: `1px solid ${ev.color}30` }}>{ev.label}</span>; })()}
                    <span style={{
                      fontSize: 7, marginLeft: 5, fontWeight: 600,
                      color: synergyExplanation?.roles[entry.id] === 'core' ? '#00e68a'
                        : synergyExplanation?.roles[entry.id] === 'coverage' ? '#60a5fa'
                        : synergyExplanation?.roles[entry.id] === 'synergy' ? '#8b5cf6'
                        : '#00e68a',
                    }}>
                      ({synergyExplanation?.roles[entry.id]
                        ? ({ core: 'основной', synergy: 'синергист', coverage: 'покрытие', support: 'вспом.' } as Record<string, string>)[synergyExplanation.roles[entry.id]]
                        : entry.role})
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', color: '#00e68a', fontSize: 8, fontWeight: 600 }}>{catLabel(cat.tier)}</span>
                    {(cat.category || []).slice(0, 2).map((c: string, i: number) => (
                      <span key={i} style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(96,165,250,0.08)', color: '#60a5fa', fontSize: 8 }}>{catLabel(c)}</span>
                    ))}
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>💊 {cat.dosage?.mg ? `${cat.dosage.mg} мг · ${cat.dosage?.timing || (cat as any)?.timingDosage || '—'}` : '—'}</span>
                  </div>
                  {(cat.mechanismOfAction || entry.mechanism) && (
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', lineHeight: 1.3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {(cat.mechanismOfAction || entry.mechanism).slice(0, 80)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={(e) => { e.stopPropagation(); openReplacePopup(entry.id, cat.nameRu || cat.name); }}
                    title="Найти замену" style={{
                      padding: '6px 8px', borderRadius: 6, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                      minWidth: 38, minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6',
                    }}>🔄</button>
                  <button onClick={(e) => { e.stopPropagation(); handleRemove(entry.id); }} title="Удалить из стека" style={{
                    padding: '6px 8px', borderRadius: 6, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                    minWidth: 38, minHeight: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444',
                  }}>✕</button>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', minWidth: 16, textAlign: 'center' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{
                  padding: '4px 10px 8px', borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
                  background: 'rgba(24,24,27,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderTop: 'none',
                }}>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, marginBottom: 6 }}>
                    🧬 <strong style={{ color: '#a78bfa' }}>Механизм:</strong> {cat.mechanismOfAction || entry.mechanism}
                  </div>

                  {(() => {
                    const t = getTitration(entry.id, cat);
                    if (!t) return null;
                    return (
                      <div style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.1)', marginBottom: 4, fontSize: 7, color: '#fbbf24', lineHeight: 1.3 }}>
                        📈 Титрование: {t}
                      </div>
                    );
                  })()}
                  {cat.description && (
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, marginBottom: 4 }}>
                      📝 {decodeGarbled(cat.description)}
                    </div>
                  )}

                  {(() => {
                    const contrib = synergyExplanation?.contributions.find(c => c.id === entry.id);
                    if (!contrib) return null;
                    return (
                      <div style={{ padding: '3px 6px', borderRadius: 6, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.06)', marginBottom: 4 }}>
                        <div style={{ fontSize: 7, color: '#22c55e', fontWeight: 600 }}>💡 {contrib.text}</div>
                      </div>
                    );
                  })()}

                  {synergiesInStack.length > 0 && (
                    <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)', marginBottom: 4 }}>
                      <div style={{ fontSize: 7, color: '#8b5cf6', fontWeight: 600, marginBottom: 1 }}>🤝 Синергии в стеке:</div>
                      {synergiesInStack.map((s, i) => (
                        <div key={i} style={{ fontSize: 7, color: '#a78bfa', lineHeight: 1.3 }}>• {s.name} → {s.effect}</div>
                      ))}
                    </div>
                  )}

                  {cat.contraindications && cat.contraindications.length > 0 && (
                    <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.06)', marginBottom: 4 }}>
                      <div style={{ fontSize: 7, color: '#ef4444', fontWeight: 600, marginBottom: 1 }}>⚠ Противопоказания:</div>
                      <div style={{ fontSize: 7, color: '#f87171', lineHeight: 1.3 }}>{cat.contraindications.slice(0, 2).join(', ')}</div>
                    </div>
                  )}

                  {cat.sideEffects && cat.sideEffects.length > 0 && (
                    <div style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.06)', marginBottom: 4 }}>
                      <div style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, marginBottom: 1 }}>⚡ Побочные:</div>
                      <div style={{ fontSize: 7, color: '#fbbf24', lineHeight: 1.3 }}>{cat.sideEffects.slice(0, 2).join(', ')}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </GlassCard>

      {/* Global replace popup — rendered inline (no portal needed after backdrop-filter fix) */}
      {replacePopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 251,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.88)', padding: 16,
        }} onClick={() => setReplacePopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 420, maxHeight: '82vh', borderRadius: 18,
            background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#8b5cf6,#6d28d9)', flexShrink: 0 }} />
            {/* Header */}
            <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#c4b5fd' }}>
                🔄 Замена: {replacePopup.name}
              </div>
              <button onClick={(e) => { e.stopPropagation(); setReplacePopup(null); }} style={{
                width: 30, height: 30, borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 700, lineHeight: 1, flexShrink: 0,
              }}>✕</button>
            </div>
            {/* Scrollable body */}
            <div style={{ padding: '12px 18px', overflowY: 'auto', flex: 1 }}>
              {/* Meaningful replacement (profile-aware) */}
              {(() => {
                let mr: ReturnType<typeof findMeaningfulReplacement> = null;
                try { mr = findMeaningfulReplacement(replacePopup.id, profile || ({} as any)); } catch { mr = null; }
                if (!mr) return null;
                const cat = SUPPORT_CATALOG_DATA[mr.replacementId];
                if (!cat) return null;

                // Терапевтический класс
                const classMatch = mr.reason?.match(/Терапевтический класс: ([^—]+)/);
                const classLabel = classMatch ? classMatch[1].trim() : '';

                // Форма, доза, timing
                const formInfo: string[] = [];
                if (mr.form) formInfo.push(mr.form);
                if (mr.doseMg) formInfo.push(`${mr.doseMg} мг`);
                if (mr.timing) formInfo.push(mr.timing);

                const equivColor = mr.clinicalEquivalence === 'high' ? '#22c55e'
                                 : mr.clinicalEquivalence === 'moderate' ? '#f59e0b'
                                 : mr.clinicalEquivalence === 'low' ? '#ef4444'
                                 : '#94a3b8';
                const equivLabel = mr.clinicalEquivalence === 'high' ? '✅ Высокая'
                                 : mr.clinicalEquivalence === 'moderate' ? '⚠ Умеренная'
                                 : mr.clinicalEquivalence === 'low' ? '⛔ Низкая'
                                 : '';

                return (
                  <div style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.16)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>💊 Осмысленная замена (по профилю и анализам)</div>
                    <div onClick={() => { handleReplace(replacePopup.id, mr.replacementId); setReplacePopup(null); }} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                        {mr.replacementName}
                        {mr.gradeUpgrade ? <span style={{ marginLeft: 6, padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: 'rgba(34,197,94,0.14)', color: '#22c55e' }}>↑ грейд</span> : null}
                      </div>

                      {classLabel && (
                        <div style={{ fontSize: 9, color: '#00e68a', marginTop: 2, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', display: 'inline-block', fontWeight: 600 }}>
                          💊 {classLabel}
                        </div>
                      )}
                      {formInfo.length > 0 && (
                        <div style={{ fontSize: 9, color: '#60a5fa', marginTop: 2, padding: '2px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.1)', display: 'inline-block', marginLeft: 4, fontWeight: 500 }}>
                          📋 {formInfo.join(' · ')}
                        </div>
                      )}
                      {equivLabel && (
                        <div style={{ fontSize: 9, color: equivColor, marginTop: 2, padding: '2px 6px', borderRadius: 4, background: `${equivColor}15`, display: 'inline-block', marginLeft: 4, fontWeight: 600 }}>
                          {equivLabel} эквив.
                        </div>
                      )}

                      {mr.doseWarning && (
                        <div style={{ fontSize: 10, color: '#f87171', marginTop: 4, lineHeight: 1.3, padding: '4px 6px', background: 'rgba(239,68,68,0.08)', borderRadius: 4, border: '1px solid rgba(239,68,68,0.2)' }}>
                          {mr.doseWarning}
                          {mr.recommendedDoseMg && ` Рекомендуется: ${mr.recommendedDoseMg} мг.`}
                        </div>
                      )}

                      {mr.clinicalNote && (
                        <div style={{ fontSize: 10, color: '#fbbf24', marginTop: 4, lineHeight: 1.3, padding: '4px 6px', background: 'rgba(251,191,36,0.06)', borderRadius: 4, border: '1px solid rgba(251,191,36,0.15)' }}>
                          ⚠️ {mr.clinicalNote}
                        </div>
                      )}

                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, marginTop: 3 }}>{mr.reason}</div>
                      {mr.safetyNote && <div style={{ fontSize: 10, color: '#f59e0b', lineHeight: 1.3, marginTop: 3 }}>⚠ {mr.safetyNote}</div>}
                    </div>
                  </div>
                );
              })()}

              {/* Type tabs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 4, marginBottom: 12 }}>
                {replacePopup.results.filter(rt => rt.results.length > 0).map(rt => (
                  <button key={rt.key} onClick={() => switchReplaceType(rt.key)} style={{
                    padding: '8px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: replacePopup.type === rt.key ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                    color: replacePopup.type === rt.key ? '#a78bfa' : 'rgba(255,255,255,0.6)',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span>{rt.icon}</span>
                    <span>{rt.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, opacity: 0.6 }}>{rt.results.length}</span>
                  </button>
                ))}
              </div>

              {/* Results list */}
              {(() => {
                const active = replacePopup.results.find(rt => rt.key === replacePopup.type);
                if (!active || active.results.length === 0) {
                  return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }}>
                    Нет подходящих замен. Попробуйте другой тип поиска.
                  </div>;
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {active.results.slice(0, 8).map((r, i) => (
                      <div key={i} onClick={() => { handleReplace(replacePopup.id, r.replacementId); setReplacePopup(null); }}
                        style={{
                          padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                          background: r.personalMatch ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${r.personalMatch ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.05)'}`,
                          transition: 'all 0.12s',
                        }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{r.replacementName}</span>
                          <div style={{ display:'flex', gap: 4 }}>
                            <span style={{ padding:'2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                              background: r.tierChange==='upgrade'?'rgba(0,230,138,0.12)':r.tierChange==='downgrade'?'rgba(239,68,68,0.1)':'rgba(255,255,255,0.04)',
                              color: r.tierChange==='upgrade'?'#00e68a':r.tierChange==='downgrade'?'#ef4444':'rgba(255,255,255,0.35)',
                            }}>{r.tierChange==='upgrade'?'↑ тир':r.tierChange==='downgrade'?'↓ тир':'∼'}</span>
                            <span style={{ padding:'2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                              background: r.priceDelta==='cheaper'?'rgba(0,230,138,0.1)':r.priceDelta==='expensive'?'rgba(239,68,68,0.1)':'rgba(255,255,255,0.04)',
                              color: r.priceDelta==='cheaper'?'#00e68a':r.priceDelta==='expensive'?'#ef4444':'rgba(255,255,255,0.3)',
                            }}>{r.priceDelta==='cheaper'?'💰-':r.priceDelta==='expensive'?'💰+':'💰='}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{r.reason}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                          {r.explanation}
                          {r.bestForm && <span style={{ color:'#60a5fa' }}> · 💊 {r.bestForm}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            {/* Footer */}
            <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <button onClick={() => setReplacePopup(null)} style={{
                width:'100%', padding:'12px 0', borderRadius: 12, cursor: 'pointer',
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700,
              }}>✕ Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
