import React, { useState, useMemo } from 'react';
import { PopupNumber, PopupSelect } from '../../components/PopupXxx';
import { PHARMA_DB, getPharmaDetail } from '../../../core/pharma-database';
import {
  PEPTIDE_DB, PEPTIDE_LIST, PEPTIDE_GOAL_PROFILES,
  computeDilution, computeEffectiveDose, computePK, computePeptideRisks,
  generatePeptideProtocol, getPeptideSynergiesFor, getPeptideConflictsFor,
  ROUTE_LABELS, SYRINGE_TYPES,
} from '../../../engines/peptide-calculator.engine';
import { CLASS_LABELS } from './constants';

export const PharmaPeptideCalc: React.FC = () => {
  const [peptideId, setPeptideId] = useState('cjc1295');
  const [growthId, setGrowthId] = useState<string | null>(null);
  const [pepAmount, setPepAmount] = useState(2);
  const [pepDilution, setPepDilution] = useState(2);
  const [pepDose, setPepDose] = useState(100);
  const [pepSyringe, setPepSyringe] = useState<string>('U100_1ml');
  const [pepRoute, setPepRoute] = useState('sc');
  const [pepSchedule, setPepSchedule] = useState(['Пн', 'Ср', 'Пт']);
  const [pepTotalDays, setPepTotalDays] = useState(30);
  const [pepProtocol, setPepProtocol] = useState<ReturnType<typeof generatePeptideProtocol> | null>(null);

  const WEEK_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const scheduleEn = pepSchedule.map(d => WEEK_EN[WEEK_RU.indexOf(d)] || d);

  const dilution = useMemo(() => {
    const p = PEPTIDE_DB[peptideId];
    if (!p) return null;
    return computeDilution({
      amountValue: pepAmount, amountUnit: 'mg',
      dilutionVolumeMl: pepDilution, doseValue: pepDose, doseUnit: 'mcg',
      syringeType: pepSyringe as any,
    });
  }, [peptideId, pepAmount, pepDilution, pepDose, pepSyringe]);

  const bio = useMemo(() => {
    const p = PEPTIDE_DB[peptideId];
    if (!p || !dilution) return null;
    const b = p.bioavailability[pepRoute] || { min: 80, max: 100, avg: 90 };
    return computeEffectiveDose(dilution.doseMcg, b);
  }, [peptideId, pepRoute, dilution]);

  const pk = useMemo(() => {
    const p = PEPTIDE_DB[peptideId];
    if (!p || !dilution) return null;
    const b = p.bioavailability[pepRoute] || { min: 80, max: 100, avg: 90 };
    return computePK({
      doseMcg: dilution.doseMcg, bioAvg: b.avg,
      tHalfHours: p.tHalfHours, scheduleDays: scheduleEn, totalDays: pepTotalDays,
    });
  }, [peptideId, pepRoute, dilution, pepSchedule, pepTotalDays]);

  const sel = PEPTIDE_DB[peptideId];
  const growthSel = growthId ? getPharmaDetail(growthId) : null;

  const GROWTH_CLASSES = new Set(['peptide_ghrh', 'peptide_ghrp', 'igf1', 'mgf', 'insulin', 'peptide_gnrh', 'peptide_fat_loss', 'peptide_other']);
  const growthSubstances = useMemo(() => {
    const inPeptideDb = new Set(PEPTIDE_LIST.map(p => (PEPTIDE_DB[p.id]?.name || '').toLowerCase()));
    return Object.values(PHARMA_DB).filter(s => !!s?.name && GROWTH_CLASSES.has(s.class) && s.id !== 'mk677' && !inPeptideDb.has((s.name || '').toLowerCase()));
  }, []);

  return (
    <div style={{ padding: '0 0 80px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>🧬 Пептидный калькулятор</h2>
      <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 12px' }}>Расчёт дозировок, разведения, PK-модели, рисков и протоколов пептидов и факторов роста.</p>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {/* Peptide Selection + Growth Factors */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text)' }}>🧪 Выберите пептид / фактор роста</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {PEPTIDE_LIST.map((p: any) => (
              <button key={p.id} onClick={() => { setPeptideId(p.id); setGrowthId(null); setPepAmount(p.amountMg || 2); setPepRoute(p.routes?.[0] || 'sc'); setPepProtocol(null); }} style={{
                padding: '6px 10px', borderRadius: 16, fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                background: peptideId === p.id && !growthId ? 'var(--accent)' : 'var(--bg-secondary)',
                color: peptideId === p.id && !growthId ? '#000' : 'var(--text-dim)',
                border: `1px solid ${peptideId === p.id && !growthId ? 'var(--accent)' : 'var(--border)'}`,
              }}>{p.name}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {growthSubstances.map((s: any) => {
              const selG = growthId === s.id;
              return (
                <button key={s.id} onClick={() => { setGrowthId(s.id); setPeptideId(''); setPepProtocol(null); }} style={{
                  padding: '4px 8px', borderRadius: 12, fontSize: 8, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                  background: selG ? '#8b5cf6' : 'var(--bg-secondary)',
                  color: selG ? '#000' : 'var(--text-dim)',
                  border: `1px solid ${selG ? '#8b5cf6' : 'var(--border)'}`,
                  opacity: 0.9,
                }}>{s.name}</button>
              );
            })}
          </div>

          {/* Peptide Info Card */}
          {sel && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 2 }}>{sel.name || sel.shortName || '—'}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4, marginBottom: 3 }}>
                <b>Эффекты:</b> {(sel.effects || []).join(', ') || '—'}
              </div>
              <div style={{ fontSize: 8, color: '#a78bfa', marginBottom: 2 }}>
                <b>T½:</b> {sel.tHalfHours || '—'} ч · <b>Класс:</b> {sel.className || '—'} · <b>Пути:</b> {(sel.routes || []).map((r: any) => ROUTE_LABELS[r] || r).join(', ') || '—'}
              </div>
              {(sel.mechanisms || []).length > 0 && (
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', marginBottom: 2, lineHeight: 1.3 }}>
                  <b>Механизмы:</b> {(sel.mechanisms || []).join(', ') || '—'}
                </div>
              )}
              <div style={{ fontSize: 8, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-dim)' }}><b>Во флаконе:</b> {sel.amountMg || '—'} мг</span>
                <span style={{ color: sel.riskLevel === 'high' ? '#ef4444' : sel.riskLevel === 'medium' ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                  <b>Риск:</b> {sel.riskLevel === 'high' ? 'Высокий' : sel.riskLevel === 'medium' ? 'Средний' : sel.riskLevel === 'low' ? 'Низкий' : '—'}
                </span>
                {(sel.riskNotes || []).length > 0 && (
                  <span style={{ color: '#f59e0b', fontSize: 7, maxWidth: 180, lineHeight: 1.2, display: 'inline-block' }}>
                    ⚠ {(sel.riskNotes || []).slice(0, 3).join('; ') || '—'}
                  </span>
                )}
              </div>
              {sel.bioavailability && Object.keys(sel.bioavailability).length > 0 && (
                <div style={{ fontSize: 7, color: 'var(--text-dim)', marginTop: 2 }}>
                  <b>Биодоступность:</b> {Object.entries(sel.bioavailability).map(([k, v]: [any, any]) => `${ROUTE_LABELS[k] || k}: ${v.avg}%`).join(', ') || '—'}
                </div>
              )}
            </div>
          )}

          {/* Growth Factor Info */}
          {growthId && growthSel && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 2 }}>{growthSel.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                <span><b>Класс:</b> {CLASS_LABELS[growthSel.class] || growthSel.class}</span>
                <span><b>T½:</b> {growthSel.pk?.halfLifeHours ? `${(growthSel.pk.halfLifeHours).toFixed(0)}ч` : '—'}</span>
                <span><b>Биодоступность:</b> {growthSel.pk?.bioavailability ? `${(growthSel.pk.bioavailability * 100).toFixed(0)}%` : '—'}</span>
                <span><b>Vd:</b> {growthSel.pk?.Vd ? `${growthSel.pk.Vd} л` : '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Dilution Calculator */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 12, color: '#60a5fa' }}>💧 Калькулятор разведения</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <PopupNumber label="💊 Кол-во пептида" value={pepAmount} min={0.1} max={100} step={0.1} suffix="мг" onChange={v => setPepAmount(Math.max(0.1, v))} />
            <PopupNumber label="💧 Объём бака" value={pepDilution} min={0.1} max={50} step={0.1} suffix="мл" onChange={v => setPepDilution(Math.max(0.1, v))} />
            <PopupNumber label="💉 Дозировка" value={pepDose} min={1} max={10000} step={10} suffix="мкг" onChange={v => setPepDose(Math.max(1, v))} />
            <PopupSelect label="💉 Шприц" value={pepSyringe} options={Object.entries(SYRINGE_TYPES).map(([k, v]: [any, any]) => ({ id: k, label: v.label }))} onChange={v => setPepSyringe(v as string)} />
            <PopupSelect label="💉 Путь введения" value={pepRoute} options={Object.entries(ROUTE_LABELS).map(([k, v]) => ({ id: k, label: v }))} onChange={v => setPepRoute(v)} />
          </div>
          {dilution && (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>📐 Результат разведения</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9 }}>
                <div>Концентрация: <b style={{ color: '#60a5fa' }}>{dilution.concentrationMcgPerMl.toFixed(1)} мкг/мл</b></div>
                <div>Объем дозы: <b style={{ color: '#60a5fa' }}>{dilution.doseVolumeMl.toFixed(3)} мл</b></div>
                <div>Единиц (IU): <b style={{ color: '#60a5fa' }}>{dilution.syringeUnitsDisplay}</b></div>
                <div>Доз на флакон: <b style={{ color: '#60a5fa' }}>{dilution.dosesPerVial.toFixed(1)}</b></div>
              </div>
            </div>
          )}
        </div>

        {/* PK Display */}
        {pk && (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, color: '#a78bfa' }}>📈 Фармакокинетика (PK)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.1)' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Период полувыведения (T½)</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>{sel ? sel.tHalfHours.toFixed(1) : '—'} ч</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.1)' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Пик концентрации (Cmax)</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>{pk.maxConcentration.toFixed(1)}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.1)' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Steady-state (день)</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>~{pk.steadyStateDay}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.1)' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Средняя концентрация</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>{pk.avgConcentration.toFixed(1)}</div>
              </div>
            </div>
            {pk.days.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                <table style={{ width: '100%', fontSize: 8, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '2px 4px', textAlign: 'left' }}>День</th>
                      <th style={{ padding: '2px 4px' }}>💉</th>
                      <th style={{ padding: '2px 4px', textAlign: 'right' }}>Конц.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pk.days.map(d => (
                      <tr key={d.day} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: d.inject ? 'rgba(167,139,250,0.04)' : 'transparent' }}>
                        <td style={{ padding: '1px 4px' }}>{d.day}</td>
                        <td style={{ padding: '1px 4px', textAlign: 'center' }}>{d.inject ? '💉' : ''}</td>
                        <td style={{ padding: '1px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{d.concentration.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Bioavailability */}
        {bio && (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, color: '#22c55e' }}>💉 Биодоступность ({ROUTE_LABELS[pepRoute] || pepRoute})</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div style={{ padding: '8px 10px', borderRadius: 8, textAlign: 'center', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.1)' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Мин</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{bio.effectiveMinMcg.toFixed(0)} мкг</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, textAlign: 'center', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Средняя</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{bio.effectiveAvgMcg.toFixed(0)} мкг</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 8, textAlign: 'center', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.1)' }}>
                <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>Макс</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{bio.effectiveMaxMcg.toFixed(0)} мкг</div>
              </div>
            </div>
          </div>
        )}

        {/* Dosing Schedule */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 12, color: '#f59e0b' }}>📅 График дозирования</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {WEEK_RU.map(day => {
              const active = pepSchedule.includes(day);
              return (
                <button key={day} onClick={() => setPepSchedule(active ? pepSchedule.filter(d => d !== day) : [...pepSchedule, day])} style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                  background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: active ? '#000' : 'var(--text-dim)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                }}>{day}</button>
              );
            })}
          </div>
          <div>
            <PopupNumber label="📅 Длительность (дней)" value={pepTotalDays} min={1} max={365} step={1} suffix="дн" onChange={v => setPepTotalDays(Math.max(1, v))} />
          </div>
          <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>📊 Итого</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9 }}>
              <div>Доз в неделю: <b style={{ color: '#f59e0b' }}>{pepSchedule.length}</b></div>
              <div>Всего доз: <b style={{ color: '#f59e0b' }}>{Math.round(pepTotalDays / 7 * pepSchedule.length)}</b></div>
              <div>Недельный расход: <b style={{ color: '#f59e0b' }}>{(pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
              <div>Общий расход: <b style={{ color: '#f59e0b' }}>{(pepTotalDays / 7 * pepSchedule.length * pepDose / 1000).toFixed(1)} мг</b></div>
            </div>
          </div>
        </div>

        {/* Risks */}
        {sel && (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, color: '#ef4444' }}>⚠ Риски: {sel.shortName}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {computePeptideRisks(sel).map((r: any, i: number) => (
                <div key={i} style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 9,
                  background: r.riskPercent > 25 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                  border: `1px solid ${r.riskPercent > 25 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  color: r.riskPercent > 25 ? '#ef4444' : '#f59e0b',
                }}>
                  {r.label}: {r.riskPercent}%
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Synergies & Conflicts */}
        {sel && (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 12, color: '#22c55e' }}>🔗 Синергии и конфликты</h4>
            <div style={{ fontSize: 9, lineHeight: 1.6 }}>
              {getPeptideSynergiesFor(peptideId).length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>Синергии:</span>
                  {getPeptideSynergiesFor(peptideId).map((s: any) => (
                    <span key={s.partner} style={{ marginLeft: 6, color: '#22c55e' }}>{s.partnerName} (+{s.strength})</span>
                  ))}
                </div>
              )}
              {getPeptideConflictsFor(peptideId).length > 0 && (
                <div>
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>Конфликты:</span>
                  {getPeptideConflictsFor(peptideId).map((c: any) => (
                    <span key={c.partner} style={{ marginLeft: 6, color: '#ef4444' }}>{c.partnerName} ({c.severity})</span>
                  ))}
                </div>
              )}
              {getPeptideSynergiesFor(peptideId).length === 0 && getPeptideConflictsFor(peptideId).length === 0 && (
                <span style={{ color: 'var(--text-dim)' }}>Нет данных</span>
              )}
            </div>
          </div>
        )}

        {/* Protocol Generator */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 12, color: '#8b5cf6' }}>🎯 Генератор протокола по цели</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {Object.keys(PEPTIDE_GOAL_PROFILES).map(goal => (
              <button key={goal} onClick={() => setPepProtocol(generatePeptideProtocol(goal))} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 9, cursor: 'pointer',
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6', fontWeight: 500,
              }}>
                {goal === 'muscle_growth' ? '💪 Рост мышц' : goal === 'fat_loss' ? '🔥 Жиросжигание' : goal === 'recovery' ? '🔄 Восстановление' : goal === 'gi_healing' ? '🫃 ЖКТ' : goal === 'mitochondria' ? '🧬 Митохондрии' : goal === 'focus' ? '🎯 Фокус' : '😴 Сон'}
              </button>
            ))}
          </div>
          {pepProtocol && (
            <div style={{ background: 'rgba(139,92,246,0.06)', borderRadius: 8, padding: 10, border: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, color: '#8b5cf6' }}>
                {pepProtocol.goal}: оценка синергии <span style={{ fontWeight: 800 }}>{pepProtocol.synergyScore.toFixed(1)}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {pepProtocol.peptides.map((p: any) => (
                  <span key={p.id} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', fontWeight: 600 }}>
                    {p.shortName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
