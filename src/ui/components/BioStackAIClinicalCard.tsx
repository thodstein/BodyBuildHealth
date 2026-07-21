// BioStackAIClinicalCard.tsx — клинический вердикт selectStack: карточка врачебного уровня
import React, { useMemo } from 'react';
import type { SelectStackResult } from '../../engines/biostack-clinical-v2.engine';
import { findMeaningfulReplacement, type MeaningfulReplacement } from '../../engines/biostack-clinical-v2.engine';
import type { BioStackProfile } from '../../engines/biostack-ai.engine';
import { GlassCard } from './BioStackAIConstants';

type AnyRes = SelectStackResult & Record<string, any>;

const nm = (x: any, nameOf?: (id: string) => string): string => {
  if (!x) return '';
  return x.substanceName || x.name || (nameOf && (x.substanceId || x.id) ? nameOf(x.substanceId || x.id) : '') || x.substanceId || x.id || '';
};

const timeLabel = (t: string): string =>
  t === 'morning' ? 'Утро' : t === 'afternoon' ? 'День' : t === 'evening' ? 'Вечер' : t === 'night' ? 'Ночь' : t;

/* ─── Severity badge ─── */
function SevBadge({ s }: { s: string }) {
  if (s === 'HIGH') return <span style={{ padding:'2px 6px',borderRadius:4,fontSize:9,fontWeight:700,background:'rgba(239,68,68,0.12)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.2)' }}>КРИТ</span>;
  if (s === 'MEDIUM') return <span style={{ padding:'2px 6px',borderRadius:4,fontSize:9,fontWeight:700,background:'rgba(245,158,11,0.1)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.18)' }}>СРЕД</span>;
  return <span style={{ padding:'2px 6px',borderRadius:4,fontSize:9,fontWeight:600,background:'rgba(148,163,184,0.08)',color:'#94a3b8',border:'1px solid rgba(148,163,184,0.12)' }}>НИЗ</span>;
}

/* ─── Mini stat card ─── */
function MiniStat({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ padding:'10px 14px',borderRadius:10,background:'rgba(24,24,27,0.5)',border:'1px solid rgba(255,255,255,0.05)',textAlign:'center',minWidth:70 }}>
      <div style={{ fontSize:22,fontWeight:800,color,lineHeight:1.1 }}>{value}</div>
      <div style={{ fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:8,color:'rgba(255,255,255,0.3)',marginTop:1 }}>{sub}</div>}
    </div>
  );
}

/* ─── Block wrapper ─── */
function Blk({ icon, title, color, bgColor, borderColor, children }: {
  icon: string; title: string; color: string; bgColor: string; borderColor: string; children: React.ReactNode;
}) {
  return (
    <div style={{ padding:'12px 14px',borderRadius:12,marginBottom:8,background:bgColor,border:`1px solid ${borderColor}` }}>
      <div style={{ fontSize:13,fontWeight:700,color,marginBottom:6,display:'flex',alignItems:'center',gap:6 }}>
        <span style={{ fontSize:16 }}>{icon}</span>{title}
      </div>
      {children}
    </div>
  );
}

