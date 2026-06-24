import React, { useState, useMemo, useCallback } from 'react';
import {
  findSupplements, findReplacement, buildStack, explainStack,
  findSingleReplacementForStack, autoCompleteStack,
  type FinderMatch, type ReplacementResult, type StackExplanation,
  type GoalType, type ReplacementType,
} from '../../engines/supplement-finder.engine';
import { CATEGORY_LABELS } from '../../data/support-database';

type FinderTab = 'finder' | 'replacer' | 'stack';

const GOALS: { key: GoalType; label: string; emoji: string }[] = [
  { key: 'sleep', label: 'Сон', emoji: '😴' },
  { key: 'energy', label: 'Энергия', emoji: '⚡' },
  { key: 'concentration', label: 'Фокус', emoji: '🎯' },
  { key: 'muscle_gain', label: 'Мышцы', emoji: '💪' },
  { key: 'fat_loss', label: 'Жиросжигание', emoji: '🔥' },
  { key: 'endurance', label: 'Выносливость', emoji: '🏃' },
  { key: 'recovery', label: 'Восстановление', emoji: '🔄' },
  { key: 'immunity', label: 'Иммунитет', emoji: '🛡️' },
  { key: 'liver_health', label: 'Печень', emoji: '🫁' },
  { key: 'cardio_health', label: 'Сердце', emoji: '❤️' },
  { key: 'joints', label: 'Суставы', emoji: '🦴' },
  { key: 'skin', label: 'Кожа', emoji: '🧴' },
  { key: 'hair', label: 'Волосы', emoji: '💇' },
  { key: 'hormones', label: 'Гормоны', emoji: '⚖️' },
  { key: 'stress', label: 'Стресс', emoji: '🧘' },
  { key: 'longevity', label: 'Долголетие', emoji: '⏳' },
  { key: 'detox', label: 'Детокс', emoji: '🧹' },
  { key: 'libido', label: 'Либидо', emoji: '🔥' },
  { key: 'mood', label: 'Настроение', emoji: '😊' },
  { key: 'brain', label: 'Мозг', emoji: '🧠' },
  { key: 'digestion', label: 'ЖКТ', emoji: '🫃' },
  { key: 'kidney', label: 'Почки', emoji: '🫘' },
];

const ORGANS: { key: string; label: string; emoji: string }[] = [
  { key: 'BRAIN', label: 'Мозг', emoji: '🧠' },
  { key: 'LIVER', label: 'Печень', emoji: '🫁' },
  { key: 'HEART', label: 'Сердце', emoji: '❤️' },
  { key: 'KIDNEYS', label: 'Почки', emoji: '🫘' },
  { key: 'LUNGS', label: 'Лёгкие', emoji: '🫁' },
  { key: 'MUSCLES', label: 'Мышцы', emoji: '💪' },
  { key: 'BONES', label: 'Кости', emoji: '🦴' },
  { key: 'JOINTS', label: 'Суставы', emoji: '🦴' },
  { key: 'SKIN', label: 'Кожа', emoji: '🧴' },
  { key: 'IMMUNE_SYSTEM', label: 'Иммунитет', emoji: '🛡️' },
  { key: 'NERVES', label: 'Нервы', emoji: '⚡' },
  { key: 'GUT', label: 'ЖКТ', emoji: '🫃' },
  { key: 'VESSELS', label: 'Сосуды', emoji: '🩸' },
  { key: 'ADRENALS', label: 'Надпочечники', emoji: '⚖️' },
  { key: 'THYROID', label: 'Щитовидная', emoji: '🦋' },
  { key: 'PANCREAS', label: 'Поджелудочная', emoji: '🫁' },
  { key: 'REPRODUCTIVE', label: 'Репродуктивная', emoji: '🧬' },
  { key: 'PROSTATE', label: 'Простата', emoji: '🔴' },
  { key: 'BLOOD', label: 'Кровь', emoji: '🩸' },
  { key: 'EYES', label: 'Глаза', emoji: '👁️' },
];

