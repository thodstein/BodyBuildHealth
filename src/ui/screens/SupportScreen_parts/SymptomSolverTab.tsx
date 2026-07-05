// @ts-nocheck
import React, { useState, useMemo, useCallback } from 'react';
import {
  SYMPTOM_DB, SYMPTOM_CATEGORY_LABELS, SYMPTOM_CATEGORY_ICONS,
  PROBABILITY_LABELS, PROBABILITY_COLORS, EVIDENCE_LABELS, EVIDENCE_COLORS,
  URGENCY_LABELS, URGENCY_COLORS, URGENCY_ICONS,
  DRUG_LABELS, DRUG_CATEGORIES, DRUG_CAT_COLORS,
  searchSymptoms, findSymptomById, findSymptomsByDrug, getAllLinkedDrugs, getSymptomStats,
  type SymptomEntry, type ProblemEntry, type SymptomCategory, type UrgencyLevel,
} from '../../../engines/symptom-solver.engine';
import {
  resolveCatalogId, isLifestyleOnly, getSymptomSolutionDisplayName, getCatalogEntryForSymptomSolution,
} from '../../../engines/symptom-catalog-bridge';
import {
  derivePlanFromSymptoms, getUrgencyLabel, groupSubstancesBySystem,
  type SelectedSymptom,
} from '../../../engines/symptom-priority-engine';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';

const glassCard: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 12, background: 'var(--bg-secondary)',
  border: '1px solid var(--border)', marginBottom: 8,
};

const pillBtn = (active: boolean, accent?: string): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 16, fontSize: 9, fontWeight: 700,
  whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
  background: active ? (accent || 'var(--accent)') : 'var(--bg-secondary)',
  color: active ? '#000' : 'var(--text-dim)',
  border: `1px solid ${active ? (accent || 'var(--accent)') : 'var(--border)'}`,
  transition: 'all 0.15s',
});

const chip = (bg: string, fg?: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 10,
  fontSize: 9, fontWeight: 600, background: bg, color: fg || '#fff',
  marginRight: 4, marginBottom: 2,
});

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--accent)',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px',
};

const CATEGORIES: SymptomCategory[] = [
  'cardiovascular', 'hepatic', 'renal', 'cns', 'endocrine',
  'gastrointestinal', 'musculoskeletal', 'hematologic', 'dermatologic', 'psychological',
];

const URGENCY_ORDER: Record<UrgencyLevel, number> = { critical: 0, warning: 1, standard: 2 };

const SAVED_KEY = 'he_symptom_analyses';

const DRUG_FILTER_GROUPS = [
  { label: 'Все ААС', filter: 'all_aas', icon: '💉', cat: 'AAS' },
  { label: 'Тренболон', filter: 'trenbolone', icon: '⚡', cat: 'AAS' },
  { label: 'Нандролон', filter: 'nandrolone', icon: '🧬', cat: 'AAS' },
  { label: 'Оксиметолон', filter: 'oxymetholone', icon: '💊', cat: 'AAS' },
  { label: 'Станозолол', filter: 'stanozolol', icon: '🏃', cat: 'AAS' },
  { label: 'Эквипойз', filter: 'equipoise', icon: '🐎', cat: 'AAS' },
  { label: 'Анавар', filter: 'anavar', icon: '🟢', cat: 'AAS' },
  { label: 'Мастерон', filter: 'masteron', icon: '🎯', cat: 'AAS' },
  { label: 'Все оралы', filter: 'all_orals', icon: '⚠️', cat: 'Группа' },
  { label: '19-нор', filter: 'all_19nor', icon: '🧬', cat: 'Группа' },
  { label: 'GH', filter: 'gh', icon: '🧪', cat: 'GH' },
  { label: 'Инсулин', filter: 'insulin', icon: '💉', cat: 'Инсулин' },
  { label: 'IGF-1', filter: 'igf1', icon: '🔬', cat: 'Пептид' },
  { label: 'BPC-157', filter: 'bpc157', icon: '🧬', cat: 'Пептид' },
  { label: 'TB-500', filter: 'tb500', icon: '🧬', cat: 'Пептид' },
  { label: 'SARM', filter: 'rad140', icon: '🧫', cat: 'SARM' },
  { label: 'Кленбутерол', filter: 'clenbuterol', icon: '🫁', cat: 'Стим.' },
  { label: 'T3/T4', filter: 't3', icon: '🔥', cat: 'Тиреоид' },
  { label: 'AI', filter: 'ai', icon: '🛡️', cat: 'Вспом.' },
  { label: 'SERM', filter: 'clomid', icon: '🛡️', cat: 'SERM' },
  { label: 'hCG', filter: 'hcg', icon: '⚕️', cat: 'Вспом.' },
  { label: 'Каберголин', filter: 'cabergoline', icon: '💊', cat: 'Вспом.' },
  { label: 'Метформин', filter: 'metformin', icon: '⚖️', cat: 'Вспом.' },
  { label: 'Телмисартан', filter: 'telmisartan', icon: '❤️', cat: 'Вспом.' },
  { label: 'Финастерид', filter: 'finasteride', icon: '💇', cat: 'Вспом.' },
  { label: 'Изотретиноин', filter: 'isotretinoin', icon: '🧴', cat: 'Вспом.' },
];

