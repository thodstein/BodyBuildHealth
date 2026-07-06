import React, { useState, useMemo, useEffect } from 'react';
import { mapStackToPathologies, getKnownDrugNames, DRUG_DATABASE } from '../../../engines/drug-mapper.engine';
import type { DrugEntry, MapperResult } from '../../../engines/drug-mapper.engine';
import { useDataLink } from '../../../core/data-link';

export const MapperTab: React.FC = () => {
  const linked = useDataLink();
  const course = linked.course || [];
  const [manualDrugs, setManualDrugs] = useState<DrugEntry[]>([]);
  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugDose, setNewDrugDose] = useState(0);
  const [mapperResult, setMapperResult] = useState<MapperResult | null>(null);
  const [clinicalResult, setClinicalResult] = useState<any>(null);
  const [useCourse, setUseCourse] = useState(true);

  const knownNames = useMemo(() => getKnownDrugNames(), []);

  useEffect(() => {
    if (course.length > 0) {
      const drugs: DrugEntry[] = course.map(c => ({
        name: (c.substanceId||'').toLowerCase(),
        dosageMg: c.doseUnit === 'mg/wk'
          ? c.doseValue
          : c.doseUnit === 'mg' ? c.doseValue : c.doseValue * 1000,
      }));
      setMapperResult(mapStackToPathologies(drugs));
    }
  }, [course]);

  const handleRunManual = () => {
    const drugs = useCourse && course.length > 0
      ? course.map(c => ({ name: (c.substanceId||'').toLowerCase(), dosageMg: c.doseValue }))
      : [...manualDrugs];
    if (drugs.length === 0) return;
    setMapperResult(mapStackToPathologies(drugs));

    // Lazy-load clinical analysis
    import('../../../engines/clinical-analyzer.engine').then(({ analyzeClinicalRisks }) => {
      const compoundNames = course.length > 0
        ? course.map(c => (c.substanceId||'').toLowerCase())
        : manualDrugs.map(d => d.name);
      const markers = (linked.labs || []).map(l => ({ code: l.code || l.name, value: l.value }));
      const s2 = linked.profile?.settings;
      const genetics = Object.keys(s2?.genetics || {}).filter(k => !!(s2?.genetics as any)?.[k]);
      const labDates = (linked.labs || []).map(l => l.date).filter(Boolean).sort().reverse();
      const weeksSinceLab = labDates[0] ? (Date.now() - new Date(labDates[0]).getTime()) / (7 * 24 * 3600 * 1000) : 52;
      const tWeeks = course.length > 0 ? course.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0) : 4;

      setClinicalResult(analyzeClinicalRisks({ compounds: compoundNames, markers, tWeeks: Math.max(1, tWeeks), weeksSinceLab, genetics }));
    }).catch(console.error);
  };

  const addManualDrug = () => {
    const name = newDrugName.trim().toLowerCase();
    if (!name || manualDrugs.some(d => d.name === name)) return;
    setManualDrugs([...manualDrugs, { name, dosageMg: newDrugDose || 100 }]);
    setNewDrugName('');
    setNewDrugDose(0);
  };

  const removeManualDrug = (name: string) => {
    setManualDrugs(manualDrugs.filter(d => d.name !== name));
  };

  const markerInLabs = (marker: string): boolean => {
    return !!linked.labs?.some(l => l.code === marker || l.name === marker);
  };

  const getSeverityClass = (strength: number): string => {
    if (strength >= 2.0) return 'high';
    if (strength >= 1.2) return 'medium';
    return 'low';
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 4px 0' }}>🧬 Маппер: Стек препаратов → Патологии органов</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
          Алгоритм ищет в графе знаний все патологии для вашего стека.
          Стек-синергия: если 2+ препарата бьют по одной системе → кумулятивный удар.
          <br />
        </p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setUseCourse(true)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 6, border: useCourse ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: useCourse ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            💊 Из курса ({course.length} преп.)
          </button>
          <button onClick={() => setUseCourse(false)} style={{
            flex: 1, padding: '8px 12px', borderRadius: 6, border: !useCourse ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: !useCourse ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            ✏️ Вручную ({manualDrugs.length} преп.)
          </button>
        </div>

        {!useCourse && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <select value={newDrugName} onChange={e => setNewDrugName(e.target.value)}
                style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }}>
                <option value="">Выбрать препарат...</option>
                {knownNames.map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
              <input type="number" placeholder="" value={newDrugDose || ''}
                onChange={e => setNewDrugDose(parseFloat(e.target.value) || 0)}
                style={{ width: 80, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12 }} />
              <button onClick={addManualDrug} style={{
                padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>+</button>
            </div>
            {manualDrugs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                {manualDrugs.map(d => (
                  <span key={d.name} onClick={() => removeManualDrug(d.name)} style={{
                    padding: '3px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                    fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                  }}>{d.name} {d.dosageMg}мг ✕</span>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={handleRunManual} style={{
          width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', marginTop: 4,
          background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontWeight: 700, fontSize: 14,
        }}>▶ Запустить маппинг стека</button>
      </div>

      {mapperResult && (
        <>
          <div className="card" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{mapperResult.activePathologies?.length ?? 0}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Патологии</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>{mapperResult.requiredBiomarkers?.length ?? 0}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Биомаркеры</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: (mapperResult.unknownDrugs?.length ?? 0) > 0 ? '#f97316' : 'var(--text-dim)' }}>
                {mapperResult.knownDrugs}/{mapperResult.totalDrugs}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Распознано</div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-dim)' }}>Активные патологии (по убыванию тяжести)</div>
          {(mapperResult.activePathologies || []).map(p => {
            const sev = getSeverityClass(p.cumulativeTriggerStrength);
            const ZONE_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f97316', low: '#eab308' };
            return (
              <div key={p.pathologyId} className="card" style={{ marginBottom: 8, borderLeft: `4px solid ${ZONE_COLORS[sev]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.pathologyLabel}</span>
                    <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: `${ZONE_COLORS[sev]}22`, color: ZONE_COLORS[sev], fontSize: 10, fontWeight: 600 }}>
                      {p.cumulativeTriggerStrength} Σ
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(p.contributingDrugs || []).map(d => (
                      <span key={d} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', fontSize: 10 }}>{d}</span>
                    ))}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${Math.min(100, p.cumulativeTriggerStrength * 35)}%`, height: '100%', background: ZONE_COLORS[sev], borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {(p.contributingDrugs?.length ?? 0) > 1
                    ? ``
                    : ``}
                </div>
              </div>
            );
          })}

          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-dim)' }}>
              🧪 Требуемые биомаркеры ({mapperResult.requiredBiomarkers?.length ?? 0})
            </div>
            <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6 }}>
              Зелёные — есть в ваших анализах, серые — необходимо сдать
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(mapperResult.requiredBiomarkers || []).map(m => {
                const has = markerInLabs(m);
                return (
                  <span key={m} style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: has ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.05)',
                    color: has ? '#00e68a' : 'var(--text-dim)',
                    border: `1px solid ${has ? 'rgba(0,230,138,0.3)' : 'var(--border)'}`,
                  }}>{has ? '✅ ' : '⬜ '}{m}</span>
                );
              })}
            </div>
          </div>

          {(mapperResult.unknownDrugs?.length ?? 0) > 0 && (
            <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid #f97316' }}>
              <div style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>
                Неизвестные препараты: {(mapperResult.unknownDrugs || []).join(', ')}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                Эти препараты отсутствуют в графе знаний. Они исключены из расчёта.
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Clinical Pathology Analysis ── */}
      {clinicalResult?.results?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#ec4899' }}>
            🏥 Клинические патологии ({clinicalResult.results.length})
          </div>

          {/* Summary */}
          <div className="card" style={{
            marginBottom: 10, padding: '8px 12px',
            background: (clinicalResult.overallMaxRisk ?? 0) >= 80 ? 'rgba(239,68,68,0.08)' :
              (clinicalResult.overallMaxRisk ?? 0) >= 50 ? 'rgba(249,115,22,0.06)' : 'rgba(0,230,138,0.04)',
            borderLeft: `3px solid ${(clinicalResult.overallMaxRisk ?? 0) >= 80 ? '#ef4444' : (clinicalResult.overallMaxRisk ?? 0) >= 50 ? '#f97316' : '#00e68a'}`,
          }}>
            <div style={{ fontSize: 11 }}>{clinicalResult.summary}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: 9, color: 'var(--text-dim)' }}>
              <span>🧪 {clinicalResult.markersAnalyzed ?? 0} маркеров</span>
              <span>📋 {(clinicalResult.requiredLabPanel?.length ?? 0)} в панели</span>
              <span>🔬 {(clinicalResult.requiredInstrumental?.length ?? 0)} исследований</span>
            </div>
          </div>

          {/* Per-system accordion */}
          {(clinicalResult.systems || []).map((system: any) => (
            <details key={system?.systemKey || Math.random()} style={{ marginBottom: 6 }}>
              <summary style={{
                padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                fontSize: 11, fontWeight: 600, listStyle: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {system?.icon || ''} {system?.systemName || ''}
                <span style={{
                  marginLeft: 'auto', padding: '1px 6px', borderRadius: 4, fontSize: 10,
                  background: (system?.maxRisk ?? 0) >= 80 ? 'rgba(239,68,68,0.15)' :
                    (system?.maxRisk ?? 0) >= 50 ? 'rgba(249,115,22,0.15)' : 'rgba(0,230,138,0.10)',
                  color: (system?.maxRisk ?? 0) >= 80 ? '#ef4444' : (system?.maxRisk ?? 0) >= 50 ? '#f97316' : '#00e68a',
                }}>{Math.round(system?.maxRisk ?? 0)}%</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({(system?.pathologies?.length ?? 0)})</span>
              </summary>
              <div style={{ padding: '4px 0 0 8px' }}>
                {(system?.pathologies || []).map((r: any) => {
                  const zoneColor = (r?.alertLevel ?? 0) >= 3 ? '#ef4444' : (r?.alertLevel ?? 0) >= 2 ? '#f97316' : (r?.alertLevel ?? 0) >= 1 ? '#eab308' : '#22c55e';
                  return (
                    <div key={r?.pathologyId || Math.random()} style={{
                      marginBottom: 6, padding: '6px 8px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${zoneColor}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{r?.pathologyName || ''}</span>
                        <span style={{ padding: '1px 5px', borderRadius: 3, background: `${zoneColor}20`, color: zoneColor, fontWeight: 600, fontSize: 9 }}>
                          {(r?.riskPercent ?? 0)}% — {(r?.status || '').split('(')[0].trim()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 8, color: 'var(--text-dim)' }}>
                        <span>Hill: {r?.hillScore ?? '—'}</span>
                        <span>MC95: {r?.severity95 ?? '—'}</span>
                        {(r?.contributingCompounds?.length ?? 0) > 0 && (
                          <span>Препараты: {(r?.contributingCompounds || []).join(', ')}</span>
                        )}
                      </div>
                      {(r?.alertLevel ?? 0) >= 2 && (
                        <div style={{ marginTop: 3, fontSize: 9, color: '#f97316' }}>
                          🔬 {r?.instrumental || ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}

      {!mapperResult && !clinicalResult && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🧬</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {course.length > 0
              ? ``
              : ''}
          </div>
        </div>
      )}
    </div>
  );
};