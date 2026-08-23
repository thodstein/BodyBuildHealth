/**
 * ProMetricsPanel.tsx — P12: UI-интеграция проф-движков.
 * REUSE P1/P3/P4/P6/P9. Калькулятор относительной силы + монитор тренировочной нагрузки (sRPE/ACWR/fitness-fatigue)
 * + панель проф-авторегуляции (readiness/ACWR/velocity-loss → корректировка плана).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { relativeStrengthReport } from '../../../engines/pro/relative-strength.engine';
import { trainingLoadReport, toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { autoRegulate } from '../../../engines/pro/autoregulation-pro.engine';
import { listSchemes, generateProgression } from '../../../engines/pro/progression-pro.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { PL_NORM_TABLES, classifyTotal, findCategory, findCategoryByLabel, classifyTotalForCategory, getNormTable, RANK_ORDER, RANK_LABELS, NORM_EXPLANATIONS, CATEGORY_EXPLANATION, type ClassificationResult, type NormTable, type Federation, type Discipline, type Sex } from '../../../engines/pl-norms.engine';
import { getProfile } from '../../../core/profile-manager';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 12, lineHeight: 1.4 };
const LABEL: React.CSSProperties = { color: '#fff', fontSize: 11, margin: '4px 0 2px' };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' };
const zoneColor = (z: string) => z === 'dangerous' ? '#ef4444' : z === 'caution' ? '#f59e0b' : z === 'undertrained' ? '#60a5fa' : ACCENT;

const SEC: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#fff', background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid var(--accent)' };
const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, color, background: color + '22', border: '1px solid ' + color + '55' }}>{children}</span>
);


// Canvas-график fitness-fatigue (performance кривая) + ACWR-зона (P12 wire #3)
const FFChart: React.FC<{ series: { date: string; fitness: number; fatigue: number; performance: number }[] }> = ({ series }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; const rect = cv.getBoundingClientRect();
    cv.width = rect.width * dpr; cv.height = 130 * dpr; ctx.scale(dpr, dpr);
    const w = rect.width, h = 130; const pad = { top: 14, right: 8, bottom: 16, left: 8 };
    const drawW = w - pad.left - pad.right, drawH = h - pad.top - pad.bottom;
    ctx.fillStyle = '#2c2c2e'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8e8e93'; ctx.font = '10px sans-serif'; ctx.fillText('Fitness-Fatigue (performance)', pad.left, 11);
    if (!series || series.length < 2) { ctx.fillStyle = '#666'; ctx.fillText('нужно ≥2 сессии', w/2-40, h/2); return; }
    const perf = series.map(p => p.performance);
    const min = Math.min(...perf), max = Math.max(...perf);
    const span = max - min || 1;
    const xStep = drawW / (series.length - 1);
    const y = (v: number) => pad.top + drawH - ((v - min) / span) * drawH;
    ctx.strokeStyle = '#3a3a3c'; ctx.beginPath(); ctx.moveTo(pad.left, pad.top + drawH/2); ctx.lineTo(w-pad.right, pad.top+drawH/2); ctx.stroke();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 2; ctx.beginPath();
    perf.forEach((v, i) => { const x = pad.left + i * xStep; i === 0 ? ctx.moveTo(x, y(v)) : ctx.lineTo(x, y(v)); });
    ctx.stroke();
  }, [series]);
  return <canvas ref={ref} style={{ width: '100%', height: 130, display: 'block', marginTop: 8 }} />;
};

export const ProMetricsPanel: React.FC = () => {
  // ── Относительная сила ──
  const [squat, setSquat] = useState<number>(200);
  const [bench, setBench] = useState<number>(140);
  const [deadlift, setDeadlift] = useState<number>(260);
  const [bw, setBw] = useState<number>(90);
  const [sex, setSex] = useState<'male' | 'female'>(() => { try { return (getProfile().settings as any)?.personal?.sex === 'female' ? 'female' : 'male'; } catch { return 'male'; } });
  const total = squat + bench + deadlift;
  const rs = useMemo(() => relativeStrengthReport(total, bw, sex), [total, bw, sex]);

  // ── Нормативы по весовой категории ──
  const [federation, setFederation] = useState<Federation>('wrpf_untested');
  const [discipline, setDiscipline] = useState<Discipline>('total');
  const [manualCat, setManualCat] = useState<string>(''); // пусто = авто по весу
  const disciplineOptions = useMemo(() => {
    const all = PL_NORM_TABLES.filter(t => t.federation === federation && t.sex === sex);
    const labels: Record<Discipline, string> = { total: 'Троеборье', bench: 'Жим лёжа', deadlift: 'Становая тяга', squat: 'Присед' };
    if (federation === 'fpr_ipf' && sex === 'male') return [{ value: 'total' as Discipline, label: 'Троеборье' }];
    if (federation === 'fpr_ipf' && sex === 'female') return [{ value: 'total' as Discipline, label: 'Троеборье' }, { value: 'bench' as Discipline, label: 'Жим лёжа' }]
      .filter(o => all.some(t => t.discipline === o.value));
    return all.map(t => ({ value: t.discipline, label: labels[t.discipline] || t.discipline }));
  }, [federation, sex]);
  const normTable = useMemo(() => getNormTable(federation, discipline, sex) || PL_NORM_TABLES.find(t => t.sex === sex) || PL_NORM_TABLES[0], [federation, discipline, sex]);
  const autoCat = useMemo(() => findCategory(normTable, bw), [normTable, bw]);
  const effectiveCat = useMemo(() => {
    if (manualCat) {
      const f = findCategoryByLabel(normTable, manualCat);
      if (f) return f;
    }
    return autoCat;
  }, [normTable, manualCat, autoCat]);
  const liftValue = discipline === 'bench' ? bench : discipline === 'deadlift' ? deadlift : discipline === 'squat' ? squat : total;
  const classif = useMemo(() => classifyTotalForCategory(normTable, effectiveCat, liftValue), [normTable, effectiveCat, liftValue]);

  // Per-lift relative strength
  const liftRel = useMemo(() => ({
    squat: bw > 0 ? +(squat / bw).toFixed(2) : 0,
    bench: bw > 0 ? +(bench / bw).toFixed(2) : 0,
    deadlift: bw > 0 ? +(deadlift / bw).toFixed(2) : 0,
  }), [squat, bench, deadlift, bw]);

  // Per-lift classification (WRPF only, с учётом пола)
  const liftClassifs = useMemo(() => {
    const lifts: { key: Discipline; value: number; label: string }[] = [
      { key: 'squat', value: squat, label: 'Присед' },
      { key: 'bench', value: bench, label: 'Жим' },
      { key: 'deadlift', value: deadlift, label: 'Тяга' },
    ];
    return lifts.map(l => {
      const t = getNormTable(federation, l.key, sex);
      return t ? { ...l, classif: classifyTotal(t, bw, l.value) } : null;
    }).filter(Boolean) as { key: Discipline; value: number; label: string; classif: ClassificationResult }[];
  }, [federation, bw, squat, bench, deadlift, sex]);

  // ── Монитор нагрузки (sRPE × длительность) ──
  // P12 wire: реальные sRPE-сессии из дневника (srpe-store); демо-массив как fallback, если <2 реальных.
  const realSRPE = React.useMemo(() => loadSRPESessions(), []);
  const [sessions, setSessions] = useState<{ sRPE: number; duration: number }[]>(
    realSRPE.length >= 2
      ? realSRPE.map(r => ({ sRPE: r.sRPE, duration: r.durationMin }))
      : [
        { sRPE: 8, duration: 70 }, { sRPE: 7, duration: 60 }, { sRPE: 8, duration: 75 },
        { sRPE: 9, duration: 80 }, { sRPE: 7, duration: 65 }, { sRPE: 8, duration: 70 },
        { sRPE: 8, duration: 75 }, { sRPE: 9, duration: 85 },
      ]
  );
  const realCount = realSRPE.length;
  const tlReport = useMemo(() => {
    const today = new Date();
    const mapped = sessions.map((s, i) => { const d = new Date(today); d.setDate(d.getDate() - (sessions.length - 1 - i)); return { date: d.toISOString().slice(0, 10), sRPE: s.sRPE, durationMin: s.duration }; });
    return trainingLoadReport(mapped);
  }, [sessions]);

  // ── Проф-авторегуляция ──
  const [readiness, setReadiness] = useState<number>(75);
  const [fatigue, setFatigue] = useState<number>(40);
  const [hrvRatio, setHrvRatio] = useState<number>(1.0);
  const [sleepScore, setSleepScore] = useState<number>(70);
  const [lastRPE, setLastRPE] = useState<number>(8);
  const [vlPct, setVlPct] = useState<number>(15);
  const ar = useMemo(() => autoRegulate({
    readiness, acwr: { ratio: tlReport.acwr.ratio, zone: tlReport.acwr.zone },
    fatigue, hrvRatio, sleepScore, lastSessionRPE: lastRPE, lastVelocityLossPct: vlPct,
    plannedTopSetPct: 0.85, plannedRIR: 2, plannedVolumeMult: 1,
  }), [readiness, fatigue, hrvRatio, sleepScore, lastRPE, vlPct, tlReport.acwr]);

  // ── Прогрессии (список схем) ──
  const schemes = useMemo(() => listSchemes(), []);
  const [schemeId, setSchemeId] = useState<string>('531');
  const [e1rm, setE1rm] = useState<number>(120);
  const prog = useMemo(() => generateProgression(schemeId as any, e1rm), [schemeId, e1rm]);

  return (
    <div>
      <div style={{ ...H, fontSize: 16, margin: "0 0 8px" }}>🧮 Pro-метрики <span style={{ fontSize: 10, color: "#fff", fontWeight: 400 }}>проф-движки: e1RM · нагрузка · VBT · авторегуляция · относ. сила · прогрессии</span></div>

      {/* Относительная сила */}
      <div style={CARD}>
        <div style={{ ...SEC, borderLeftColor: '#a855f7' }}>🏋️ Калькулятор «сила / масса»</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div><div style={LABEL}>Присед, кг</div><input style={IN} type="number" value={squat} onChange={e => setSquat(+e.target.value || 0)} /></div>
          <div><div style={LABEL}>Жим лёжа, кг</div><input style={IN} type="number" value={bench} onChange={e => setBench(+e.target.value || 0)} /></div>
          <div><div style={LABEL}>Тяга, кг</div><input style={IN} type="number" value={deadlift} onChange={e => setDeadlift(+e.target.value || 0)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          <div><div style={LABEL}>Вес тела, кг</div><input style={IN} type="number" value={bw} onChange={e => setBw(+e.target.value || 1)} /></div>
          <div><div style={LABEL}>Пол</div><select style={IN} value={sex} onChange={e => setSex(e.target.value as any)}><option value="male">М</option><option value="female">Ж</option></select></div>
          <div style={{ textAlign: 'center' }}>
            <div style={LABEL}>Тотал</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT, lineHeight: '38px' }}>{total} <span style={{ fontSize: 10, color: '#fff', fontWeight: 400 }}>кг</span></div>
          </div>
        </div>

        {/* Per-lift relative strength bars */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Относительная сила по движениям (× веса тела)</div>
          {[
            { label: 'Присед', value: liftRel.squat, color: '#ef4444' },
            { label: 'Жим', value: liftRel.bench, color: '#3b82f6' },
            { label: 'Тяга', value: liftRel.deadlift, color: '#f59e0b' },
          ].map(l => {
            const pct = Math.min(100, (l.value / 4) * 100);
            const level = l.value >= 2.5 ? 'Элита' : l.value >= 2.0 ? 'Опытный' : l.value >= 1.5 ? 'Средний' : 'Новичок';
            const lvlColor = l.value >= 2.5 ? ACCENT : l.value >= 2.0 ? '#60a5fa' : l.value >= 1.5 ? '#f59e0b' : '#fff';
            return (
              <div key={l.label} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#fff', marginBottom: 1 }}>
                  <span>{l.label}</span>
                  <span>{l.value}× <span style={{ color: lvlColor }}>({level})</span></span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: l.color, opacity: 0.7 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.08)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          <b style={{ color: '#fff' }}>Как читать график по движениям:</b> длина полосы — килограммы движения ÷ вес тела (×BW). Пороги для мужчин: присед 1.5/2.0/2.5, жим 1.0/1.3/1.6, тяга 2.0/2.5/3.0; для женщин — на ~30% ниже. Самая короткая полоса = отстающее движение (слабейшая группа). Переключатель пола выше меняет пороги и расчёт очков.
        </div>

        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Коэффициенты (тотал) — DOTS/Wilks/IPF GL + относительная</div>
          <div style={ROW}><span>Wilks</span><b style={{ color: '#fff' }}>{rs.wilks}</b></div>
          <div style={ROW}><span>DOTS</span><b style={{ color: ACCENT }}>{rs.dots} — {rs.classification.label}</b></div>
          <div style={ROW}><span>IPF GLI</span><b style={{ color: '#fff' }}>{rs.ipfGL}</b></div>
          <div style={ROW}><span>Allometric (×bw<sup>⅔</sup>)</span><b style={{ color: '#fff' }}>{rs.allometric}</b></div>
          <div style={ROW}><span>Относит. (тотал/вес)</span><b style={{ color: '#fff' }}>{rs.relative}×</b></div>
        </div>
        <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)', fontSize: 10, color: '#fff', lineHeight: 1.45 }}>
          <b style={{ color: '#fff' }}>Что это:</b> {NORM_EXPLANATIONS.points}<br />
          <b style={{ color: '#fff' }}>Как читать:</b> DOTS/Wilks — полиномиальная компенсация веса (чем тяжелее, тем меньше очков за кг). IPF GL — 0-120 (100+ элита). Относительная — тотал/вес (простая, но игнорирует аллометрию). Все уже с учётом пола ({sex === 'female' ? 'женские коэффициенты' : 'мужские'}).
        </div>
      </div>

      {/* ── Нормативы по весовой категории ── */}
      <div style={CARD}>
        <div style={{ ...SEC, borderLeftColor: '#f59e0b' }}>📋 Разрядные нормативы (весовая категория)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={LABEL}>Федерация</div>
            <select style={IN} value={federation} onChange={e => { setFederation(e.target.value as Federation); setDiscipline('total'); setManualCat(''); }}>
              {(['fpr_ipf', 'wrpf_untested', 'wrpf_tested'] as Federation[]).map(f => {
                const t = PL_NORM_TABLES.find(x => x.federation === f);
                return <option key={f} value={f}>{t?.federationLabel || f}</option>;
              })}
            </select>
          </div>
          <div>
            <div style={LABEL}>Дисциплина</div>
            <select style={IN} value={discipline} onChange={e => { setDiscipline(e.target.value as Discipline); setManualCat(''); }}>
              {disciplineOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={LABEL}>Весовая категория (просмотр)</div>
          <select style={IN} value={manualCat || '__auto'} onChange={e => setManualCat(e.target.value === '__auto' ? '' : e.target.value)}>
            <option value="__auto">Авто: {autoCat.label} (по {bw} кг)</option>
            {normTable.categories.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 3, lineHeight: 1.3 }}>Авто — по вашему весу ({bw} кг → {autoCat.label}). Выберите любую для просмотра «что если» без смены веса. Подробный просмотр всех категорий — в «Анализ силы → Единый».</div>
          {manualCat && manualCat !== autoCat.label && (
            <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 10, color: '#f59e0b' }}>Просмотр «{manualCat}» ≠ авто «{autoCat.label}». На помосте зачёт по фактической категории взвешивания.</div>
          )}
        </div>
        <div style={ROW}>
          <span>{discipline === 'total' ? 'Тотал' : disciplineOptions.find(d => d.value === discipline)?.label || discipline}</span>
          <b style={{ color: ACCENT }}>{liftValue} кг</b>
        </div>
        <div style={ROW}><span>Достигнут разряд</span><b style={{ color: classif.achievedRank ? ACCENT : '#fff' }}>{classif.achievedLabel}</b></div>
        {classif.kgToNext > 0 && classif.nextRank && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: '#fff' }}>До {classif.nextLabel}: <b style={{ color: '#f59e0b' }}>+{classif.kgToNext} кг</b></span>
              <span style={{ fontSize: 10, color: '#fff' }}>{liftValue} / {classif.allRanks.find(r => r.key === classif.nextRank)?.threshold || '?'} кг</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              {(() => {
                const prevThr = classif.allRanks.find(r => r.key === classif.achievedRank)?.threshold || 0;
                const nextThr = classif.allRanks.find(r => r.key === classif.nextRank)?.threshold || 300;
                const pct = Math.min(100, Math.max(0, ((liftValue - prevThr) / (nextThr - prevThr)) * 100));
                return <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'linear-gradient(90deg, #f59e0b, #22c55e)' }} />;
              })()}
            </div>
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: classif.allRanks.length <= 4 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 4 }}>
            {classif.allRanks.map(r => (
              <div key={r.key} style={{ padding: '4px 6px', borderRadius: 6, textAlign: 'center', fontSize: 9, fontWeight: 700, background: r.achieved ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)', border: r.achieved ? '1px solid rgba(0,230,138,0.4)' : '1px solid rgba(255,255,255,0.05)', color: r.achieved ? ACCENT : '#fff' }}>
                <div style={{ fontSize: 11 }}>{r.achieved ? '✓' : ''} {r.label}</div>
                <div style={{ fontSize: 9, marginTop: 2 }}>{r.threshold} кг</div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-lift mini cards (when total is selected and WRPF has individual norms) */}
        {discipline === 'total' && liftClassifs.length > 0 && (
          <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 6 }}>По движениям ({federation === 'wrpf_untested' ? 'WRPF без ДК' : federation === 'wrpf_tested' ? 'WRPF с ДК' : 'ФПР/IPF'} · {sex === 'female' ? '♀ женщины' : '♂ мужчины'}):</div>
            {liftClassifs.map(lc => (
              <div key={lc.key} style={{ marginBottom: 6, padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{lc.label}</span>
                  <span style={{ fontSize: 10, color: ACCENT }}>{lc.value} кг</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {lc.classif.allRanks.map(r => (
                    <span key={r.key} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700, background: r.achieved ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.03)', color: r.achieved ? ACCENT : '#fff', border: r.achieved ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.04)' }}>
                      {r.achieved ? '✓' : ''} {r.label} {r.threshold}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          <b style={{ color: '#fff' }}>Как читать нормативы:</b> {NORM_EXPLANATIONS.howRank} {CATEGORY_EXPLANATION} Полоса прогресса — доля пути от текущего разряда к следующему. Ручной выбор категории (в «Едином» калькуляторе вкладки «Анализ силы») позволяет посмотреть «что если» без смены веса.
        </div>
      </div>

      {/* Монитор нагрузки */}
      <div style={CARD}>
        <div style={{ ...SEC, borderLeftColor: '#60a5fa' }}>📊 Монитор нагрузки (sRPE × длительность)</div>
        <div style={SMALL}>ACWR (7/28д EWMA), monotony/strain, fitness-fatigue (Banister)</div>
        <div style={{ ...SMALL, color: realCount >= 2 ? ACCENT : '#f59e0b' }}>{realCount >= 2 ? '✓ данные из дневника (' + realCount + ' сессий с sRPE)' : 'демо-данные — завершайте тренировки с указанием sRPE во вкладке «Выполнение»'}</div>
        <div style={ROW}><span>ACWR (острая/хроническая)</span><Badge color={zoneColor(tlReport.acwr.zone)}>{tlReport.acwr.ratio} · {tlReport.acwr.zone}</Badge></div>
        <div style={ROW}><span>Острая / хроническая (AU)</span><b style={{ color: '#fff' }}>{Math.round(tlReport.acwr.acute)} / {Math.round(tlReport.acwr.chronic)}</b></div>
        <div style={ROW}><span>Monotony / Strain</span><b style={{ color: '#fff' }}>{tlReport.monotony.monotony} / {tlReport.monotony.strain}</b></div>
        {tlReport.banister.current && <div style={ROW}><span>Fitness − Fatigue (perf.)</span><b style={{ color: tlReport.banister.current.performance > 0 ? ACCENT : '#ef4444' }}>{tlReport.banister.current.fitness} − {tlReport.banister.current.fatigue} = {tlReport.banister.current.performance}</b></div>}
        {tlReport.recommendations.map((r, i) => <div key={i} style={{ ...SMALL, marginTop: 4, color: '#fff' }}>• {r}</div>)}
        <FFChart series={tlReport.banister.series} />
      </div>

      {/* Проф-авторегуляция */}
      <div style={CARD}>
        <div style={{ ...SEC, borderLeftColor: ACCENT }}>🧠 Проф-авторегуляция (HRV + готовность → веса)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div><div style={LABEL}>Готовность</div><input style={IN} type="number" value={readiness} onChange={e => setReadiness(+e.target.value)} /></div>
          <div><div style={LABEL}>Усталость</div><input style={IN} type="number" value={fatigue} onChange={e => setFatigue(+e.target.value)} /></div>
          <div><div style={LABEL}>HRV-ratio</div><input style={IN} type="number" step="0.01" min="0.5" max="1.5" value={hrvRatio} onChange={e => setHrvRatio(+e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
          <div><div style={LABEL}>Сон (0-100)</div><input style={IN} type="number" value={sleepScore} onChange={e => setSleepScore(+e.target.value)} /></div>
          <div><div style={LABEL}>Посл. RPE</div><input style={IN} type="number" step="0.5" value={lastRPE} onChange={e => setLastRPE(+e.target.value)} /></div>
          <div><div style={LABEL}>VLoss %</div><input style={IN} type="number" value={vlPct} onChange={e => setVlPct(+e.target.value)} /></div>
        </div>
        <div style={{ ...SMALL, marginTop: 6 }}>На входе: готовность {readiness}, ACWR {tlReport.acwr.ratio} ({tlReport.acwr.zone}), HRV ×{hrvRatio.toFixed(2)}</div>
        {ar.intensityNote && <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: ar.intensityNote === 'силовая' ? 'rgba(239,68,68,0.12)' : ar.intensityNote === 'восстановительная' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: ar.intensityNote === 'силовая' ? '#ef4444' : ar.intensityNote === 'восстановительная' ? '#22c55e' : '#f59e0b', border: '1px solid rgba(255,255,255,0.06)' }}>🎯 Рекомендация: {ar.intensityNote === 'силовая' ? 'Силовая сессия (пуш)' : ar.intensityNote === 'восстановительная' ? 'Восстановительная сессия' : ar.intensityNote === 'лёгкая' ? 'Лёгкая сессия' : ar.intensityNote}</div>}
        <div style={ROW}><span>Топ-сет множитель</span><b style={{ color: ar.topSetPctMultiplier >= 1 ? ACCENT : '#f59e0b' }}>×{ar.topSetPctMultiplier}</b></div>
        <div style={ROW}><span>Объём множитель</span><b style={{ color: ar.volumeMultiplier >= 1 ? ACCENT : '#f59e0b' }}>×{ar.volumeMultiplier}</b></div>
        <div style={ROW}><span>RIR-сдвиг</span><b style={{ color: '#fff' }}>+{ar.rirShift}</b></div>
        <div style={ROW}><span>Deload-триггер</span><b style={{ color: ar.deload ? '#ef4444' : ACCENT }}>{ar.deload ? 'да' : 'нет'}</b></div>
        {ar.decisions.map((d, i) => <div key={i} style={{ ...SMALL, marginTop: 3, color: '#fff' }}>• {d}</div>)}
      </div>

      {/* Прогрессии */}
      <div style={CARD}>
        <div style={{ ...SEC, borderLeftColor: '#f59e0b' }}>📈 Прогрессии ({schemes.length} схем)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 6 }}>
          {schemes.map(sc => <button key={sc.id} onClick={() => setSchemeId(sc.id)} style={{ padding: '5px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', border: schemeId===sc.id?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: schemeId===sc.id?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.02)', color: schemeId===sc.id?'#00e68a':'var(--text-dim)' }}>{sc.name}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><div style={LABEL}>e1RM:</div><input style={{ ...IN, width: 80 }} type="number" value={e1rm} onChange={e => setE1rm(+e.target.value)} /></div>
        {prog && <div style={SMALL}>TM = {prog[0].trainingMax} кг · {prog.length} нед</div>}
        {prog && prog.slice(0, 3).map(wk => <div key={wk.week} style={{ ...SMALL, marginTop: 4 }}><b>Нед {wk.week}:</b> {wk.days[0].sets.map(s => `${s.sets}×${s.reps}×${s.weight}кг`).join(' · ')}</div>)}
      </div>
    </div>
  );
};
export default ProMetricsPanel;
