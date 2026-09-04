import React, { useState, useMemo } from 'react';
import { findMeaningfulReplacement, type MeaningfulReplacement, getEvidenceGrade } from '../../../engines/biostack-clinical-v2.engine';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-database';

const GLASS: React.CSSProperties = {
  background: 'rgba(24,24,27,0.55)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 12,
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(24,24,27,0.6)',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
};

import type { BioStackProfile } from '../../../engines/biostack-ai.engine';

export const SupportAnalogCalculator: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);

  const allSubstances = useMemo(() => {
    const arr: { id: string; name: string }[] = [];
    for (const [id, entry] of Object.entries(SUPPORT_CATALOG_DATA)) {
      const e = entry as any;
      arr.push({ id, name: e?.nameRu || e?.name || id });
    }
    return arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allSubstances.filter(s => 
      s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [search, allSubstances]);

  const profile: BioStackProfile = useMemo(() => ({
    age: 30, weight: 80, height: 180, sex: 'male',
    avoidIds: excludeIds,
    avoidMeds: [],
    currentMeds: [],
    drugAllergies: [],
    jointSymptoms: [],
    neuroSymptoms: [],
    cnsSymptoms: [],
    currentSupplements: [],
    autoFilledFields: [],
  }), [excludeIds]);

  const replacement: MeaningfulReplacement | null = useMemo(() => {
    if (!selectedId) return null;
    return findMeaningfulReplacement(selectedId, profile, excludeIds);
  }, [selectedId, profile, excludeIds]);

  const selectedEntry = useMemo(() => {
    if (!selectedId) return null;
    return SUPPORT_CATALOG_DATA[selectedId] as any;
  }, [selectedId]);

  const gradeInfo = useMemo(() => {
    if (!selectedId) return null;
    const grade = getEvidenceGrade(selectedId);
    const gradeColor = grade === 'A' ? '#22c55e' : grade === 'B' ? '#f59e0b' : '#6b7280';
    const gradeLabel = grade === 'A' ? 'Высокий (A)' : grade === 'B' ? 'Умеренный (B)' : 'Низкий (C)';
    return { grade, gradeColor, gradeLabel };
  }, [selectedId]);

  const repGradeInfo = useMemo(() => {
    if (!replacement) return null;
    const grade = getEvidenceGrade(replacement.replacementId);
    const gradeColor = grade === 'A' ? '#22c55e' : grade === 'B' ? '#f59e0b' : '#6b7280';
    const gradeLabel = grade === 'A' ? 'Высокий (A)' : grade === 'B' ? 'Умеренный (B)' : 'Низкий (C)';
    const upgrade = replacement.gradeUpgrade;
    return { grade, gradeColor, gradeLabel, upgrade };
  }, [replacement]);

  return (
    <div className="sup-analog" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
        Поиск клинически обоснованной замены препарата на основе механизмов действия, терапевтического класса и грейда доказательности.
      </div>

      <div style={GLASS}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#00e68a' }}>
          🔍 Выберите препарат для замены
        </div>
        <div style={{ position: 'relative' }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedId(null); }}
            placeholder="Введите название препарата..."
            style={INPUT_STYLE}
          />
          {filtered.length > 0 && !selectedId && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#18181b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              marginTop: 4,
              maxHeight: 200,
              overflowY: 'auto',
              zIndex: 10,
            }}>
              {filtered.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setSearch(s.name); }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 12,
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,230,138,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                >
                  {s.name}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                    ({s.id})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedId && selectedEntry && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>
                {selectedEntry.nameRu || selectedEntry.name || selectedId}
              </span>
              {gradeInfo && (
                <span style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: gradeInfo.gradeColor + '22',
                  color: gradeInfo.gradeColor,
                  fontWeight: 600,
                }}>
                  {gradeInfo.gradeLabel}
                </span>
              )}
              <button
                onClick={() => { setSelectedId(null); setSearch(''); }}
                style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  fontSize: 10,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                }}
              >
                ✕ Сбросить
              </button>
            </div>
            {selectedEntry.mechanisms?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {selectedEntry.mechanisms.slice(0, 5).map((m: string) => (
                  <span key={m} style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(0,230,138,0.1)',
                    color: '#00e68a',
                  }}>
                    {m.replace(/_/g, ' ').toLowerCase()}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedId && (
        <div style={GLASS}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'rgba(255,255,255,0.7)' }}>
            🚫 Исключить из поиска (опционально)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {excludeIds.map(id => {
              const entry = SUPPORT_CATALOG_DATA[id] as any;
              const name = entry?.nameRu || entry?.name || id;
              return (
                <span
                  key={id}
                  onClick={() => setExcludeIds(prev => prev.filter(x => x !== id))}
                  style={{
                    fontSize: 10,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'rgba(239,68,68,0.15)',
                    color: '#ef4444',
                    cursor: 'pointer',
                  }}
                >
                  ✕ {name}
                </span>
              );
            })}
            <input
              placeholder="+ добавить..."
              style={{
                width: 100,
                padding: '4px 8px',
                fontSize: 10,
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#fff',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim().toLowerCase();
                  if (val && !excludeIds.includes(val)) {
                    const match = allSubstances.find(s => s.id.toLowerCase() === val || s.name.toLowerCase() === val);
                    if (match) {
                      setExcludeIds(prev => [...prev, match.id]);
                    } else if (SUPPORT_CATALOG_DATA[val]) {
                      setExcludeIds(prev => [...prev, val]);
                    }
                  }
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
        </div>
      )}

      {replacement && (
        <div style={{
          ...GLASS,
          border: '1px solid rgba(0,230,138,0.2)',
          background: 'rgba(0,230,138,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>🔄</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a' }}>
                Рекомендуемая замена
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                Найден клинически обоснованный аналог
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(24,24,27,0.6)',
            borderRadius: 10,
            padding: '10px 12px',
          }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {replacement.replacementName}
                </span>
                {repGradeInfo && (
                  <span style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: repGradeInfo.gradeColor + '22',
                    color: repGradeInfo.gradeColor,
                    fontWeight: 600,
                  }}>
                    {repGradeInfo.gradeLabel}
                  </span>
                )}
                {repGradeInfo?.upgrade && (
                  <span style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(34,197,94,0.15)',
                    color: '#22c55e',
                  }}>
                    ↑ Грейд улучшен
                  </span>
                )}
              </div>

              {replacement.therapeuticClass && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                  Терапевтический класс: {replacement.therapeuticClass}
                </div>
              )}

              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 8 }}>
                {replacement.reason}
              </div>

              {replacement.clinicalNote && (
                <div style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.6)',
                  fontStyle: 'italic',
                  marginBottom: 6,
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 6,
                }}>
                  💡 {replacement.clinicalNote}
                </div>
              )}

              {(replacement.form || replacement.doseMg || replacement.timing) && (
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  {replacement.form && (
                    <div>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Форма: </span>
                      <span style={{ fontSize: 10, color: '#fff' }}>{replacement.form}</span>
                    </div>
                  )}
                  {replacement.doseMg && (
                    <div>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Доза: </span>
                      <span style={{ fontSize: 10, color: '#fff' }}>{replacement.doseMg} мг</span>
                    </div>
                  )}
                  {replacement.timing && (
                    <div>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Тайминг: </span>
                      <span style={{ fontSize: 10, color: '#fff' }}>{replacement.timing}</span>
                    </div>
                  )}
                </div>
              )}

              {replacement.doseWarning && (
                <div style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  background: 'rgba(245,158,11,0.1)',
                  borderRadius: 8,
                  borderLeft: '3px solid #f59e0b',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', marginBottom: 2 }}>
                    ⚠️ Внимание к дозировке
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                    {replacement.doseWarning}
                  </div>
                  {replacement.recommendedDoseMg && (
                    <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
                      Рекомендуемая доза: {replacement.recommendedDoseMg} мг
                    </div>
                  )}
                </div>
              )}

              <div style={{
                marginTop: 10,
                padding: '8px 10px',
                background: 'rgba(34,197,94,0.08)',
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 10, color: '#22c55e' }}>
                  ✓ {replacement.safetyNote}
                </div>
              </div>
            </div>
          </div>
      )}

      {selectedId && !replacement && (
        <div style={{
          ...GLASS,
          border: '1px solid rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.05)',
        }}>
          <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 6 }}>
            ⚠️ Аналог не найден
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            Для данного препарата не найден клинически обоснованный аналог в базе данных. 
            Попробуйте исключить меньше веществ или выбрать другой препарат.
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
        💡 Калькулятор анализирует механизмы действия, терапевтический класс и грейд доказательности для подбора наиболее подходящей замены. 
        Грейд A — высокий уровень доказательств, B — умеренный, C — низкий (механистический).
      </div>
    </div>
  );
};