export const ClinicalResultCard: React.FC<{
  result: SelectStackResult;
  nameOf?: (id: string) => string;
  onClearStops?: () => void;
  profile?: BioStackProfile;
  onReplace?: (originalId: string, replacementId: string) => void;
}> = ({ result, nameOf, onClearStops, profile, onReplace }) => {
  const r = result as AnyRes;
  const hardCount = r.hardStops?.length ?? 0;
  const exclCount = r.drugExclusions?.length ?? 0;
  const ulCount = r.ulWarnings?.length ?? 0;
  const labCount = r.labAdjustments?.length ?? 0;
  const titCount = r.drugTitrations?.length ?? 0;
  const redCount = r.redundancy?.length ?? 0;
  const hasStop = hardCount > 0 || exclCount > 0;
  const totalIssues = hardCount + exclCount + ulCount + labCount + titCount + redCount;

  // ── Safety index 0-100 ──
  const safetyIndex = totalIssues === 0 ? 100
    : Math.max(0, 100 - hardCount * 25 - exclCount * 15 - ulCount * 8 - titCount * 5 - redCount * 3);

  const safetyColor = safetyIndex >= 80 ? '#22c55e' : safetyIndex >= 50 ? '#f59e0b' : '#ef4444';
  const safetyLabel = safetyIndex >= 80 ? 'БЕЗОПАСНО' : safetyIndex >= 50 ? 'ВНИМАНИЕ' : 'ОПАСНО';

  // ── Аналоги для стоп-позиций ──
  const stopIds = useMemo(() => [
    ...(r.hardStops || []).map((h: any) => h.substanceId || h.id),
    ...(r.drugExclusions || []).map((e: any) => e.substanceId || e.id),
  ].filter(Boolean), [r]);
  const replacements = useMemo(() => {
    if (!profile) return {} as Record<string, MeaningfulReplacement>;
    const out: Record<string, MeaningfulReplacement> = {};
    for (const id of stopIds) {
      try {
        const rep = findMeaningfulReplacement(id, profile, stopIds);
        if (rep) out[id] = rep;
      } catch { /* no analog */ }
    }
    return out;
  }, [stopIds, profile]);

  const replaceBtn = (origId: string) => {
    const rep = replacements[origId];
    if (!rep || !onReplace) return null;

    // Extract therapeutic class from reason
    const classMatch = rep.reason?.match(/Терапевтический класс: ([^—]+)/);
    const classLabel = classMatch ? classMatch[1].trim() : '';

    // Фармакокинетические данные
    const formInfo: string[] = [];
    if (rep.form) formInfo.push(rep.form);
    if (rep.doseMg) formInfo.push(`${rep.doseMg} мг`);
    if (rep.timing) formInfo.push(rep.timing);

    const equivColor = rep.clinicalEquivalence === 'high' ? '#22c55e'
                     : rep.clinicalEquivalence === 'moderate' ? '#f59e0b'
                     : rep.clinicalEquivalence === 'low' ? '#ef4444'
                     : '#94a3b8';
    const equivLabel = rep.clinicalEquivalence === 'high' ? '✅ Высокая'
                     : rep.clinicalEquivalence === 'moderate' ? '⚠ Умеренная'
                     : rep.clinicalEquivalence === 'low' ? '⛔ Низкая'
                     : '';

    return (
      <div style={{ marginTop:6 }}>
        <button onClick={() => onReplace(origId, rep.replacementId)} style={{
          padding:'7px 14px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:700,
          background:'rgba(0,230,138,0.12)',border:'1px solid rgba(0,230,138,0.3)',color:'#00e68a',
        }}>🔄 Заменить на {rep.replacementName}{rep.gradeUpgrade ? ' ⬆' : ''}</button>

        {classLabel && (
          <div style={{ fontSize:9,color:'#00e68a',marginTop:3,padding:'2px 6px',borderRadius:4,background:'rgba(0,230,138,0.1)',display:'inline-block',fontWeight:600 }}>
            💊 {classLabel}
          </div>
        )}
        {formInfo.length > 0 && (
          <div style={{ fontSize:9,color:'#60a5fa',marginTop:3,padding:'2px 6px',borderRadius:4,background:'rgba(96,165,250,0.1)',display:'inline-block',marginLeft:4,fontWeight:500 }}>
            📋 {formInfo.join(' · ')}
          </div>
        )}
        {equivLabel && (
          <div style={{ fontSize:9,color:equivColor,marginTop:3,padding:'2px 6px',borderRadius:4,background:`${equivColor}15`,display:'inline-block',marginLeft:4,fontWeight:600 }}>
            {equivLabel} эквивалентность
          </div>
        )}

        {rep.doseWarning && (
          <div style={{ fontSize:10,color:'#f87171',marginTop:4,lineHeight:1.3,padding:'4px 6px',background:'rgba(239,68,68,0.08)',borderRadius:4,border:'1px solid rgba(239,68,68,0.2)' }}>
            {rep.doseWarning}
            {rep.recommendedDoseMg && ` Рекомендуется: ${rep.recommendedDoseMg} мг.`}
          </div>
        )}

        {rep.clinicalNote && (
          <div style={{ fontSize:10,color:'#fbbf24',marginTop:4,lineHeight:1.3,padding:'4px 6px',background:'rgba(251,191,36,0.06)',borderRadius:4,border:'1px solid rgba(251,191,36,0.15)' }}>
            ⚠️ {rep.clinicalNote}
          </div>
        )}

        <div style={{ fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:3,lineHeight:1.3 }}>{rep.reason} · {rep.safetyNote}</div>
      </div>
    );
  };

  return (
    <GlassCard title="🩺 Клинический контроль стека" icon="🩺" color={safetyColor} style={{ marginBottom:6 }}>
      {/* ── Safety index header ── */}
      <div style={{
        display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:14,marginBottom:10,
        background: hasStop ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.06)',
        border:`1px solid ${hasStop ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)'}`,
      }}>
        <div style={{
          width:56,height:56,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
          background: `conic-gradient(${safetyColor} ${safetyIndex}%, rgba(255,255,255,0.06) ${safetyIndex}%)`,
        }}>
          <div style={{ width:44,height:44,borderRadius:'50%',background:'#18181b',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <span style={{ fontSize:16,fontWeight:800,color:safetyColor }}>{safetyIndex}</span>
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16,fontWeight:800,color:safetyColor,textTransform:'uppercase',letterSpacing:1 }}>{safetyLabel}</div>
          <div style={{ fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2 }}>
            {totalIssues === 0
              ? 'Клинических замечаний нет — стек допустим к приёму'
              : `${totalIssues} замечаний: ${hardCount} крит., ${exclCount} лекарств., ${ulCount} доз., ${labCount} лаб., ${titCount} титрац., ${redCount} дублей`}
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:8 }}>
        <MiniStat label="Стоп" value={hardCount} color={hardCount>0?'#ef4444':'#94a3b8'} sub="противопоказания" />
        <MiniStat label="ЛС конф." value={exclCount} color={exclCount>0?'#f59e0b':'#94a3b8'} sub="исключения" />
        <MiniStat label="UL" value={ulCount} color={ulCount>0?'#f59e0b':'#94a3b8'} sub="верхний предел" />
        <MiniStat label="Лаб." value={labCount} color={labCount>0?'#60a5fa':'#94a3b8'} sub="коррекции" />
        <MiniStat label="Титр." value={titCount} color={titCount>0?'#f59e0b':'#94a3b8'} sub="подбор доз" />
      </div>

      {/* ── Hard stops ── */}
      {hardCount > 0 && (
        <Blk icon="🛑" title="Абсолютные противопоказания — НЕЛЬЗЯ принимать" color="#ef4444"
          bgColor="rgba(239,68,68,0.06)" borderColor="rgba(239,68,68,0.18)">
          {r.hardStops.map((h: any, i: number) => (
            <div key={i} style={{
              padding:'8px 12px',borderRadius:10,marginBottom:4,
              background:'rgba(239,68,68,0.04)',border:'1px solid rgba(239,68,68,0.08)',
            }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                <span style={{ fontSize:14,fontWeight:800,color:'#f87171' }}>{nm(h, nameOf)}</span>
                <SevBadge s={h.severity || 'HIGH'} />
              </div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.55)',lineHeight:1.4 }}>
                {h.reason}
                {(h.source && <span style={{ fontSize:9,opacity:0.5,marginLeft:6 }}>· источник: {h.source}</span>)}
              </div>
              {replaceBtn(h.substanceId || h.id)}
            </div>
          ))}
        </Blk>
      )}

      {/* ── Drug exclusions ── */}
      {exclCount > 0 && (
        <Blk icon="💊" title="Лекарственные конфликты — исключены из стека" color="#f59e0b"
          bgColor="rgba(245,158,11,0.05)" borderColor="rgba(245,158,11,0.15)">
          {r.drugExclusions.map((e: any, i: number) => (
            <div key={i} style={{
              padding:'8px 12px',borderRadius:10,marginBottom:4,
              background:'rgba(245,158,11,0.03)',border:'1px solid rgba(245,158,11,0.06)',
            }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                <span style={{ fontSize:13,fontWeight:700,color:'#fbbf24' }}>{nm(e, nameOf)}</span>
                <SevBadge s={e.severity || 'MEDIUM'} />
                {e.drug && <span style={{ fontSize:9,padding:'2px 6px',borderRadius:4,background:'rgba(245,158,11,0.1)',color:'#f59e0b' }}>+ {e.drug}</span>}
              </div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.5)',lineHeight:1.35 }}>
                {e.effect || e.reason}
                {e.mechanism && <span style={{ fontSize:9,opacity:0.5,marginLeft:6 }}>· {e.mechanism}</span>}
              </div>
              {replaceBtn(e.substanceId || e.id)}
            </div>
          ))}
        </Blk>
      )}

      {/* ── UL warnings ── */}
      {ulCount > 0 && (
        <Blk icon="⚠️" title="Превышение верхних допустимых доз (UL)" color="#f59e0b"
          bgColor="rgba(245,158,11,0.04)" borderColor="rgba(245,158,11,0.12)">
          {r.ulWarnings.map((u: any, i: number) => (
            <div key={i} style={{ padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}>
                <span style={{ fontSize:12,fontWeight:700,color:'#fff' }}>{nm(u, nameOf)}</span>
                <SevBadge s={u.severity || 'MEDIUM'} />
              </div>
              <div style={{ display:'flex',gap:8,alignItems:'center',marginBottom:3 }}>
                <div style={{
                  flex:1,height:8,borderRadius:4,overflow:'hidden',background:'rgba(255,255,255,0.06)',
                }}>
                  <div style={{
                    height:'100%',borderRadius:4,
                    width:`${Math.min(100,u.percentUL || 0)}%`,
                    background: (u.percentUL||0) > 100 ? '#ef4444' : (u.percentUL||0) > 80 ? '#f59e0b' : '#22c55e',
                    transition:'width 0.5s',
                  }} />
                </div>
                <span style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.6)',whiteSpace:'nowrap' }}>
                  {u.totalDose} / {u.ul} мг · {Math.round(u.percentUL || 0)}%
                </span>
              </div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)',lineHeight:1.3 }}>{u.message}</div>
            </div>
          ))}
        </Blk>
      )}

      {/* ── Lab adjustments ── */}
      {labCount > 0 && (
        <Blk icon="🩸" title="Коррекция доз по лабораторным данным" color="#60a5fa"
          bgColor="rgba(96,165,250,0.05)" borderColor="rgba(96,165,250,0.12)">
          {r.labAdjustments.map((a: any, i: number) => (
            <div key={i} style={{ padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize:12,fontWeight:700,color:'#fff',marginBottom:2 }}>{nm(a, nameOf)}</div>
              <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11 }}>
                <span style={{ color:'rgba(255,255,255,0.45)' }}>{a.originalDose}</span>
                <span style={{ color:'#60a5fa' }}>→</span>
                <span style={{ fontWeight:700,color:'#60a5fa' }}>{a.adjustedDose}</span>
                <span style={{
                  padding:'2px 6px',borderRadius:4,fontSize:8,fontWeight:600,
                  background:'rgba(96,165,250,0.1)',color:'#60a5fa',
                }}>{a.marker || 'лаб.'}</span>
              </div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:2 }}>{a.reason}</div>
            </div>
          ))}
        </Blk>
      )}

      {/* ── Drug titrations ── */}
      {titCount > 0 && (
        <Blk icon="🔧" title="Требуется титрация дозы (остаются в стеке)" color="#fbbf24"
          bgColor="rgba(251,191,36,0.05)" borderColor="rgba(251,191,36,0.12)">
          {r.drugTitrations.map((t: any, i: number) => (
            <div key={i} style={{ padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                <span style={{ fontSize:12,fontWeight:700,color:'#fbbf24' }}>{nm(t, nameOf)}</span>
                {t.drug && <span style={{ fontSize:9,padding:'2px 6px',borderRadius:4,background:'rgba(251,191,36,0.1)',color:'#fbbf24' }}>+ {t.drug}</span>}
              </div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.5)',lineHeight:1.3,marginBottom:2 }}>{t.effect || t.reason}</div>
              {t.recommendation && (
                <div style={{ fontSize:10,color:'#fbbf24',lineHeight:1.3,padding:'4px 8px',borderRadius:6,background:'rgba(251,191,36,0.06)' }}>
                  💡 {t.recommendation}
                </div>
              )}
            </div>
          ))}
        </Blk>
      )}

      {/* ── Redundancy ── */}
      {redCount > 0 && (
        <Blk icon="🔁" title="Избыточное дублирование путей" color="#a78bfa"
          bgColor="rgba(167,139,250,0.04)" borderColor="rgba(167,139,250,0.1)">
          {r.redundancy.map((rd: any, i: number) => (
            <div key={i} style={{ padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize:11,fontWeight:600,color:'#c4b5fd',marginBottom:2 }}>
                {rd.names?.join(' + ') || rd.pathway}
              </div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)' }}>{rd.message}</div>
            </div>
          ))}
        </Blk>
      )}

      {/* ── Schedule ── */}
      {(r.schedule?.length ?? 0) > 0 && (
        <Blk icon="⏰" title="Расписание приёма (сводка)" color="#22c55e"
          bgColor="rgba(34,197,94,0.04)" borderColor="rgba(34,197,94,0.1)">
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6 }}>
            {r.schedule.map((s: any, i: number) => (
              <div key={i} style={{
                padding:'10px 12px',borderRadius:10,
                background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.15)',
              }}>
                <div style={{ fontSize:10,fontWeight:700,color:'#22c55e',marginBottom:3 }}>{timeLabel(s.time)}</div>
                <div style={{ fontSize:10,color:'rgba(255,255,255,0.7)',lineHeight:1.4 }}>
                  {(s.names || (s.ids || []).map((id: string) => nm({ substanceId: id }, nameOf))).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </Blk>
      )}

      {/* ── Cycling ── */}
      {(r.cycling?.length ?? 0) > 0 && (
        <Blk icon="🔄" title="Режим циклирования" color="#ec4899"
          bgColor="rgba(236,72,153,0.04)" borderColor="rgba(236,72,153,0.1)">
          {r.cycling.map((c: any, i: number) => (
            <div key={i} style={{ padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize:12,fontWeight:700,color:'#f472b6',marginBottom:2 }}>
                {nm(c, nameOf)} · {c.durationWeeks} нед.
              </div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.45)' }}>{c.cycleNote}</div>
            </div>
          ))}
        </Blk>
      )}

      {hasStop && onClearStops && (
        <button onClick={onClearStops} style={{
          marginTop:6,width:'100%',minHeight:44,padding:'10px 0',borderRadius:10,cursor:'pointer',
          fontSize:12,fontWeight:700,
          background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.25)',color:'#ef4444',
        }}>🗑 Исключить все стоп-позиции из стека</button>
      )}
    </GlassCard>
  );
};
