// ════════════════════════════════════════════════════════════════════════════
//  SupplementComplianceCard — Календарь комплаенса приёма БАДов
//  Подключается как вкладка в SupportDiaryView
// ════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { computeCompliance, getComplianceWeekLabel, type ComplianceSummary } from '../../../engines/supplement-compliance.engine';

const ACCENT = '#00e68a';
const DANGER = '#ef4444';
const WARN = '#f59e0b';
const DIM = 'rgba(255,255,255,0.4)';
const BG = 'rgba(24,24,27,0.6)';
const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(24,24,27,0.6)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
};

function adherenceColor(pct: number): string {
  if (pct >= 90) return '#22c55e';
  if (pct >= 70) return '#f59e0b';
  if (pct >= 50) return '#f97316';
  return '#ef4444';
}

/**
 * SupplementComplianceCard — Календарь комплаенса приёма БАДов.
 * Читает данные из he_support_diary (через computeCompliance).
 * План веществ передаётся через data-plan-subs атрибут контейнера.
 */
export const SupplementComplianceCard: React.FC<{ planSubs?: string[] }> = ({ planSubs }) => {
  const [daysBack] = useState(28);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setMobile(window.innerWidth <= 480);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const data = useMemo(() => computeCompliance(daysBack, planSubs), [daysBack, planSubs]);

  if (data.activeSubstances.length === 0) {
    return (
      <div className="sup-compliance" style={{ padding: 16, borderRadius: 14, background: BG, border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>📋 Комплаенс приёма</div>
        <div style={{ fontSize: 10, color: DIM }}>Нет активных назначений. Добавьте препараты в разделе «Симптомы» → «Решить симптом».</div>
      </div>
    );
  }

  // Статистика
  const stats = [
    { label: 'Всего дней', value: data.totalDaysTracked || 0, icon: '📅' },
    { label: 'Пропущено приёмов', value: data.missedDoses || 0, icon: '❌' },
    { label: 'Средняя серия', value: `${data.avgStreak || 0} дн.`, icon: '🔥' },
    { label: 'Стабильность', value: `${data.consistencyScore || 0}%`, icon: '📊' },
  ];

  const todayAdh = data.today?.adherence ?? 0;
  const weekAdh = data.overall7d;
  const monthAdh = data.overall30d;

  return (
    <div className="sup-compliance" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* ── Hero Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 7, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Сегодня</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: adherenceColor(todayAdh), marginTop: 2 }}>{todayAdh}%</div>
          <div style={{ fontSize: 7, color: DIM }}>{data.today?.taken ?? 0}/{data.today?.total ?? 0} принято</div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 7, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>7 дней</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: adherenceColor(weekAdh), marginTop: 2 }}>{weekAdh}%</div>
          <div style={{ fontSize: 7, color: DIM }}>среднее за неделю</div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 7, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>30 дней</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: adherenceColor(monthAdh), marginTop: 2 }}>{monthAdh}%</div>
          <div style={{ fontSize: 7, color: DIM }}>среднее за месяц</div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 7, color: DIM, textTransform: 'uppercase', letterSpacing: 0.3 }}>Серия</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT, marginTop: 2 }}>{data.streak}</div>
          <div style={{ fontSize: 7, color: DIM }}>дней подряд 100%</div>
        </div>
       </div>

       {/* Детальная статистика */}
       <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 6 }}>
         {stats.map((stat, i) => (
           <div key={i} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
             <div style={{ fontSize: 14, marginBottom: 2 }}>{stat.icon}</div>
             <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{stat.value}</div>
             <div style={{ fontSize: 7, color: DIM }}>{stat.label}</div>
           </div>
         ))}
       </div>

       {/* Достижения */}
       {data.achievements && data.achievements.length > 0 && (
         <div style={{ ...GLASS_CARD, padding: 12 }}>
           <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>🏆 Достижения</div>
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
             {data.achievements.map((ach, i) => (
               <div key={i} style={{
                 padding: '8px 12px', borderRadius: 8,
                 background: ach.unlockedAt ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.04)',
                 border: `1px solid ${ach.unlockedAt ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
                 display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 150,
               }}>
                 <span style={{ fontSize: 20 }}>{ach.icon}</span>
                 <div>
                   <div style={{ fontSize: 11, fontWeight: 600, color: ach.unlockedAt ? '#00e68a' : '#94a3b8' }}>
                     {ach.title}
                   </div>
                   <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
                     {ach.description}
                   </div>
                   {!ach.unlockedAt && ach.progress !== undefined && (
                     <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
                       <div style={{
                         height: '100%', borderRadius: 2, background: '#00e68a',
                         width: `${ach.progress}%`, transition: 'width 0.3s',
                       }} />
                     </div>
                   )}
                 </div>
               </div>
             ))}
           </div>
         </div>
       )}

       {/* График по веществам */}
       <div style={{ ...GLASS_CARD, padding: 12 }}>
         <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>📊 Комплаенс по веществам (7 дней)</div>
         <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
           {data.activeSubstances.map((sub, i) => (
             <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <div style={{ flex: 1, fontSize: 11, color: '#e2e8f0' }}>{sub.name}</div>
               <div style={{ width: 100, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)' }}>
                 <div style={{
                   height: '100%', borderRadius: 4,
                   background: sub.adherence7d >= 80 ? '#00e68a' : sub.adherence7d >= 50 ? '#f59e0b' : '#ef4444',
                   width: `${sub.adherence7d}%`, transition: 'width 0.3s',
                 }} />
               </div>
               <div style={{ fontSize: 10, color: '#94a3b8', minWidth: 32, textAlign: 'right' }}>
                 {sub.adherence7d}%
               </div>
             </div>
           ))}
         </div>
       </div>

       {/* ── Weekly bars ── */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 60 }}>
        {data.weeks.slice(-4).map((w, i) => (
          <div
            key={i}
            onClick={() => setExpandedWeek(expandedWeek === i ? null : i)}
            style={{
              flex: 1, cursor: 'pointer', borderRadius: '6px 6px 0 0',
              background: adherenceColor(w.overallAdherence),
              height: `${Math.max(8, (w.overallAdherence / 100) * 60)}px`,
              transition: 'height 0.3s',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              paddingBottom: 4, position: 'relative',
            }}
          >
            <span style={{ fontSize: 7, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              {w.overallAdherence}%
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
        {data.weeks.slice(-4).map((w, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 7, color: DIM }}>
            {getComplianceWeekLabel(w)}
          </div>
        ))}
      </div>

      {/* ── Expanded week detail ── */}
      {expandedWeek !== null && data.weeks.slice(-4)[expandedWeek] && (() => {
        const w = data.weeks.slice(-4)[expandedWeek];
        return (
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              {getComplianceWeekLabel(w)} · Принято {w.totalTaken}/{w.totalAssigned} ({w.overallAdherence}%)
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {w.days.map(d => {
                const col = d.total === 0 ? 'rgba(255,255,255,0.06)' : adherenceColor(d.adherence);
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.adherence}% (${d.taken}/${d.total})`}
                    style={{
                      flex: 1, padding: '4px 0', borderRadius: 4, textAlign: 'center',
                      background: col, fontSize: 7, fontWeight: 700,
                      color: d.total === 0 ? DIM : '#fff',
                      cursor: 'default',
                    }}
                  >
                    {new Date(d.date).getDate()}
                    <div style={{ fontSize: 6, marginTop: 1, opacity: 0.8 }}>{d.taken}/{d.total}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Active substances ── */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Активные назначения ({data.activeSubstances.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {data.activeSubstances.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>{s.name}</div>
                <div style={{ fontSize: 7, color: DIM }}>{s.dose} · с {s.startedAt.split('T')[0]}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${s.adherence7d}%`, height: '100%', borderRadius: 2, background: adherenceColor(s.adherence7d) }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: adherenceColor(s.adherence7d) }}>{s.adherence7d}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SVG trend mini-chart (7-day) ── */}
      {data.weeks.length > 0 && (() => {
        const last14 = data.weeks.flatMap(w => w.days).slice(-14);
        if (last14.length < 2) return null;
        const maxH = 40;
        const w = 240;
        const pad = { l: 28, r: 8, t: 4, b: 14 };
        const plotW = w - pad.l - pad.r;
        const plotH = maxH - pad.t - pad.b;
        const pts = last14.map((d, i) => ({
          x: pad.l + (i / Math.max(1, last14.length - 1)) * plotW,
          y: pad.t + plotH - (d.adherence / 100) * plotH,
          adh: d.adherence,
        }));
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        const areaD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${pad.t + plotH} L ${pts[0].x.toFixed(1)} ${pad.t + plotH} Z`;

        return (
          <svg viewBox={`0 0 ${w} ${maxH}`} style={{ width: '100%', maxWidth: w }}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(pct => {
              const y = pad.t + plotH - (pct / 100) * plotH;
              return (
                <g key={pct}>
                  <line x1={pad.l} y1={y} x2={pad.l + plotW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
                  <text x={pad.l - 4} y={y} textAnchor="end" fontSize={6} fill={DIM} dominantBaseline="middle">{pct}%</text>
                </g>
              );
            })}
            {/* Area fill */}
            <path d={areaD} fill="rgba(0,230,138,0.08)" />
            {/* Line */}
            <path d={pathD} fill="none" stroke="#00e68a" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            {/* Dots */}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={adherenceColor(p.adh)} />
            ))}
            {/* Date labels */}
            {pts.filter((_, i) => i % 3 === 0 || i === pts.length - 1).map((p, i) => {
              const day = last14.filter((_, ii) => ii % 3 === 0 || ii === last14.length - 1)[i];
              if (!day) return null;
              const d = new Date(day.date);
              return (
                <text key={i} x={p.x} y={maxH - 2} textAnchor="middle" fontSize={5} fill={DIM}>
                  {d.getDate()}/{d.getMonth() + 1}
                </text>
              );
            })}
          </svg>
        );
      })()}

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', fontSize: 7, color: DIM }}>
        <span><span style={{ color: '#22c55e', fontWeight: 700 }}>90-100%</span> — отлично</span>
        <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>70-89%</span> — хорошо</span>
        <span><span style={{ color: '#ef4444', fontWeight: 700 }}>&lt;70%</span> — требует улучшения</span>
      </div>
    </div>
  );
};

export default SupplementComplianceCard;
