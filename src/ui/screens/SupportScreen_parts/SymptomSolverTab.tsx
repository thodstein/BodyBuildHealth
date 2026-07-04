// @ts-nocheck
import React, { useState, useMemo } from 'react';
import {
  SYMPTOM_DB, SYMPTOM_CATEGORY_LABELS, SYMPTOM_CATEGORY_ICONS,
  PROBABILITY_LABELS, PROBABILITY_COLORS, EVIDENCE_LABELS, EVIDENCE_COLORS,
  URGENCY_LABELS, URGENCY_COLORS, URGENCY_ICONS,
  DRUG_LABELS, DRUG_CATEGORIES, DRUG_CAT_COLORS,
  searchSymptoms, findSymptomById, findSymptomsByDrug, getAllLinkedDrugs, getSymptomStats,
  type SymptomEntry, type ProblemEntry, type SymptomCategory, type UrgencyLevel,
} from '../../../engines/symptom-solver.engine';

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

  const toggleSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      return next;
    });
  };

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
        </div>

        {/* Заголовок симптома */}
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

          {/* Связанные препараты */}
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

          {/* Быстрые факты */}
          {selectedSymptom.quickFacts && selectedSymptom.quickFacts.length > 0 && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Быстрые факты</div>
              {selectedSymptom.quickFacts.map((f, i) => (
                <div key={i} style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: '1.5', paddingLeft: 4 }}>• {f}</div>
              ))}
            </div>
          )}
        </div>

        {/* Проблемы */}
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
                {problem.solutions.map((sol, i) => (
                  <div key={i} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 4, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)', fontSize: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, gap: 4 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{sol.name}</span>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <span style={chip(sol.type === 'pharma' ? '#e91e63' : sol.type === 'supplement' ? '#2196f3' : '#ff9800')}>
                          {sol.type === 'pharma' ? 'Фарма' : sol.type === 'supplement' ? 'БАД' : 'Образ жизни'}
                        </span>
                        <span style={chip(EVIDENCE_COLORS[sol.evidenceLevel])}>{EVIDENCE_LABELS[sol.evidenceLevel]}</span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 9, marginBottom: 2 }}><strong>Доза:</strong> {sol.dose}</div>
                    <div style={{ color: 'var(--text-light)', fontSize: 9, fontStyle: 'italic' }}>{sol.mechanism}</div>
                  </div>
                ))}
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
              <button key={sym.id} onClick={() => setSelectedSymptom(sym)} style={{
                padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)',
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
                  {savedIds.includes(sym.id) && <span style={{ fontSize: 12, color: '#ff9800' }}>★</span>}
                </div>
              </button>
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