const REPLACEMENT_TYPES: { key: ReplacementType; label: string; desc: string }[] = [
  { key: 'direct_analog', label: 'Прямой аналог', desc: 'Тот же эффект, другой препарат' },
  { key: 'functional', label: 'Функциональный', desc: 'Другой механизм, тот же результат' },
  { key: 'safer', label: 'Безопаснее', desc: 'Меньше побочек и рисков' },
  { key: 'stronger', label: 'Сильнее', desc: 'Больше механизмов, выше тир' },
  { key: 'cheaper', label: 'Дешевле', desc: 'Простая форма выпуска' },
  { key: 'stack_to_single', label: 'Стек → 1 препарат', desc: 'Один вместо комбинации' },
  { key: 'single_to_stack', label: '1 препарат → стек', desc: 'Разделить на узкие компоненты' },
];

function PillButton({ selected, label, onClick, color }: { selected: boolean; label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 12, fontSize: 9, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
      background: selected ? (color || 'var(--accent)') : 'rgba(255,255,255,0.06)',
      color: selected ? '#000' : 'rgba(255,255,255,0.7)',
      border: `1px solid ${selected ? (color || 'var(--accent)') : 'rgba(255,255,255,0.08)'}`,
    }}>{label}</button>
  );
}

interface FinderCardProps {
  match: FinderMatch;
}
const FinderCard: React.FC<FinderCardProps> = ({ match }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: 'rgba(24,24,27,0.15)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 10px', cursor: 'pointer' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>{match.name}</span>
            {match.bestForCourse && <span style={{ fontSize: 7, padding: '0 4px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.2)' }}>Курс</span>}
          </div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 2 }}>
            {match.categories.slice(0, 3).map(c => (
              <span key={c} style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)' }}>{CATEGORY_LABELS[c] || c}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
            <span>⭐ {match.relevanceScore}</span>
            <span>🔄 {match.synergyCount} син.</span>
            <span>⚠️ {match.conflictCount} конфл.</span>
            <span>📦 {match.formCount} форм</span>
          </div>
        </div>
        <div style={{ fontSize: 18, color: match.relevanceScore >= 15 ? '#00e68a' : match.relevanceScore >= 10 ? '#fbbf24' : '#f59e0b', fontWeight: 800 }}>{match.relevanceScore}</div>
      </div>
      {expanded && (
        <div style={{ padding: '6px 10px 10px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.1)' }}>
          {match.matchReasons.length > 0 && (
            <div style={{ marginBottom: 3 }}>
              <div style={{ fontSize: 7, color: '#00e68a', fontWeight: 600, marginBottom: 1 }}>✅ Совпадения:</div>
              {match.matchReasons.map((r, i) => <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>• {r}</div>)}
            </div>
          )}
          {match.targetOrgan && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>🎯 {match.targetOrgan}</div>}
          {match.clinicalEffect && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>✅ {match.clinicalEffect}</div>}
          {match.mechanismOfAction && <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>🧬 {match.mechanismOfAction}</div>}
          {match.bestForm && <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginTop: 2 }}>🏆 {match.bestForm}</div>}
        </div>
      )}
    </div>
  );
};