export const SymptomSolverTab: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const [selectedCategory, setSelectedCategory] = useState<SymptomCategory | 'all'>('all');
  const [selectedDrug, setSelectedDrug] = useState<string | null>(null);
  const [selectedSymptom, setSelectedSymptom] = useState<SymptomEntry | null>(null);
  const [expandedProblem, setExpandedProblem] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
  });

  // ── НОВОЕ: Выбранные симптомы + проблемные индексы для построения плана ──
  const [selectedForPlan, setSelectedForPlan] = useState<Record<string, number[]>>(() => {
    try { return JSON.parse(localStorage.getItem('he_symptom_selected') || '{}'); } catch { return {}; }
  });
  const [planToast, setPlanToast] = useState('');
  const [showPlanSummary, setShowPlanSummary] = useState(false);

  const allDrugs = useMemo(() => getAllLinkedDrugs(), []);

  const filteredSymptoms = useMemo(() => {
    let base = SYMPTOM_DB;
    if (searchQuery.trim()) base = searchSymptoms(searchQuery);
    if (selectedDrug) base = findSymptomsByDrug(selectedDrug);
    if (selectedCategory !== 'all') base = base.filter((s) => s.category === selectedCategory);
    return base.sort((a, b) =>
      (URGENCY_ORDER[a.urgency || 'standard'] || 2) - (URGENCY_ORDER[b.urgency || 'standard'] || 2));
  }, [selectedCategory, searchQuery, selectedDrug]);

  const groupedByCategory = useMemo(() => {
    const map: Record<string, SymptomEntry[]> = {};
    for (const s of filteredSymptoms) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return map;
  }, [filteredSymptoms]);

  const stats = useMemo(() => getSymptomStats(), []);

  // ── Логика выбора симптомов ──
  const toggleSymptomSelection = (symId: string, problemIdx?: number) => {
    setSelectedForPlan((prev: Record<string, number[]>) => {
      const next = { ...prev };
      if (problemIdx === undefined) {
        // toggle whole symptom
        if (next[symId] && next[symId].length === 0) {
          // already selected with empty = all, deselect
          delete next[symId];
        } else {
          // select all problems
          next[symId] = [];
        }
      } else {
        // toggle specific problem
        const current = next[symId] || [];
        if (current.length === 0) {
          // was "all" → now select specific
          const sym = findSymptomById(symId);
          if (sym) {
            next[symId] = [problemIdx];
          }
        } else {
          const idx = current.indexOf(problemIdx);
          if (idx >= 0) {
            if (current.length === 1) {
              delete next[symId];
            } else {
              next[symId] = current.filter((i: number) => i !== problemIdx);
            }
          } else {
            next[symId] = [...current, problemIdx].sort();
          }
        }
      }
      localStorage.setItem('he_symptom_selected', JSON.stringify(next));
      return next;
    });
  };

  const isSymptomSelected = (symId: string): boolean => {
    return symId in selectedForPlan;
  };

  const isProblemSelected = (symId: string, problemIdx: number): boolean => {
    const val = selectedForPlan[symId];
    if (!val) return false;
    return val.length === 0 || val.includes(problemIdx);
  };

  const selectedSymptomsList = useMemo(() => {
    return Object.keys(selectedForPlan).map((id) => findSymptomById(id)).filter(Boolean) as SymptomEntry[];
  }, [selectedForPlan]);

  const derivedPlan = useMemo(() => {
    if (selectedSymptomsList.length === 0) return null;
    return derivePlanFromSymptoms(selectedSymptomsList, selectedForPlan);
  }, [selectedSymptomsList, selectedForPlan]);

  // ── Добавление вещества в план ──
  const addSubstanceToPlan = (substanceId: string, name: string) => {
    const catalogId = resolveCatalogId(substanceId);
    if (!catalogId) {
      setPlanToast(`«${name}» — образ жизни, не добавляется в план`);
      setTimeout(() => setPlanToast(''), 3000);
      return;
    }
    // Получаем текущие subs из состояния
    const currentSubs: string[] = s.supportDrugs || [];
    if (currentSubs.includes(catalogId)) {
      setPlanToast(`«${name}» уже в плане`);
    } else {
      const newSubs = [...currentSubs, catalogId];
      s.setSupportDrugs(newSubs);
      setPlanToast(`«${name}» добавлен в план`);
      // Пересчитываем план, если есть calcSupport
      if (typeof s.calcSupport === 'function') {
        setTimeout(() => s.calcSupport(s.supportLevel, newSubs), 100);
      }
    }
    setTimeout(() => setPlanToast(''), 3000);
  };

  // ── Создать план по выбранным симптомам ──
  const createPlanFromSymptoms = () => {
    if (!derivedPlan) return;
    const currentSubs: string[] = s.supportDrugs || [];
    const merged = [...new Set([...currentSubs, ...derivedPlan.substanceIds])];
    s.setSupportDrugs(merged);
    setShowPlanSummary(true);
    setPlanToast(`План создан: ${derivedPlan.substanceIds.length} веществ по ${derivedPlan.symptomCount} симптомам`);
    setTimeout(() => setPlanToast(''), 4000);
    setShowPlanSummary(false);
  };

  const clearSelection = () => {
    setSelectedForPlan({});
    localStorage.setItem('he_symptom_selected', '{}');
  };

  const toggleSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ═══ ДЕТАЛЬНЫЙ ПРОСМОТР СИМПТОМА ═══
  if (selectedSymptom) {
    const related = (selectedSymptom.relatedSymptoms || [])
      .map((rid) => findSymptomById(rid))
      .filter(Boolean) as SymptomEntry[];

    return (
      <div style={{ padding: '0 0 80px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={() => setSelectedSymptom(null)} style={{
            ...pillBtn(false), fontSize: 11, background: 'transparent',
            color: 'var(--accent)', border: '1px solid var(--accent)',
          }}>← Назад</button>
          <button onClick={() => toggleSaved(selectedSymptom.id)} style={{
            ...pillBtn(false), fontSize: 11, background: 'transparent',
            color: savedIds.includes(selectedSymptom.id) ? '#ff9800' : 'var(--text-dim)',
            border: `1px solid ${savedIds.includes(selectedSymptom.id) ? '#ff9800' : 'var(--border)'}`,
          }}>{savedIds.includes(selectedSymptom.id) ? '★ Сохранено' : '☆ Сохранить'}</button>
          {/* Кнопка выбора симптома для плана */}
          <button onClick={() => toggleSymptomSelection(selectedSymptom.id)}
            style={pillBtn(isSymptomSelected(selectedSymptom.id), '#8b5cf6')}>
            {isSymptomSelected(selectedSymptom.id) ? '✓ В плане' : '☐ В план'}
          </button>
        </div>

        <div style={{ ...glassCard, borderColor: selectedSymptom.urgency ? URGENCY_COLORS[selectedSymptom.urgency] : 'var(--border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{SYMPTOM_CATEGORY_ICONS[selectedSymptom.category]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {selectedSymptom.symptom}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={chip('var(--accent)')}>{SYMPTOM_CATEGORY_LABELS[selectedSymptom.category]}</span>
                {selectedSymptom.urgency && (
                  <span style={chip(URGENCY_COLORS[selectedSymptom.urgency])}>
                    {URGENCY_ICONS[selectedSymptom.urgency]} {URGENCY_LABELS[selectedSymptom.urgency]}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: '1.5', marginTop: 6 }}>
            {selectedSymptom.generalInfo}
          </div>
          {selectedSymptom.linkedDrugs && selectedSymptom.linkedDrugs.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 8, color: 'var(--text-light)' }}>Связан с:</span>
              {selectedSymptom.linkedDrugs.map((did) => {
                const cat = DRUG_CATEGORIES[did] || '';
                const color = DRUG_CAT_COLORS[cat] || '#607d8b';
                return (
                  <span key={did} style={chip(color)}>
                    {DRUG_LABELS[did] || did}
                  </span>
                );
              })}
            </div>
          )}
          {selectedSymptom.quickFacts && selectedSymptom.quickFacts.length > 0 && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Быстрые факты</div>
              {selectedSymptom.quickFacts.map((f, i) => (
                <div key={i} style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: '1.5', paddingLeft: 4 }}>• {f}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginTop: 14, marginBottom: 6 }}>
          Возможные причины ({selectedSymptom.problems.length})
        </div>
        {selectedSymptom.problems.map((problem: ProblemEntry, idx: number) => (
          <div key={idx} style={glassCard}>
            <div onClick={() => setExpandedProblem(idx === expandedProblem ? -1 : idx)} style={{ cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    {idx + 1}. {problem.problem}
                  </div>
                  <span style={chip(PROBABILITY_COLORS[problem.probability])}>{PROBABILITY_LABELS[problem.probability]} вероятность</span>
                </div>
                <span style={{ fontSize: 14, color: 'var(--text-dim)', transition: 'transform 0.2s', transform: expandedProblem === idx ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: '1.5', marginTop: 6 }}>
                <strong>Механизм:</strong> {problem.mechanism}
              </div>
            </div>
            {expandedProblem === idx && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <div style={{ ...sectionTitle, fontSize: 10, marginBottom: 6 }}>Необходимые анализы ({problem.labMarkers.length})</div>
                {problem.labMarkers.map((lm, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.08)', fontSize: 10 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{lm.marker}</span>
                      <span style={{ color: 'var(--accent)', marginLeft: 4 }}>{lm.expectedChange}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-dim)', fontSize: 9 }}>Цель: {lm.targetRange}</div>
                      <div style={{ color: 'var(--text-light)', fontSize: 8 }}>{lm.when}</div>
                    </div>
                  </div>
                ))}

                <div style={{ ...sectionTitle, fontSize: 10, marginTop: 12, marginBottom: 6 }}>Препараты и решения ({problem.solutions.length})</div>
                {problem.solutions.map((sol, i) => {
                  const catalogEntry = getCatalogEntryForSymptomSolution(sol.substanceId);
                  return (
                    <div key={i} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 4, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)', fontSize: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, gap: 4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                          {getSymptomSolutionDisplayName(sol.substanceId, sol.name)}
                        </span>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                          <span style={chip(sol.type === 'pharma' ? '#e91e63' : sol.type === 'supplement' ? '#3b82f6' : '#ff9800')}>
                            {sol.type === 'pharma' ? 'Фарма' : sol.type === 'supplement' ? 'БАД' : 'Образ жизни'}
                          </span>
                          <span style={chip(EVIDENCE_COLORS[sol.evidenceLevel])}>{EVIDENCE_LABELS[sol.evidenceLevel]}</span>
                          {/* КНОПКА «В ПЛАН» */}
                          {sol.type !== 'lifestyle' && catalogEntry && (
                            <button
                              onClick={() => addSubstanceToPlan(sol.substanceId, sol.name)}
                              title="Добавить в план поддержки"
                              style={{
                                padding: '2px 8px', borderRadius: 8, fontSize: 8, fontWeight: 700,
                                cursor: 'pointer', background: 'rgba(0,230,138,0.12)',
                                border: '1px solid rgba(0,230,138,0.3)', color: 'var(--accent)',
                                whiteSpace: 'nowrap',
                              }}
                            >➕ В план</button>
                          )}
                        </div>
                      </div>
                      <div style={{ color: 'var(--text-dim)', fontSize: 9, marginBottom: 2 }}><strong>Доза:</strong> {sol.dose}</div>
                      <div style={{ color: 'var(--text-light)', fontSize: 9, fontStyle: 'italic' }}>{sol.mechanism}</div>
                    </div>
                  );
                })}

                <div style={{ ...sectionTitle, fontSize: 10, marginTop: 12, marginBottom: 6 }}>К чему быть готовым ({problem.expectations.length})</div>
                {problem.expectations.map((exp, i) => (
                  <div key={i} style={{ padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(255,152,0,0.05)', border: '1px solid rgba(255,152,0,0.1)', fontSize: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 700, color: '#ff9800', minWidth: 70, flexShrink: 0, fontSize: 9, padding: '1px 4px', borderRadius: 6, background: 'rgba(255,152,0,0.1)', textAlign: 'center' }}>{exp.timeline}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'var(--text)', lineHeight: '1.4' }}>{exp.effect}</div>
                        {exp.sideNote && <div style={{ color: '#f44336', fontSize: 9, marginTop: 2 }}>⚠ {exp.sideNote}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {related.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Связанные симптомы ({related.length})</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {related.map((rs) => (
                <button key={rs.id} onClick={() => { setSelectedSymptom(rs); setExpandedProblem(0); }} style={{ ...pillBtn(false), fontSize: 9, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: 'var(--text)' }}>
                  {SYMPTOM_CATEGORY_ICONS[rs.category]} {rs.symptom}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══ СПИСОК СИМПТОМОВ ═══
  return (
    <div style={{ padding: '0 0 80px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>
        🩺 Симптом → Проблема → Анализ → Решение
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
        Профессиональный анализатор: {stats.totalSymptoms} симптомов, {stats.totalProblems} диагнозов, {stats.totalSolutions} решений
        {stats.criticalCount > 0 && <span style={{ color: '#f44336', fontWeight: 600 }}> · {stats.criticalCount} критических</span>}
        {stats.warningCount > 0 && <span style={{ color: '#ff9800', fontWeight: 600 }}> · {stats.warningCount} требующих внимания</span>}
      </div>

      {/* ПАНЕЛЬ: Выбранные симптомы → Создать план */}
      {selectedSymptomsList.length > 0 && (
        <div style={{ marginBottom: 10, position: 'relative' }}>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(0,230,138,0.08))', border: '1px solid rgba(139,92,246,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6' }}>
                ☑ {selectedSymptomsList.length} симптом{selectedSymptomsList.length === 1 ? '' : 'ов'} выбрано
              </span>
              <button onClick={clearSelection} style={{
                padding: '2px 8px', borderRadius: 8, fontSize: 8, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)',
              }}>✕ Сбросить</button>
            </div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
              {selectedSymptomsList.slice(0, 8).map((sym) => (
                <span key={sym.id} style={chip('#8b5cf6', '#fff')}>
                  {SYMPTOM_CATEGORY_ICONS[sym.category]} {sym.symptom.length > 20 ? sym.symptom.slice(0, 20) + '…' : sym.symptom}
                </span>
              ))}
              {selectedSymptomsList.length > 8 && (
                <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>+{selectedSymptomsList.length - 8}</span>
              )}
            </div>
            {derivedPlan && (
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>
                Рекомендовано веществ: <strong>{derivedPlan.substanceIds.length}</strong>
                {derivedPlan.requiresDoctor && (
                  <span style={{ color: '#f44336', marginLeft: 6 }}>🔴 Требуется врач</span>
                )}
              </div>
            )}
            <button
              onClick={createPlanFromSymptoms}
              disabled={!derivedPlan || derivedPlan.substanceIds.length === 0}
              style={{
                width: '100%', padding: '8px 0', borderRadius: 10, fontSize: 10, fontWeight: 700,
                cursor: derivedPlan?.substanceIds.length ? 'pointer' : 'not-allowed',
                background: derivedPlan?.substanceIds.length ? 'linear-gradient(135deg, #8b5cf6, #00e68a)' : 'var(--bg-secondary)',
                border: 'none', color: derivedPlan?.substanceIds.length ? '#000' : 'var(--text-dim)',
                opacity: derivedPlan?.substanceIds.length ? 1 : 0.5,
              }}
            >📋 Создать план поддержки по симптомам</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {planToast && (
        <div style={{
          position: 'fixed', bottom: 20, left: 16, right: 16, zIndex: 200,
          padding: '10px 14px', borderRadius: 12,
          background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(0,230,138,0.3)',
          color: '#00e68a', fontSize: 11, fontWeight: 600, textAlign: 'center',
          backdropFilter: 'blur(8px)',
        }}>{planToast}</div>
      )}

      {/* Сохранённые */}
      {savedIds.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#ff9800', marginBottom: 4 }}>★ Сохранённые анализы ({savedIds.length})</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {savedIds.map((sid) => { const s = findSymptomById(sid); if (!s) return null; return (
              <button key={sid} onClick={() => setSelectedSymptom(s)} style={{ ...pillBtn(false), fontSize: 9, background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.25)', color: 'var(--text)' }}>
                {SYMPTOM_CATEGORY_ICONS[s.category]} {s.symptom}
              </button>
            );})}
          </div>
        </div>
      )}

      {/* Поиск */}
      <input type="text" placeholder="Поиск симптома, проблемы, механизма..."
        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 20, fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none', marginBottom: 8 }}
      />

      {/* Фильтр по препаратам */}
      {!searchQuery && selectedCategory === 'all' && (
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', marginBottom: 10, scrollbarWidth: 'none', flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedDrug(null)} style={pillBtn(!selectedDrug)}>
            Все препараты
          </button>
          {DRUG_FILTER_GROUPS.map((dg) => (
            <button key={dg.filter} onClick={() => setSelectedDrug(selectedDrug === dg.filter ? null : dg.filter)}
              style={pillBtn(selectedDrug === dg.filter, DRUG_CAT_COLORS[dg.cat])}>
              {dg.icon} {dg.label}
            </button>
          ))}
        </div>
      )}

      {/* Фильтр категорий */}
      {!searchQuery && (
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 12, scrollbarWidth: 'none', flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedCategory('all')} style={pillBtn(selectedCategory === 'all')}>
            Все ({stats.totalSymptoms})
          </button>
          {CATEGORIES.map((cat) => {
            const count = SYMPTOM_DB.filter((s) => s.category === cat).length;
            return (
              <button key={cat} onClick={() => setSelectedCategory(cat)} style={pillBtn(selectedCategory === cat)}>
                {SYMPTOM_CATEGORY_ICONS[cat]} {SYMPTOM_CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Сетка симптомов */}
      {Object.entries(groupedByCategory).map(([cat, symptoms]) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{SYMPTOM_CATEGORY_ICONS[cat as SymptomCategory]}</span>
            {SYMPTOM_CATEGORY_LABELS[cat as SymptomCategory]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {symptoms.map((sym) => (
              <div key={sym.id} style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                {/* Кнопка выбора для плана */}
                <button
                  onClick={() => toggleSymptomSelection(sym.id)}
                  style={{
                    width: 28, minWidth: 28, borderRadius: 8,
                    background: isSymptomSelected(sym.id) ? '#8b5cf6' : 'var(--bg-secondary)',
                    border: `1px solid ${isSymptomSelected(sym.id) ? '#8b5cf6' : 'var(--border)'}`,
                    color: isSymptomSelected(sym.id) ? '#fff' : 'var(--text-dim)',
                    fontSize: 11, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                  title={isSymptomSelected(sym.id) ? 'Убрать из плана' : 'Добавить в план'}
                >{isSymptomSelected(sym.id) ? '✓' : '+'}</button>

                {/* Карточка симптома */}
                <button onClick={() => setSelectedSymptom(sym)} style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)',
                  border: `1px solid ${sym.urgency && sym.urgency !== 'standard' ? URGENCY_COLORS[sym.urgency] + '44' : 'var(--border)'}`,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }} onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(0,230,138,0.04)';
                }} onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = sym.urgency && sym.urgency !== 'standard' ? URGENCY_COLORS[sym.urgency] + '44' : 'var(--border)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        {sym.symptom}
                        {sym.urgency && sym.urgency !== 'standard' && <span style={{ fontSize: 12 }}>{URGENCY_ICONS[sym.urgency]}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                          {sym.problems.length} {sym.problems.length === 1 ? 'причина' : sym.problems.length < 5 ? 'причины' : 'причин'}
                        </span>
                        <span style={{ fontSize: 8, color: 'var(--text-light)' }}>·</span>
                        <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>
                          {sym.problems.reduce((acc, p) => acc + p.solutions.length, 0)} решений
                        </span>
                        {sym.urgency === 'critical' && (
                          <>
                            <span style={{ fontSize: 8, color: 'var(--text-light)' }}>·</span>
                            <span style={{ fontSize: 8, color: '#f44336', fontWeight: 600 }}>СРОЧНО</span>
                          </>
                        )}
                        {sym.linkedDrugs && sym.linkedDrugs.length > 0 && (
                          <span style={{ fontSize: 8, color: 'var(--accent)', marginLeft: 2, background: 'rgba(0,230,138,0.08)', padding: '1px 4px', borderRadius: 4 }}>
                            {sym.linkedDrugs.slice(0, 2).map((d) => DRUG_LABELS[d] || d).join(', ')}
                            {sym.linkedDrugs.length > 2 ? '...' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {savedIds.includes(sym.id) && <span style={{ fontSize: 12, color: '#ff9800' }}>★</span>}
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filteredSymptoms.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-dim)', fontSize: 11 }}>
          Ничего не найдено. Попробуйте другой запрос или фильтр.
        </div>
      )}
    </div>
  );
};
