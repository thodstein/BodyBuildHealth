import React, { useState, useMemo, useCallback } from 'react';
import { PHARMA_DB, getPharmaDetail } from '../../../core/pharma-database';
import { db } from '../../../core/db';
import { PHARMA_DETAILS, type PharmaDetail } from '../../../data/support-category-data';
import type { PharmaSubstance, PD } from '../../../core/types';
import { decodeGarbled } from '../../../utils/text-sanitizer';
import { getDrugTzMechanisms, TZ_MECH_LABELS, TZ_SYSTEM_LABELS, TZ_SYSTEM_ICONS } from '../../../data/support-db';
import { getLabEffectsForDrug, getMarkerName } from '../../../data/support-lab-effects';
import { getPharmaLabMarkers } from '../../../data/pharma-lab-marker-map';
import {
  SYSTEM_LABELS, CLASS_LABELS, PD_LABELS, PD_MECHANISMS, PHARMA_MECH_LABELS,
  CV_LABELS, CV_VALUE_LABELS, CV_VALUE_COLORS, pdBarColor, formatHalfLife,
  PHARMA_CLASSES, type PharmaClass,
} from './constants';

export const DrugDetailCard: React.FC<{ sub: PharmaSubstance; detail?: PharmaDetail }> = React.memo(({ sub, detail }) => {
  const pd = sub.pd || {} as PharmaSubstance['pd'];
  const pdEntries = Object.entries(pd) as [keyof PD, number][];
  const [expandedPD, setExpandedPD] = useState<string | null>(null);

  const handleAddToCourse = useCallback(() => {
    const dr = (detail?.dosageRange || sub.dosageRange);
    const val = dr ? Math.round((dr.min + dr.max) / 2) : 250;
    const unit = dr?.unit || 'mg/wk';
    db.put('course_log', {
      id: crypto.randomUUID(), substanceId: sub.id,
      doseValue: val, doseUnit: unit,
      frequency: typeof dr?.frequency === 'number' ? dr.frequency : 2,
      startWeek: 1, endWeek: 12,
    }).catch(() => {});
  }, [sub.id, sub.dosageRange, detail?.dosageRange]);

  const handleAddToCart = useCallback(() => {
    try {
      const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
      if (!existing.some((x: any) => x.id === sub.id)) {
        localStorage.setItem('supportCart', JSON.stringify([...existing, { id: sub.id, name: sub.name, dose: (detail?.dosageRange || sub.dosageRange)?.min ? `${(detail?.dosageRange || sub.dosageRange)!.min} ${(detail?.dosageRange || sub.dosageRange)!.unit}` : '—', timing: 'daily' }]));
      }
    } catch {}
  }, [sub.id, sub.name, sub.dosageRange, detail?.dosageRange]);

  const riskLabels = useMemo(() => {
    const labels: string[] = [];
    if (pd.hepatotoxicity >= 2) labels.push('Гепатотоксичен');
    if (pd.aromatization >= 0.7) labels.push('Ароматизируется');
    if (pd.progestogenic >= 0.3) labels.push('Прогестагенный');
    if (pd.neuro_toxicity >= 0.3) labels.push('Нейротоксичен');
    if (pd.lipid_impact <= -0.5) labels.push('Ухудшает липиды');
    if (pd.hct_impact >= 4) labels.push('Повышает HCT');
    return labels;
  }, [pd.hepatotoxicity, pd.aromatization, pd.progestogenic, pd.neuro_toxicity, pd.lipid_impact, pd.hct_impact]);

  const effectLabels = useMemo(() => {
    const labels: string[] = [];
    if (pd.AR_affinity >= 1.0) labels.push('Высокая андрогенность');
    else if (pd.AR_affinity >= 0.7) labels.push('Средняя андрогенность');
    if (pd.five_alpha_reduction >= 0.5) labels.push('Восст. в ДГТ');
    if (pd.aromatization === 0) labels.push('Не ароматизируется');
    if (sub.class === 'sarm') labels.push('SARM (селективный)');
    return labels;
  }, [pd.AR_affinity, pd.five_alpha_reduction, pd.aromatization, sub.class]);

  const labMarkers = useMemo(() => getPharmaLabMarkers(sub.id), [sub.id]);

  const tzGroupedData = useMemo(() => {
    const tzMechs = getDrugTzMechanisms(sub.id);
    if (!tzMechs.length) return null;
    const grouped: Record<string, { mechId: string; label: string; weight: number }[]> = {};
    for (const m of tzMechs) {
      if (!grouped[m.organId]) grouped[m.organId] = [];
      grouped[m.organId].push({ mechId: m.mechId, label: TZ_MECH_LABELS[m.mechId] || m.mechId, weight: m.weight });
    }
    return grouped;
  }, [sub.id]);

  const labInfoData = useMemo(() => getLabEffectsForDrug(sub.id), [sub.id]);
  const dirColor: Record<string, string> = { up: '#ef4444', down: '#00e68a', normalize: '#60a5fa' };
  const dirArrow: Record<string, string> = { up: '↑', down: '↓', normalize: '↕' };

  return (
    <div className="card" style={{ fontSize: 12, lineHeight: 1.6 }}>
      <h3 style={{ margin: '0 0 8px', color: 'var(--accent)' }}>{sub.name}</h3>
      <div className="pharma-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 8 }}>
        <span>Класс:</span><span style={{ fontWeight: 600 }}>{CLASS_LABELS[sub.class] || sub.class}</span>
        <span>T½:</span><span style={{ fontWeight: 600 }}>{sub.pk ? formatHalfLife(sub.pk.halfLifeHours) : '—'}</span>
        <span>Биодоступность:</span><span style={{ fontWeight: 600 }}>{sub.pk ? (sub.pk.bioavailability * 100).toFixed(0) : '—'}%</span>
        <span>Vd:</span><span style={{ fontWeight: 600 }}>{sub.pk ? sub.pk.Vd + ' л' : '—'}</span>
        <span>Эстеры:</span><span style={{ fontWeight: 600 }}>{sub.esters?.join(', ') || '—'}</span>
      </div>

      {/* target systems chips */}
      {sub.targetSystems && sub.targetSystems.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Системы-мишени</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {sub.targetSystems.map(s => (
              <span key={s} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontWeight: 500 }}>{SYSTEM_LABELS[s] || s}</span>
            ))}
          </div>
        </div>
      )}

      {/* cv profile chips */}
      {sub.cvProfile && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Сердечно-сосудистый профиль</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {Object.entries(sub.cvProfile).map(([key, val]) => {
              const lbl = CV_VALUE_LABELS[key]?.[val] || val;
              const clr = CV_VALUE_COLORS[key]?.[val] || '#9e9e9e';
              return (
                <span key={key} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${clr}18`, color: clr, fontWeight: 500 }}>{CV_LABELS[key] || key}: {lbl}</span>
              );
            })}
          </div>
        </div>
      )}
      {labMarkers.length > 0 ? (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>🩸 Контролировать анализы</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {labMarkers.map((marker: string) => (
              <span key={marker} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,152,0,0.12)', color: '#ff9800', fontWeight: 500 }}>{marker}</span>
            ))}
          </div>
        </div>
      ) : null}

      {/* linked risks chips */}
      {sub.linkedRisks && sub.linkedRisks.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Связанные риски</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {sub.linkedRisks.map((r, i) => (
              <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: r.direction === 'down' ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)', color: r.direction === 'down' ? '#4caf50' : '#f44336', fontWeight: 500 }}>
                {SYSTEM_LABELS[r.system] || r.system} {r.direction === 'up' ? '↑' : '↓'} {Math.round(r.strength * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* linked substances — expanded */}
      {sub.linkedSubstances && sub.linkedSubstances.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>🔗 Связанные вещества</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {sub.linkedSubstances.map((ls, i) => {
              const linked = PHARMA_DB[ls.id];
              const isSynergy = ls.type === 'synergy';
              const clr = isSynergy ? '#00e68a' : '#ff1744';
              const bg = isSynergy ? 'rgba(0,230,138,0.06)' : 'rgba(255,23,68,0.06)';
              const border = isSynergy ? 'rgba(0,230,138,0.15)' : 'rgba(255,23,68,0.15)';
              return (
                <div key={i} style={{ padding: '5px 8px', borderRadius: 6, background: bg, border: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: clr }}>{isSynergy ? '⊕' : '⊖'} {linked?.name || ls.id}</span>
                    <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: `${clr}20`, color: clr, fontWeight: 600 }}>
                      {isSynergy ? 'СИНЕРГИЯ' : 'АНТАГОНИЗМ'} {Math.round(ls.strength * 100)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3 }}>{ls.mechanism}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* conflicts — expanded */}
      {sub.conflicts && sub.conflicts.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>🔴 Конфликты и несовместимости</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {sub.conflicts.map((c, i) => {
              const sevBg = c.severity === 'HIGH' ? 'rgba(239,68,68,0.08)' : c.severity === 'MEDIUM' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)';
              const sevBorder = c.severity === 'HIGH' ? 'rgba(239,68,68,0.2)' : c.severity === 'MEDIUM' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)';
              const sevColor = c.severity === 'HIGH' ? '#ef4444' : c.severity === 'MEDIUM' ? '#f59e0b' : '#9e9e9e';
              return (
                <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: sevBg, border: `1px solid ${sevBorder}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: sevColor }}>{c.with}</span>
                    <span style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: `${sevColor}18`, color: sevColor, fontWeight: 600 }}>
                      {c.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', lineHeight: 1.35 }}>{c.effect}</div>
                  {c.mechanism && (
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{c.mechanism}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* special instructions — expanded */}
      {sub.specialInstructions && sub.specialInstructions.length > 0 && (
        <div style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>📋 Особые указания</div>
          {sub.specialInstructions.map((si, i) => (
            <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45, padding: '3px 0 3px 10px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: '#f59e0b', fontWeight: 700 }}>•</span>
              {si}
            </div>
          ))}
        </div>
      )}

      {/* contraindications */}
      {(sub.contraindications || detail?.contraindications) && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginBottom: 2 }}>🚫 Противопоказания</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {(sub.contraindications || detail?.contraindications || []).map((c: string, i: number) => (
              <span key={i} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* side effects */}
      {(sub.sideEffects || detail?.sideEffects) && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600, marginBottom: 2 }}>⚠ Побочные эффекты</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {(sub.sideEffects || detail?.sideEffects || []).map((se: any, i: number) => {
              if (typeof se === 'string') return <span key={i} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}>{se}</span>;
              return <span key={i} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: se.frequency === 'common' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)', color: se.frequency === 'common' ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>{se.effect}</span>;
            })}
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Фармакодинамика</div>
            {pdEntries.map(([key, val]) => {
              const absVal = Math.abs(val);
              const maxScale = key === 'AR_affinity' ? 2 : key === 'hct_impact' ? 6 : key === 'hepatotoxicity' ? 4 : 1.2;
              const pct = Math.min(100, (absVal / maxScale) * 100);
              const mechanism = PD_MECHANISMS[key] || '';
              const isExpanded = expandedPD === key;
              return (
                <div key={key} style={{ marginBottom: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setExpandedPD(isExpanded ? null : key)}>
                    <span style={{ fontSize: 11 }}>{PD_LABELS[key] || key} {isExpanded ? '▾' : '▸'}</span>
                    <span style={{ color: pdBarColor(key, val), fontWeight: 600 }}>{val.toFixed(2)}</span>
                  </div>
                  <div style={{ background: 'var(--border)', borderRadius: 2, height: 4 }}>
                    <div style={{ width: `${pct}%`, background: pdBarColor(key, val), height: 4, borderRadius: 2, minWidth: 2 }} />
                  </div>
                  {isExpanded && mechanism && (
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4, marginTop: 2, padding: '3px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                      {mechanism}
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {effectLabels.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Эффекты: </span>
          <span style={{ color: '#4caf50' }}>{effectLabels.join(' · ')}</span>
        </div>
      )}
      {riskLabels.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Риски: </span>
          <span style={{ color: '#ff5252' }}>{riskLabels.join(' · ')}</span>
        </div>
      )}

      {/* ── ТЗ механизмы ── */}
      {tzGroupedData && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>🧬 Механизм-ориентированная модель (ТЗ)</div>
          {Object.entries(tzGroupedData).map(([organId, mechs]) => (
              <details key={organId} style={{ marginBottom: 4 }}>
                <summary style={{ cursor:'pointer', padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', fontSize:10, fontWeight:600, listStyle:'none', display:'flex', alignItems:'center', gap:4 }}>
                  {TZ_SYSTEM_ICONS[organId] || '•'} {TZ_SYSTEM_LABELS[organId] || organId}
                  <span style={{ marginLeft:'auto', fontSize:8, color:'rgba(255,255,255,0.4)' }}>{mechs.length} мех.</span>
                </summary>
                <div style={{ padding:'4px 0 0 8px', display:'flex', flexDirection:'column', gap:2 }}>
                  {mechs.map(m => (
                    <div key={m.mechId} style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', borderRadius:4, fontSize:9, background:'rgba(255,255,255,0.02)' }}>
                      <span style={{ color:'rgba(255,255,255,0.8)', flex:1 }}>{m.label}</span>
                      <span style={{ fontWeight:700, color:m.weight >= 4 ? '#ef4444' : m.weight >= 3 ? '#f97316' : m.weight >= 2 ? '#eab308' : '#22c55e' }}>
                        w={m.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}

      {labInfoData.effects.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>🩸 Влияние на анализы</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {labInfoData.effects.map((eff, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ color: dirColor[eff.direction], fontWeight: 700, fontSize: 14, lineHeight: 1 }}>{dirArrow[eff.direction]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                      {getMarkerName(eff.marker)}
                      <span style={{ marginLeft: 6, fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                        {eff.strength >= 0.4 ? 'значимо' : eff.strength >= 0.2 ? 'умеренно' : 'слабо'} ({(eff.strength * 100).toFixed(0)}%)
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>{eff.reason}</div>
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {(sub.description || (detail?.description)) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Описание</div>
          <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>{decodeGarbled((detail?.description || sub.description) || '')}</div>
        </div>
      )}
      {(detail?.mechanism || sub.mechanisms?.length) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Механизм действия</div>
          {detail?.mechanism ? (
            <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>{decodeGarbled(detail.mechanism)}</div>
          ) : sub.mechanisms?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {sub.mechanisms.map((m, i) => (
                <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 500 }}>{PHARMA_MECH_LABELS[m] || m.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {(detail?.dosageRange || sub.dosageRange) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Диапазон дозировок</div>
          <div className="pharma-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
            {(() => { const dr = detail?.dosageRange || sub.dosageRange; if (!dr) return null; return <>
              <span>Минимум:</span><span>{dr.min} {dr.unit}</span>
              <span>Максимум:</span><span style={{ color: '#ff9100' }}>{dr.max} {dr.unit}</span>
              <span>Частота:</span><span>{dr.frequency}</span>
            </>; })()}
          </div>
        </div>
      )}
      {(detail?.synergies && detail.synergies.length > 0) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>💥 Синергии и комбинации</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(() => { try { return detail!.synergies.map((s: any, i: number) => {
              const linkedName = (typeof s.with === 'string' && PHARMA_DB[s.with]) ? PHARMA_DB[s.with].name : s.with || '—';
              const isSyn = s.type === 'synergistic';
              const isAnt = s.type === 'antagonistic';
              const clr = isSyn ? '#00e68a' : isAnt ? '#ff1744' : '#2979ff';
              const bg = isSyn ? 'rgba(0,230,138,0.06)' : isAnt ? 'rgba(255,23,68,0.06)' : 'rgba(41,121,255,0.06)';
              const lbl = isSyn ? '⊕ Синергия' : isAnt ? '⊖ Антагонизм' : '→ Комплемент';
              return (
                <div key={i} style={{ padding: '6px 10px', borderRadius: 8, background: bg, border: `1px solid ${clr}20` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${clr}20`, color: clr }}>{lbl}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: clr }}>{linkedName}</span>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{s.desc || ''}</div>
                </div>
              );
            }); } catch { return null; }})()}
          </div>
        </div>
      )}
      {((detail?.sideEffects && detail.sideEffects.length > 0) || (sub.sideEffects && sub.sideEffects.length > 0)) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Побочные эффекты</div>
          {(detail?.sideEffects || sub.sideEffects || []).map((se, i) => (
            <div key={i} style={{ marginBottom: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{se.effect}</span>
              <span style={{ color: se.frequency === 'common' ? '#ff9100' : se.frequency === 'rare' ? '#2979ff' : '#ff1744', fontWeight: 600, fontSize: 11 }}>
                {se.frequency === 'common' ? 'часто' : se.frequency === 'rare' ? 'редко' : se.frequency === 'very_rare' ? 'очень редко' : se.frequency}
              </span>
            </div>
          ))}
        </div>
      )}
      {sub.contraindications && sub.contraindications.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Противопоказания</div>
          {sub.contraindications.map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: '#ff5252', marginBottom: 2 }}>• {c}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={handleAddToCourse} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, background: 'rgba(0,230,138,0.12)', color: '#00e68a',
        }}>+ В план</button>
        <button onClick={handleAddToCart} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
        }}>🛒 В корзину</button>
      </div>
    </div>
  );
});

export const CatalogTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});

  const pharmaSubstances = useMemo(() => {
    return Object.values(PHARMA_DB).filter(s => 
      PHARMA_CLASSES.includes(s.class as PharmaClass)
    );
  }, []);

  const groupedByClass = useMemo(() => {
    const map: Record<string, typeof pharmaSubstances> = {};
    for (const s of pharmaSubstances) {
      if (!map[s.class]) map[s.class] = [];
      map[s.class].push(s);
    }
    return map;
  }, [pharmaSubstances]);

  const filteredList = useMemo(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return pharmaSubstances.filter(s => (s.name||'').toLowerCase().includes(q) || (s.id||'').toLowerCase().includes(q) || (s.class && s.class.toLowerCase().includes(q)));
    }
    if (filterClass === 'all') return pharmaSubstances;
    return pharmaSubstances.filter(s => s.class === filterClass);
  }, [filterClass, searchQuery, pharmaSubstances]);

  const toggleClass = (cls: string) => {
    setCollapsedClasses(prev => ({ ...prev, [cls]: !prev[cls] }));
  };

  const filteredGrouped = useMemo(() => {
    if (filterClass !== 'all' || searchQuery) return null;
    return groupedByClass;
  }, [filterClass, searchQuery, groupedByClass]);

  const selected = useMemo(() => selectedId ? getPharmaDetail(selectedId) : null, [selectedId]);
  const detail = useMemo(() => selectedId ? (PHARMA_DETAILS as Record<string, PharmaDetail>)[selectedId] : undefined, [selectedId]);

  const addToCourse = useCallback((s: PharmaSubstance) => {
    const dr = s.dosageRange;
    const val = dr ? Math.round((dr.min + dr.max) / 2) : 250;
    const unit = dr?.unit || 'mg/wk';
    db.put('course_log', {
      id: crypto.randomUUID(), substanceId: s.id,
      doseValue: val, doseUnit: unit,
      frequency: dr?.frequency || '2x/wk',
      startWeek: 1, endWeek: 12,
    }).catch(() => {});
  }, []);

  const addToCart = useCallback((s: PharmaSubstance) => {
    try {
      const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
      if (!existing.some((x: any) => x.id === s.id)) {
        localStorage.setItem('supportCart', JSON.stringify([...existing, { id: s.id, name: s.name, dose: '—', timing: 'daily' }]));
      }
    } catch {}
  }, []);

  return (
    <div>
      <input type="text" placeholder="Поиск по названию..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
        <button onClick={() => setFilterClass('all')} style={{
          padding: '4px 10px', borderRadius: 14, fontSize: 10, cursor: 'pointer',
          background: filterClass === 'all' ? 'rgba(0,230,138,0.15)' : 'transparent',
          color: filterClass === 'all' ? 'var(--accent)' : 'var(--text-dim)',
          border: `1px solid ${filterClass === 'all' ? 'var(--accent)' : 'var(--border)'}`,
          fontWeight: filterClass === 'all' ? 700 : 400,
        }}>Все</button>
        {PHARMA_CLASSES.map(cls => (
          <button key={cls} onClick={() => setFilterClass(cls)} style={{
            padding: '4px 10px', borderRadius: 14, fontSize: 10, cursor: 'pointer',
            background: filterClass === cls ? 'rgba(0,230,138,0.15)' : 'transparent',
            color: filterClass === cls ? 'var(--accent)' : 'var(--text-dim)',
            border: `1px solid ${filterClass === cls ? 'var(--accent)' : 'var(--border)'}`,
            fontWeight: filterClass === cls ? 700 : 400,
          }}>{CLASS_LABELS[cls] || cls}</button>
        ))}
      </div>

      {/* Grouped view when "Все" */}
      {filteredGrouped ? (
        <div>
          {Object.entries(filteredGrouped).map(([cls, substances]) => {
            const isCollapsed = collapsedClasses[cls] ?? false;
            return (
              <div key={cls} style={{ marginBottom: 6 }}>
                <div onClick={() => toggleClass(cls)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                  background: 'var(--bg-secondary)', marginBottom: 2,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                    {CLASS_LABELS[cls] || cls}
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 6, fontWeight: 400 }}>
                      {substances.length}
                    </span>
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{isCollapsed ? '▸' : '▾'}</span>
                </div>
                {!isCollapsed && substances.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 10px 5px 16px', borderRadius: 4, cursor: 'pointer',
                    background: selectedId === s.id ? 'rgba(0,230,138,0.12)' : 'transparent',
                    borderLeft: selectedId === s.id ? '3px solid var(--accent)' : '3px solid transparent',
                    marginBottom: 1,
                  }} onClick={() => setSelectedId(s.id)}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => addToCourse(s)} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, background:'rgba(0,230,138,0.12)', color:'#00e68a' }}>+</button>
                      <button onClick={() => addToCart(s)} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>🛒</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat list when filter is specific class or search is active */
        filteredList.map(s => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 3,
            background: selectedId === s.id ? 'rgba(0,230,138,0.12)' : 'var(--bg-secondary)',
            border: selectedId === s.id ? '1px solid var(--accent)' : '1px solid transparent',
          }} onClick={() => setSelectedId(s.id)}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{CLASS_LABELS[s.class] || s.class}</div>
            </div>
            <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => addToCourse(s)} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, background:'rgba(0,230,138,0.12)', color:'#00e68a' }}>+</button>
              <button onClick={() => addToCart(s)} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>🛒</button>
            </div>
          </div>
        ))
      )}
      {filteredList.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
          {searchQuery ? 'Ничего не найдено' : ''}
        </div>
      )}

      {/* Popup detail modal — same style as supplements catalog */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
        }} onClick={() => setSelectedId(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '92%', maxWidth: 480, maxHeight: '85vh',
            borderRadius: 16, background: '#18181b',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 16px 60px rgba(0,0,0,0.5)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent), #00c853)' }} />
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{selected.name}</span>
                <button onClick={() => setSelectedId(null)} style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '4px 10px',
                  cursor: 'pointer', fontSize: 10, fontWeight: 600,
                }}>✕ Закрыть</button>
              </div>
              <DrugDetailCard sub={selected} detail={detail} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};