/* ─── MAIN COMPONENT ────────────────────────────────────────────────────── */
export const SupplementFinder: React.FC = () => {
  const [tab, setTab] = useState<FinderTab>('finder');
  const [searchText, setSearchText] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const [selectedOrgans, setSelectedOrgans] = useState<string[]>([]);
  const [results, setResults] = useState<FinderMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Replacer state
  const [replaceId, setReplaceId] = useState('');
  const [replaceType, setReplaceType] = useState<ReplacementType>('direct_analog');
  const [replaceResults, setReplaceResults] = useState<ReplacementResult[]>([]);

  // Stack state
  const [stackIds, setStackIds] = useState<string>('');
  const [targetSize, setTargetSize] = useState(5);
  const [stackResult, setStackResult] = useState<{ stack: string[]; explanation: StackExplanation } | null>(null);

  const toggleOrgan = useCallback((o: string) => {
    setSelectedOrgans(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);
  }, []);

  const handleSearch = useCallback(() => {
    const q = {
      searchText: searchText || undefined,
      goal: selectedGoal || undefined,
      organs: selectedOrgans.length > 0 ? selectedOrgans : undefined,
    };
    const res = findSupplements(q);
    setResults(res);
    setHasSearched(true);
  }, [searchText, selectedGoal, selectedOrgans]);

  const handleReplace = useCallback(() => {
    if (!replaceId.trim()) return;
    const res = findReplacement(replaceId.trim(), replaceType);
    setReplaceResults(res);
  }, [replaceId, replaceType]);

  const handleBuildStack = useCallback(() => {
    const ids = stackIds.split(/[\s,;]+/).filter(Boolean);
    if (ids.length === 0) return;
    const { stack, explanation } = buildStack({
      baseIds: ids, targetSize, autoFill: true,
    });
    setStackResult({ stack, explanation });
  }, [stackIds, targetSize]);

  return (
    <div style={{ padding: '0 0 70px' }}>
      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {([
          { id: 'finder' as FinderTab, label: '🔍 Поиск' },
          { id: 'replacer' as FinderTab, label: '🔄 Замена' },
          { id: 'stack' as FinderTab, label: '🧩 Стек' },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: tab === t.id ? '#000' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${tab === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ========== FINDER TAB ========== */}
      {tab === 'finder' && (
        <div>
          {/* Search input */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="Название, орган, механизм..."
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}
            />
            <button onClick={handleSearch} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'var(--accent)', color: '#000', border: 'none',
            }}>Найти</button>
          </div>

          {/* Goal pills */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 3, fontWeight: 600 }}>🎯 ЦЕЛЬ:</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {GOALS.map(g => (
                <PillButton key={g.key} selected={selectedGoal === g.key}
                  label={`${g.emoji} ${g.label}`}
                  onClick={() => setSelectedGoal(selectedGoal === g.key ? null : g.key)}
                />
              ))}
            </div>
          </div>

          {/* Organ pills */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 3, fontWeight: 600 }}>🫀 ОРГАНЫ:</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {ORGANS.map(o => (
                <PillButton key={o.key} selected={selectedOrgans.includes(o.key)}
                  label={`${o.emoji} ${o.label}`}
                  onClick={() => toggleOrgan(o.key)}
                />
              ))}
            </div>
          </div>

          {/* Results */}
          {hasSearched && (
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Найдено: {results.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {results.map(m => <FinderCard key={m.id} match={m} />)}
                {results.length === 0 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>Ничего не найдено. Попробуйте другой запрос.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== REPLACER TAB ========== */}
      {tab === 'replacer' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={replaceId} onChange={e => setReplaceId(e.target.value)}
              placeholder="ID препарата (напр. nac, omega3, tudca)"
              onKeyDown={e => e.key === 'Enter' && handleReplace()}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}
            />
            <button onClick={handleReplace} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              background: 'var(--accent)', color: '#000', border: 'none',
            }}>Замена</button>
          </div>

          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
            {REPLACEMENT_TYPES.map(rt => (
              <PillButton key={rt.key} selected={replaceType === rt.key}
                label={rt.label} onClick={() => setReplaceType(rt.key)}
              />
            ))}
          </div>

          {replaceResults.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Найдено замен: {replaceResults.length}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {replaceResults.map((r, i) => (
                  <div key={i} style={{ background: 'rgba(24,24,27,0.15)', borderRadius: 10, padding: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)' }}>{r.replacementName}</span>
                      <span style={{
                        fontSize: 7, padding: '1px 5px', borderRadius: 3,
                        background: r.tierChange === 'upgrade' ? 'rgba(0,230,138,0.1)' : r.tierChange === 'downgrade' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)',
                        color: r.tierChange === 'upgrade' ? '#00e68a' : r.tierChange === 'downgrade' ? '#ef4444' : 'rgba(255,255,255,0.5)',
                        border: '1px solid ' + (r.tierChange === 'upgrade' ? 'rgba(0,230,138,0.2)' : r.tierChange === 'downgrade' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'),
                      }}>{r.tierChange === 'upgrade' ? '▲' : r.tierChange === 'downgrade' ? '▼' : '◆'} {r.tierLabel}</span>
                    </div>
                    <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginBottom: 2 }}>{r.reason}</div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3, marginBottom: 2 }}>{r.explanation}</div>
                    {r.bestForm && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>🏆 {r.bestForm}</div>}
                    {r.safetyNote && <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 2 }}>⚠ {r.safetyNote}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {replaceResults.length === 0 && replaceId.trim() && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>
              Замен для "{replaceId}" не найдено. Попробуйте другой тип замены или ID.
            </div>
          )}
        </div>
      )}

      {/* ========== STACK TAB ========== */}
      {tab === 'stack' && (
        <div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>ID препаратов (через пробел/запятую):</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={stackIds} onChange={e => setStackIds(e.target.value)}
                placeholder="nap: nac tudca omega3"
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12 }}
              />
              <button onClick={handleBuildStack} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                background: 'var(--accent)', color: '#000', border: 'none',
              }}>Собрать</button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Целевой размер стека:</span>
            <input type="number" min={2} max={20} value={targetSize} onChange={e => setTargetSize(Math.max(2, Math.min(20, parseInt(e.target.value) || 5)))}
              style={{ width: 50, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-light)', fontSize: 12, textAlign: 'center' }}
            />
          </div>

          {stackResult && (
            <div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                Стек: {stackResult.stack.length} компонентов | Синергия: {stackResult.explanation.totalSynergyScore} баллов
              </div>

              {/* Substances */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {stackResult.explanation.substances.map(s => (
                  <div key={s.id} style={{ background: 'rgba(24,24,27,0.15)', borderRadius: 8, padding: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-light)', marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontSize: 8, color: '#00e68a', marginBottom: 1 }}>Роль: {s.role}</div>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>{s.mechanism}</div>
                    {s.synergiesWith.length > 0 && (
                      <div style={{ marginTop: 2, fontSize: 8, color: '#60a5fa' }}>
                        Синергии: {s.synergiesWith.map(sy => `${sy.with} (${sy.effect})`).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pairwise synergies */}
              {stackResult.explanation.pairwiseSynergies.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 8, color: '#60a5fa', fontWeight: 600, marginBottom: 2 }}>🔄 Парные синергии:</div>
                  {stackResult.explanation.pairwiseSynergies.map((ps, i) => (
                    <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>
                      • {ps.a} ↔ {ps.b}: {ps.effect} ({ps.severity})
                    </div>
                  ))}
                </div>
              )}

              {/* Coverage */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, color: '#a78bfa', fontWeight: 600, marginBottom: 2 }}>📊 Покрытие:</div>
                {stackResult.explanation.coverage.organs.length > 0 && (
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginBottom: 1 }}>Органы: {stackResult.explanation.coverage.organs.join(', ')}</div>
                )}
                {stackResult.explanation.coverage.mechanisms.length > 0 && (
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>Механизмы: {stackResult.explanation.coverage.mechanisms.slice(0, 10).join(', ')}{stackResult.explanation.coverage.mechanisms.length > 10 ? '...' : ''}</div>
                )}
              </div>

              {/* Warnings */}
              {stackResult.explanation.warnings.length > 0 && (
                <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
                  <div style={{ fontSize: 8, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>⚠️ Предупреждения:</div>
                  {[...new Set(stackResult.explanation.warnings)].slice(0, 5).map((w, i) => (
                    <div key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>• {w}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
