import React, { useState, useEffect, useMemo } from 'react';
import { runAdvancedDiagnostics, ESTER_HALF_LIFE_DAYS } from '../../../engines/advanced-diagnostics.engine';
import type { DrugDoseInput, VitalsInput, AdvancedDiagnosticsResult } from '../../../engines/advanced-diagnostics.engine';
import { useDataLink } from '../../../core/data-link';

export const DiagnosticsTab: React.FC = () => {
  const linked = useDataLink();
  const course = linked.course || [];
  const profile = linked.profile;

  const [diagDrugs, setDiagDrugs] = useState<DrugDoseInput[]>([]);
  const [useCourseDrugs, setUseCourseDrugs] = useState(true);

  const [manName, setManName] = useState('');
  const [manEster, setManEster] = useState('enanthate');
  const [manMg, setManMg] = useState(250);
  const [manFreq, setManFreq] = useState(2);

  const [hrv, setHrv] = useState(55);
  const [rhr, setRhr] = useState(62);
  const [bpSys, setBpSys] = useState(125);
  const [bpDia, setBpDia] = useState(80);

  const s = profile?.settings;
  const dob = s?.dateOfBirth ? new Date(s.dateOfBirth) : null;
  const calcAge = dob ? Math.floor((Date.now() - dob.getTime()) / 31556952000) : 30;
  const [age, setAge] = useState(calcAge);
  const [has19Nor, setHas19Nor] = useState(false);

  const [result, setResult] = useState<AdvancedDiagnosticsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const esterOptions = Object.keys(ESTER_HALF_LIFE_DAYS);

  useEffect(() => {
    if (useCourseDrugs && course.length > 0) {
      const mapped: DrugDoseInput[] = course.map((c: any) => {
        const ester = c.substanceId.includes('enan') ? 'enanthate'
          : c.substanceId.includes('prop') ? 'propionate'
          : c.substanceId.includes('cyp') ? 'cypionate'
          : c.substanceId.includes('undec') ? 'undecanoate'
          : c.substanceId.includes('acet') ? 'acetate'
          : c.substanceId.includes('deca') || c.substanceId === 'deca' ? 'decanoate'
          : c.substanceId.includes('oral') ? 'oral'
          : 'enanthate';
        return {
          name: c.substanceId,
          ester,
          mgPerWeek: c.doseUnit === 'mg/wk' ? c.doseValue : c.doseValue,
          injectionsPerWeek: typeof c.frequency === 'number' ? c.frequency : 2,
        };
      });
      setDiagDrugs(mapped);
    }
  }, [course, useCourseDrugs]);

  const addManual = () => {
    if (!manName.trim()) return;
    setDiagDrugs([...diagDrugs, { name: manName.trim().toLowerCase(), ester: manEster, mgPerWeek: manMg, injectionsPerWeek: manFreq }]);
    setManName('');
  };

  const removeDrug = (idx: number) => {
    setDiagDrugs(diagDrugs.filter((_, i) => i !== idx));
  };

  const handleRun = () => {
    setLoading(true);
    const vitals: VitalsInput = { hrv, rhr, bpSys, bpDia };
    const res = runAdvancedDiagnostics(age, diagDrugs, vitals, has19Nor);
    setResult(res);
    setLoading(false);
  };

  const SEV_COLORS: Record<string, string> = { critical: '#ef4444', warning: '#f97316' };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 4px 0' }}>🔬 5-Engine Advanced Diagnostics</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
          PK/PD · Межлекарственные конфликты · Витальные показатели · BioAge · ПКТ-Таймер
          <br />
        </p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setUseCourseDrugs(true)} style={{
            flex: 1, padding: '6px 10px', borderRadius: 6, border: useCourseDrugs ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: useCourseDrugs ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
          }}>
            💊 Из курса ({course.length})
          </button>
          <button onClick={() => setUseCourseDrugs(false)} style={{
            flex: 1, padding: '6px 10px', borderRadius: 6, border: !useCourseDrugs ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: !useCourseDrugs ? 'rgba(0,230,138,0.08)' : 'var(--bg-secondary)', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
          }}>
            ✏️ Вручную ({diagDrugs.length})
          </button>
        </div>

        {!useCourseDrugs && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            <input value={manName} onChange={e => setManName(e.target.value)} placeholder="Название" style={{ width: 100, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }} />
            <select value={manEster} onChange={e => setManEster(e.target.value)} style={{ width: 110, padding: '5px 4px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }}>
              {esterOptions.map(e => (<option key={e} value={e}>{e} ({ESTER_HALF_LIFE_DAYS[e]}д)</option>))}
            </select>
            <input type="number" value={manMg} onChange={e => setManMg(parseFloat(e.target.value) || 0)} placeholder="мг/нед" style={{ width: 70, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }} />
            <input type="number" value={manFreq} onChange={e => setManFreq(parseFloat(e.target.value) || 0)} placeholder="инъекц" style={{ width: 60, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11 }} />
            <button onClick={addManual} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+</button>
          </div>
        )}

        {diagDrugs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {diagDrugs.map((d, i) => (
              <span key={i} onClick={() => removeDrug(i)} style={{
                padding: '3px 8px', borderRadius: 6, background: 'rgba(0,230,138,0.1)', color: 'var(--accent)',
                fontSize: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                {d.name} [{d.ester}] {d.mgPerWeek}мг {d.injectionsPerWeek}×/нед ✕
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-dim)' }}>Витальные показатели</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>HRV (мс)</label>
            <input type="number" value={hrv} onChange={e => setHrv(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>RHR (уд/мин)</label>
            <input type="number" value={rhr} onChange={e => setRhr(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>АД сист.</label>
            <input type="number" value={bpSys} onChange={e => setBpSys(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>АД диаст.</label>
            <input type="number" value={bpDia} onChange={e => setBpDia(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Возраст (лет)</label>
            <input type="number" value={age} onChange={e => setAge(parseFloat(e.target.value) || 0)}
              style={{ width: 80, padding: '5px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', marginTop: 14 }}>
            <input type="checkbox" checked={has19Nor} onChange={e => setHas19Nor(e.target.checked)}
              style={{ accentColor: '#ef4444' }} />
            19-nor в анамнезе
          </label>
        </div>
      </div>

      <button onClick={handleRun} disabled={diagDrugs.length === 0 || loading} style={{
        width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: diagDrugs.length === 0 ? 'not-allowed' : 'pointer', marginBottom: 12,
        background: diagDrugs.length === 0 ? 'var(--border)' : 'linear-gradient(135deg, #ef4444, #8b5cf6)',
        color: '#fff', fontWeight: 700, fontSize: 15, opacity: diagDrugs.length === 0 ? 0.5 : 1,
      }}>
        {loading ? '⏳ Анализ...' : '🔍 Запустить диагностику'}
        <span style={{ fontSize: 10, display: 'block', fontWeight: 400, opacity: 0.7 }}>
          PK/PD + Взаимодействия + Виталы + BioAge + ПКТ-Таймер
        </span>
      </button>

      {result && (
        <>
          <div className="card" style={{
            marginBottom: 12, padding: '10px 14px',
            background: result.summary.startsWith('✅') ? 'rgba(0,230,138,0.08)' : 'rgba(239,68,68,0.08)',
            borderLeft: `3px solid ${result.summary.startsWith('✅') ? '#00e68a' : '#ef4444'}`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 2 }}>Итоговая оценка</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{result.summary}</div>
          </div>

          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>1. PK/PD — Концентрации и качели</div>
            {result.pkpd.map((r, i) => (
              <div key={i} style={{
                marginBottom: 8, padding: '8px 10px', borderRadius: 6,
                background: r.hormonalSwingFlag ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${r.hormonalSwingFlag ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{r.drugName} [{r.ester}]</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>T½ = {r.halfLifeDays} дн</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10 }}>
                  <span style={{ color: '#00e68a' }}>Пик: {r.peakConcMg}мг</span>
                  <span style={{ color: '#60a5fa' }}>Спад: {r.troughConcMg}мг</span>
                  <span style={{ color: r.hormonalSwingFlag ? '#ef4444' : 'var(--text-dim)', fontWeight: 600 }}>
                    Δ{r.peakTroughDeltaPct}%
                  </span>
                </div>
                {r.hormonalSwingFlag && (
                  <div style={{ marginTop: 4, fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
                    🔴 Красный флаг: Гормональные качели! Частота инъекций должна быть увеличена.
                  </div>
                )}
              </div>
            ))}
          </div>

          {result.interactions.length > 0 && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>2. Межлекарственные конфликты</div>
              {result.interactions.map((r, i) => (
                <div key={i} style={{
                  marginBottom: 6, padding: '8px 10px', borderRadius: 6,
                  background: 'rgba(239,68,68,0.06)', borderLeft: `3px solid ${SEV_COLORS[r.severity]}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: SEV_COLORS[r.severity] }}>
                    {r.severity.toUpperCase()} — {r.drugsInvolved.join(' + ')}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{r.message}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{r.mechanism}</div>
                </div>
              ))}
            </div>
          )}
          {result.interactions.length === 0 && (
            <div className="card" style={{ marginBottom: 10, textAlign: 'center', padding: 8 }}>
              <div style={{ fontSize: 11, color: '#00e68a' }}>✅ Конфликтов не обнаружено</div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>3. Витальные показатели</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>HRV: </span>
                <span style={{ fontWeight: 600, color: result.vitals.hrv < 35 ? '#ef4444' : 'var(--accent)' }}>{result.vitals.hrv} мс</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>RHR: </span>
                <span style={{ fontWeight: 600, color: result.vitals.rhr > 75 ? '#ef4444' : 'var(--accent)' }}>{result.vitals.rhr} уд/мин</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>АД: </span>
                <span style={{ fontWeight: 600, color: result.vitals.bpSys > 140 || result.vitals.bpDia > 90 ? '#ef4444' : 'var(--accent)' }}>
                  {result.vitals.bpSys}/{result.vitals.bpDia}
                </span>
              </div>
            </div>
            {result.vitals.alerts.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {result.vitals.alerts.map((a, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#f97316', padding: '4px 0' }}>⚠ {a}</div>
                ))}
              </div>
            )}
            {result.vitals.alerts.length === 0 && (
              <div style={{ marginTop: 4, fontSize: 10, color: '#00e68a' }}>✅ Витальные показатели в норме</div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>4. BioAge — Биологическое старение</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Хронологический</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{result.bioage.chronologicalAge}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Биологический</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: result.bioage.ageAcceleration > 2 ? '#ef4444' : '#00e68a' }}>
                  {result.bioage.biologicalAge}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 9, color: 'var(--text-dim)' }}>
              <div>АД-штраф: +{result.bioage.bpPenalty} лет</div>
              <div>HRV-штраф: +{result.bioage.hrvPenalty} лет</div>
              <div>Токс. нагрузка: +{result.bioage.toxicLoadPenalty} лет</div>
            </div>
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: result.bioage.ageAcceleration > 2 ? '#f97316' : 'var(--accent)' }}>
              {result.bioage.agingRate}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ec4899', marginBottom: 6 }}>5. ПКТ-Таймер и HPTA Ребут</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Начало ПКТ</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#ec4899' }}>День {result.pctReboot.pctStartDay}</div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  от {result.pctReboot.longestHalfLifeDrug} (T½={result.pctReboot.longestHalfLifeDays}д)
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>Вероятность ребута</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: result.pctReboot.rebootSuccessProbability >= 70 ? '#00e68a' : result.pctReboot.rebootSuccessProbability >= 40 ? '#f59e0b' : '#ef4444' }}>
                  {result.pctReboot.rebootSuccessProbability}%
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  {result.pctReboot.has19Nor ? '19-nor: -40%' : ''}
                </div>
              </div>
            </div>
            <div style={{
              padding: '8px 10px', borderRadius: 6, fontSize: 11,
              background: 'rgba(236,72,153,0.06)', borderLeft: '3px solid #ec4899',
            }}>
              {result.pctReboot.recommendation}
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {diagDrugs.length > 0
              ? `Нажмите «Запустить диагностику» для анализа`
              : 'Добавьте препараты из курса или вручную для запуска анализа'}
          </div>
        </div>
      )}
    </div>
  );
};