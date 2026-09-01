/**
 * CombatPlanView.tsx — премиальный рендер плана единоборств.
 * Стекло, градиенты, современные карточки недель/сессий/упражнений.
 */
import React from 'react';
import type { CombatPlan } from '../../../engines/combat/combat.types';
import { getCombat } from '../../../engines/combat/combat-volume';
import { buildCombatReport } from '../../../engines/combat/combat-finalize.engine';
import { ruLabel, PHASE_RU, Badge, InfoBanner, CARD, CARD_ACCENT, BTN, BTN_PRIMARY, BTN_SMALL, INPUT, ACCENT_GRAD, TEXT_3, Highlight, SectionCard, CardHeader, StatTile, GroupHeading, Divider } from './CombatUI';
import { CB_STRICT_GROUPS, cbStrictGroupFor } from '../../../engines/combat/combat-selection';
import { buildCombatPrintHtml, downloadCombatCsv, buildCombatPlanIcs } from '../../../engines/combat/combat-print.engine';
import { weightCutNutritionForWeek, combatWeightCutToMealInput } from '../../../engines/combat/combat-weight-cut.engine';

type Props = {
  plan: CombatPlan;
  historyLen: number;
  onUndo: () => void;
  onUpdateEx: (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => void;
  onMoveEx: (wkIdx: number, day: number, exId: string, dir: -1 | 1) => void;
  onSwapEx: (wkIdx: number, day: number, exId: string, newId: string) => void;
  // годовой + экспорт (опционально прокидываются из конструктора)
  annual?: any;
  annualWeeks?: number;
  setAnnualWeeks?: (n: number) => void;
  competitionName?: string;
  setCompetitionName?: (s: string) => void;
  competitionDate?: string;
  setCompetitionDate?: (s: string) => void;
  competitionWeight?: string;
  setCompetitionWeight?: (s: string) => void;
  startDate?: string;
  outside?: any;
  outsideMetrics?: any;
  diaryLoad?: number | null;
  acwr?: { ratio: number; zone: string } | null;
  msg?: string;
  setMsg?: (s: string) => void;
  onBuildATR?: () => void;
  onAddCompetition?: () => void;
  onPrintAnnual?: () => void;
  onDownloadIcs?: () => void;
  onExportProgram?: () => void;
};

export const CombatPlanView: React.FC<Props> = ({
  plan, historyLen, onUndo, onUpdateEx, onMoveEx, onSwapEx,
  annual, annualWeeks, setAnnualWeeks, competitionName, setCompetitionName, competitionDate, setCompetitionDate, competitionWeight, setCompetitionWeight,
  startDate, outside, outsideMetrics, diaryLoad, acwr, msg, setMsg,
  onBuildATR, onAddCompetition, onPrintAnnual, onDownloadIcs, onExportProgram,
}) => {
  const [expandedWeek, setExpandedWeek] = React.useState<number | null>(0);
  const doMsg = (m: string) => { setMsg?.(m); setTimeout(() => setMsg?.(''), 2200); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Верхняя панель действий */}
      <div style={{ ...CARD, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={onUndo} disabled={historyLen === 0} style={{
            padding: '8px 12px', borderRadius: 10, fontSize: 11, fontWeight: 800, cursor: historyLen ? 'pointer' : 'default',
            background: historyLen ? 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.14))' : 'rgba(255,255,255,0.04)',
            color: historyLen ? '#d8b4fe' : 'rgba(255,255,255,0.32)', border: `1px solid ${historyLen ? 'rgba(168,85,247,0.28)' : 'rgba(255,255,255,0.06)'}`,
            backdropFilter: 'blur(8px)',
          }}>↩ Отменить {historyLen ? `(${historyLen})` : ''}</button>
          <span style={{ fontSize: 11, color: TEXT_3, fontWeight: 700 }}>История {historyLen}/10</span>
        </div>
        {msg && <span style={{ fontSize: 11, color: '#fff', background: 'rgba(168,85,247,0.14)', padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(168,85,247,0.22)' }}>{msg}</span>}
      </div>

      {/* Отчёт — Apple glass + Highlights + StatTiles */}
      <SectionCard icon="📋" title="Сводка плана" subtitle={`${plan.discipline} · ${plan.goal} · ${plan.level} · ${plan.weeks} нед`} accent>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px,1fr))', gap:8 }}>
          <StatTile label="Недель" value={String(plan.weeks)} color="#a855f7" sub={plan.patternId} icon="📅" />
          <StatTile label="Сессий" value={String(plan.weeksData.reduce((a,w)=>a+w.sessions.length,0))} color="#a855f7" sub="за цикл" icon="🗓️" />
          <StatTile label="Сетов" value={String(plan.weeksData.reduce((a,w)=>a+(w.totalSets||0),0))} color="#a855f7" sub="за цикл" icon="📊" />
          <StatTile label="Тоннаж" value={`${Math.round(plan.weeksData.reduce((a,w)=>a+((w as any).totalTonnage||0),0)/1000)}т`} color="#a855f7" sub="за цикл" icon="⚖️" />
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <Badge color="#a855f7" bg="rgba(168,85,247,0.12)" border="rgba(168,85,247,0.22)">{plan.discipline}</Badge>
          <Badge color="#a855f7" bg="rgba(168,85,247,0.12)" border="rgba(168,85,247,0.22)">{plan.goal}</Badge>
          <Badge>{plan.patternId}</Badge>
          {(plan.inputSnapshot as any)?.fightDate && <Badge color="#ef4444" bg="rgba(239,68,68,0.10)" border="rgba(239,68,68,0.18)">🏁 бой {(plan.inputSnapshot as any).fightDate}</Badge>}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {plan.weeksData.map(w=> (
            <span key={w.week} style={{ padding:'4px 8px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.06)', fontSize:11, color:'#fff', fontVariantNumeric:'tabular-nums' }}>Н{w.week} · <Highlight color={w.deload?'#f59e0b': (w as any).taper?'#60a5fa':'#a855f7'}>{w.totalSets}</Highlight> сетов</span>
          ))}
        </div>
        {plan.outsideMetrics && <InfoBanner tone={plan.outsideMetrics.interference==='high'?'warn':'info'}><Highlight color={plan.outsideMetrics.interference==='high'?'#ff9f0a':'#a855f7'}>{plan.outsideMetrics.weeklyLoad} load</Highlight> → объём <Highlight>×{plan.outsideMetrics.volumeMultiplier}</Highlight> · {plan.outsideMetrics.interference}</InfoBanner>}
        {(plan.inputSnapshot as any)?.weightCutProtocol && (
          <SectionCard icon="⚖️" title="Весогонка — питание по неделям" subtitle="ISSN 2025 · клик — скопировать в планировщик питания" accent>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {plan.weeksData.map(wk=>{
                const proto = (plan.inputSnapshot as any).weightCutProtocol;
                const bw = (plan.inputSnapshot as any).bodyweight || 80;
                const sex = (plan.inputSnapshot as any).sex || 'male';
                const nut = weightCutNutritionForWeek(wk.week, plan.weeks, proto, bw, sex);
                const meal = combatWeightCutToMealInput(wk.week, plan.weeks, proto, bw, sex);
                return (
                  <div key={wk.week} style={{ display:'flex', gap:8, alignItems:'center', background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', flexWrap:'wrap' }}>
                    <Highlight color={wk.deload?'#f59e0b': (wk as any).taper?'#60a5fa':'#a855f7'}>Нед {wk.week}</Highlight>
                    <span style={{ fontSize:11, color:'#fff' }}>{nut.kcal} ккал · P{nut.proteinG} C{nut.carbsG} · {nut.waterMl}мл · Na{nut.sodiumMg}мг</span>
                    <span style={{ fontSize:10, color:TEXT_3 }}>{nut.notes.slice(0,1).join(' ')}</span>
                    <button onClick={()=>{
                      try{
                        if(meal) { localStorage.setItem('he_combat_meal_preview', JSON.stringify({ week:wk.week, ...meal })); navigator.clipboard?.writeText(`${nut.kcal} ккал P${nut.proteinG} C${nut.carbsG} W${nut.waterMl} Na${nut.sodiumMg}`); doMsg(`Нед ${wk.week} — питание скопировано`);} 
                      }catch{}
                    }} style={{ ...BTN_SMALL, padding:'5px 10px', fontSize:11 }}>⎙ Копировать</button>
                  </div>
                );
              })}
            </div>
            <InfoBanner tone="info">Меню генерируется через `combatWeightCutToMealInput` → планировщик питания (кнопка «Копировать» сохраняет в `he_combat_meal_preview`)</InfoBanner>
          </SectionCard>
        )}
        {plan.rationale?.length ? <div style={{ fontSize:11, color:'rgba(235,235,245,0.58)', background:'rgba(0,0,0,0.14)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', lineHeight:1.45 }}>{plan.rationale.slice(0,3).map((r,i)=> <div key={i} style={{ display:'flex', gap:6 }}><span style={{ color:'#a855f7' }}>•</span><span>{r}</span></div>)}</div> : null}
        <details style={{ background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)' }}>
          <summary style={{ fontSize:11, fontWeight:700, color:'#d8b4fe', cursor:'pointer' }}>📄 Подробный отчёт (текст)</summary>
          <div style={{ fontSize:11, color:'rgba(235,235,245,0.72)', whiteSpace:'pre-wrap', marginTop:8, lineHeight:1.5 }}>{buildCombatReport(plan)}</div>
        </details>
      </SectionCard>

      {plan.validation?.warnings.map((w, i) => (
        <InfoBanner key={i} tone="warn">{w}</InfoBanner>
      ))}

      {/* Кондиция — Apple 3-системы с Highlights */}
      {(plan as any).conditioning && (
        <SectionCard icon="🏃" title="Кондиция — 3 системы" subtitle={`Вне зала ${outside?.sessionsPerWeek ?? 0}× · объём ×${outsideMetrics?.volumeMultiplier ?? 1}`} accent>
          <GroupHeading icon="⚡️" text="Alactic / Lactic / Aerobic" desc="Issurin ATR — кондиция по неделям" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(plan as any).conditioning.sessions.map((week: any[], wi: number) => (
              <div key={wi} style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.05)', display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                <Highlight color="#60a5fa">Нед {wi + 1}</Highlight><span style={{ fontWeight:700, color:'#fff' }}>{ruLabel(PHASE_RU, plan.weeksData[wi]?.phase)}</span><span style={{ color:TEXT_3 }}>·</span>
                {week.length ? week.map((s: any, si:number) => <Highlight key={si} color={s.modality==='alactic'?'#a855f7': s.modality==='lactic'?'#ef4444':'#0ea5e9'}>{`${s.modality} ${s.durationMin}′ ${s.intervals || ''}`.trim()}</Highlight>) : <span style={{ color: TEXT_3 }}>внезал покрывает</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:'rgba(235,235,245,0.60)', background:'rgba(59,130,246,0.08)', padding:'6px 10px', borderRadius:8, border:'0.5px solid rgba(59,130,246,0.14)' }}><Highlight color="#3b82f6">Alactic 8×10с</Highlight> · <Highlight color="#ef4444">Lactic 5×3′</Highlight> · <Highlight color="#0ea5e9">Aerobic 40′ Zone2</Highlight></div>
        </SectionCard>
      )}

      {/* Карта качества — Apple с Highlights */}
      <SectionCard icon="✦" title="Карта качества" subtitle="Сеты/нед vs MEV/MRV — шея/хват/core" accent>
        <CardHeader icon="✦" title="Карта качества — сеты/нед" subtitle="vs MEV/MRV · подсветка зон" accent />
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {(['neck', 'grip', 'core'] as const).map(kind => (
            <div key={kind} style={{ display: 'flex', gap: 8, alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'8px 10px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: kind === 'neck' ? '#c4b5fd' : kind === 'grip' ? '#fbbf24' : '#6ee7b7', minWidth: 48, display:'flex', alignItems:'center', gap:4 }}><span style={{ fontSize:11 }}>{kind==='neck'?'🦴': kind==='grip'?'✊':'🌀'}</span>{kind === 'neck' ? 'Шея' : kind === 'grip' ? 'Хват' : 'Core'}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                {plan.weeksData.map(wk => {
                  let sets = 0;
                  if (kind === 'neck') sets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('neck')).reduce((a, e) => a + e.sets, 0), 0);
                  if (kind === 'grip') sets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => e.id.includes('grip') || e.id.includes('pinch') || e.id.includes('wrist') || e.id.includes('farmer') || e.id.includes('towel')).reduce((a, e) => a + e.sets, 0), 0);
                  if (kind === 'core') sets = wk.sessions.reduce((s, sess) => s + sess.exercises.filter(e => ['deadbug', 'hollow_hold', 'side_plank', 'ab_wheel', 'copenhagen_plank', 'pallof_rotation_press', 'suitcase_carry', 'landmine_rotation'].includes(e.id)).reduce((a, e) => a + e.sets, 0), 0);
                  let col = '#a855f7';
                  if (kind === 'core') col = sets < 4 ? '#f59e0b' : sets <= 10 ? '#a855f7' : '#eab308';
                  else {
                    const lm = getCombat(plan.level, kind as any);
                    const st = lm ? (sets < lm.mev ? 'below' : sets <= lm.mav ? 'optimal' : sets <= lm.mrv ? 'high' : 'over') : 'optimal';
                    col = st === 'below' ? '#f59e0b' : st === 'optimal' ? '#a855f7' : st === 'high' ? '#eab308' : '#ef4444';
                  }
                  return (
                    <span key={wk.week} style={{ padding: '4px 8px', borderRadius: 10, background: col + '14', border: `0.5px solid ${col}2e`, color: col, fontSize: 10.5, fontWeight: 700, fontVariantNumeric:'tabular-nums' }}>
                      Н{wk.week} · <Highlight color={col}>{sets}</Highlight>{wk.deload ? ' · разгрузка' : (wk as any).taper ? ' · тапер' : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:TEXT_3, background:'rgba(255,255,255,0.03)', padding:'6px 10px', borderRadius:8, border:'0.5px solid rgba(255,255,255,0.06)', display:'flex', gap:6, flexWrap:'wrap' }}><Highlight color="#a855f7">Фиолетовый</Highlight> оптимум · <Highlight color="#f59e0b">янтарь</Highlight> недобор · <Highlight color="#eab308">жёлтый</Highlight> высоко · <Highlight color="#ef4444">красный</Highlight> перебор</div>
      </SectionCard>

      {diaryLoad != null && (
        <InfoBanner tone={diaryLoad > 30 ? 'warn' : 'info'}>
          Дневник: нагрузка 7д ≈ {diaryLoad} {diaryLoad > 30 ? '— высоко, рассмотрите лёгкую неделю' : '— норма'} {acwr ? `· ACWR ${acwr.ratio} · ${acwr.zone}` : ''}
        </InfoBanner>
      )}

      {/* Недели */}
      {plan.weeksData.map(wk => {
        const isOpen = expandedWeek === wk.week - 1;
        const phaseColor = (PHASE_RU as any)[wk.phase] ? (wk.deload ? '#f59e0b' : (wk as any).taper ? '#60a5fa' : '#a855f7') : '#a855f7';
        const border = wk.deload ? 'rgba(245,158,11,0.28)' : (wk as any).taper ? 'rgba(59,130,246,0.22)' : 'rgba(168,85,247,0.16)';
        return (
          <div key={wk.week} style={{ ...CARD, padding: 0, overflow: 'hidden', borderColor: border, background: isOpen ? 'linear-gradient(180deg, rgba(26,24,38,0.82), rgba(18,16,28,0.66))' : CARD.background }}>
            <button
              onClick={() => setExpandedWeek(isOpen ? null : wk.week - 1)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px', background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{
                width: 36, height: 36, borderRadius: 11, background: wk.deload ? 'linear-gradient(135deg,#f59e0b,#f97316)' : (wk as any).taper ? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : ACCENT_GRAD,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0,
                boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              }}>{wk.week}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.1, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}><Highlight color={wk.deload?'#f59e0b': (wk as any).taper?'#60a5fa':'#a855f7'}>{ruLabel(PHASE_RU, wk.phase)}</Highlight>{wk.deload ? <Highlight color="#f59e0b">разгрузка</Highlight> : (wk as any).taper ? <Highlight color="#60a5fa">тапер</Highlight> : null}<span style={{ fontWeight:400, color:TEXT_3 }}>· <Highlight>{wk.totalSets}</Highlight> сетов{(wk as any).totalTonnage ? <> · <Highlight>{((wk as any).totalTonnage / 1000).toFixed(1)}т</Highlight></> : ''}</span></div>
                <div style={{ fontSize: 11, color: TEXT_3, marginTop: 1, fontVariantNumeric:'tabular-nums' }}>Неделя {wk.week} · {wk.sessions.length} сессий · {wk.sessions.reduce((a, s) => a + s.exercises.length, 0)} упр.</div>
              </div>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: isOpen ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isOpen ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, transition: 'transform 0.18s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
            </button>

            {!isOpen && (
              <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {wk.sessions.map(s => (
                  <span key={s.day} style={{ fontSize: 10.5, padding: '4px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
                    {s.sessionTag} · {s.exercises.length}упр
                  </span>
                ))}
              </div>
            )}

            {isOpen && (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => {
                    const txt = wk.sessions.map(s => `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e => `  ${e.name} ${e.sets}x${e.reps} ${e.weight ? e.weight + 'кг' : ''} RIR${e.rir} ${e.tempo} отдых${e.restSeconds}с${e.comment ? ' // ' + e.comment : ''}`).join('\n')).join('\n\n');
                    navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n` + txt); doMsg(`Неделя ${wk.week} скопирована`);
                  }} style={{ ...BTN_SMALL, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}>⎙ Копировать неделю</button>
                </div>

                {wk.sessions.map(sess => (
                  <div key={sess.day} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 10,
                    backdropFilter: 'blur(8px)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap:'wrap', gap:6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily:'-apple-system, system-ui, sans-serif' }}>{sess.sessionTag} <span style={{ fontWeight:500, color:TEXT_3 }}>· <Highlight color={sess.character==='тяж'?'#ff9f0a': sess.character==='памп'?'#a855f7':'#60a5fa'}>{sess.character}</Highlight> · день {sess.day} · {sess.durationMin}′</span></span>
                      <span style={{ fontSize: 10, color: TEXT_3, background:'rgba(0,0,0,0.16)', padding:'3px 7px', borderRadius:20, border:'0.5px solid rgba(255,255,255,0.06)', fontVariantNumeric:'tabular-nums' }}>
                        ⏱ {Math.round(sess.exercises.reduce((a, e) => a + e.workSets.length * (e.restSeconds || 75), 0) / 60)}′ отдыха
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sess.exercises.map(ex => (
                        <div key={ex.id} style={{
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 7,
                        }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', flex: '1 1 160px', fontFamily:'-apple-system, system-ui, sans-serif' }}>
                              {ex.name} <span style={{ fontWeight: 500, color: 'rgba(235,235,245,0.62)' }}>— <Highlight color="#a855f7">{ex.sets}×{ex.reps}</Highlight>{ex.weight ? <> · <Highlight>{ex.weight}кг</Highlight></> : ''} · <Highlight>RIR{ex.rir}</Highlight></span>
                              <span style={{ fontSize: 10.5, color: TEXT_3, marginLeft: 6, fontVariantNumeric:'tabular-nums' }}>· {ex.tempo} · {ex.restSeconds}с</span>
                              {ex.comment?.includes('Тапер') && <Highlight color="#60a5fa">тапер</Highlight>}
                              {ex.comment?.includes('Весогонка') && <Highlight color="#ff9f0a">весогонка</Highlight>}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '64px 64px 64px 1fr auto', gap: 6, alignItems: 'center' }}>
                            <input aria-label="вес" type="number" value={ex.weight} onChange={e => onUpdateEx(wk.week - 1, sess.day, ex.id, { weight: Number(e.target.value) || 0 })} placeholder="вес" style={{ ...INPUT, padding: '7px 8px', fontSize: 12, textAlign: 'center' }} />
                            <input aria-label="повторы" type="text" value={ex.reps} onChange={e => onUpdateEx(wk.week - 1, sess.day, ex.id, { reps: e.target.value })} placeholder="повт" style={{ ...INPUT, padding: '7px 8px', fontSize: 12, textAlign: 'center' }} />
                            <input aria-label="RIR" type="number" min={0} max={5} value={ex.rir} onChange={e => onUpdateEx(wk.week - 1, sess.day, ex.id, { rir: Number(e.target.value) || 0 })} style={{ ...INPUT, padding: '7px 8px', fontSize: 12, textAlign: 'center' }} />
                            <select aria-label="замена" value={ex.id} onChange={e => { const v = e.target.value; if (v !== ex.id) onSwapEx(wk.week - 1, sess.day, ex.id, v); }} style={{ ...INPUT, padding: '7px 8px', fontSize: 11, background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.18)', color: '#d8b4fe' }}>
                              <option value={ex.id}>{ex.id} ✓</option>
                              {(cbStrictGroupFor(ex.id) ? CB_STRICT_GROUPS[cbStrictGroupFor(ex.id)!] : []).filter(id => id !== ex.id).map(id => <option key={id} value={id}>{id}</option>)}
                            </select>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button aria-label="вверх" onClick={() => onMoveEx(wk.week - 1, sess.day, ex.id, -1)} style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>↑</button>
                              <button aria-label="вниз" onClick={() => onMoveEx(wk.week - 1, sess.day, ex.id, 1)} style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>↓</button>
                            </div>
                          </div>

                          {ex.comment && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)', background: 'rgba(168,85,247,0.06)', borderLeft: '2px solid rgba(168,85,247,0.28)', padding: '6px 8px', borderRadius: 8 }}>{ex.comment}</div>}
                          {ex.warmupSets && ex.warmupSets.length > 0 && <div style={{ fontSize: 10.5, color: TEXT_3 }}>Разминка: {ex.warmupSets.map(s => `${s.reps}×${s.weight}кг`).join(' → ')} → рабочие</div>}
                          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.36)', fontFamily: 'ui-monospace, monospace' }}>Сеты: {ex.workSets.map(s => `${s.reps}×${s.weight ? s.weight + 'кг' : '—'} RIR${s.rir}`).join(' · ')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Годовой — Apple premium */}
      {annual && onBuildATR && (
        <SectionCard icon="🗓️" title={`Годовой ATR · ${annual.totalWeeks} нед`} subtitle={`${annual.blocks.length} блоков · синхронизация`} accent>
          <CardHeader icon="🗓️" title={`Годовой · ${annual.totalWeeks} нед · ${annual.blocks.length} блоков`} subtitle={`${annual.discipline ? `${annual.discipline} · ` : ''}тапер строится автоматически`} accent />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems:'center' }}>
            <button onClick={onBuildATR} style={{ ...BTN_SMALL, background: 'rgba(168,85,247,0.14)', color: '#d8b4fe', border: '0.5px solid rgba(168,85,247,0.24)' }}>↻ Построить {annualWeeks} нед</button>
            {setAnnualWeeks && (
              <select value={annualWeeks} onChange={e => setAnnualWeeks(Number(e.target.value))} style={{ ...INPUT, width: 100, padding: '7px 8px', fontSize: 12, fontVariantNumeric:'tabular-nums' }}>
                <option value={12}>12 нед</option><option value={24}>24 нед</option><option value={36}>36 нед</option><option value={52}>52 нед</option>
              </select>
            )}
            <Badge color="#a855f7" bg="rgba(168,85,247,0.10)" border="rgba(168,85,247,0.18)">{annual.totalWeeks} нед</Badge>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {annual.blocks.map((b: any) => {
              const col = b.phase === 'accumulation' ? '#60a5fa' : b.phase === 'transmutation' ? '#a855f7' : b.phase === 'realization' ? '#ff3b30' : '#f59e0b';
              return <span key={b.id} style={{ padding:'5px 8px', borderRadius:10, fontSize:10.5, fontWeight:700, background:`${col}12`, border:`0.5px solid ${col}22`, color:col, fontVariantNumeric:'tabular-nums' }}><Highlight color={col}>Нед {b.startWeek}-{b.startWeek + b.weeks - 1}</Highlight> · {ruLabel(PHASE_RU, b.phase)} · <Highlight color={col}>{b.weeks}нед</Highlight>{b.fightDate ? ' 🏁' : ''}</span>;
            })}
          </div>

          <div style={{ display: 'flex', height: 16, borderRadius: 10, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.18)' }}>
            {annual.blocks.map((b: any) => {
              const w = (b.weeks / annual.totalWeeks * 100).toFixed(2);
              const col = b.phase === 'accumulation' ? '#3b82f6' : b.phase === 'transmutation' ? '#a855f7' : b.phase === 'realization' ? '#ff3b30' : '#f59e0b';
              return <div key={b.id} title={`${b.phase} ${b.weeks}нед`} style={{ width: `${w}%`, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700, fontVariantNumeric:'tabular-nums' }}>{b.weeks}</div>;
            })}
          </div>
          <div style={{ fontSize: 9, color: TEXT_3, display: 'flex', justifyContent: 'space-between', fontVariantNumeric:'tabular-nums' }}><span>Нед 1 · {startDate}</span><span>Нед {annual.totalWeeks}</span></div>

          {annual.competitions?.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '0.5px solid rgba(239,68,68,0.14)', borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', display:'flex', alignItems:'center', gap:6 }}>🏁 Бои <Highlight color="#ff3b30">{annual.competitions.length}</Highlight></div>
              {annual.competitions.map((c: any) => <div key={c.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop:4 }}><Highlight color="#ff3b30">🏁 {c.name}</Highlight> — {c.date} {c.weightClass ? <Highlight>{c.weightClass}</Highlight> : ''}</div>)}
            </div>
          )}

          {setCompetitionName && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Название боя" value={competitionName} onChange={e => setCompetitionName(e.target.value)} style={{ ...INPUT, flex: 1, minWidth: 140, padding: '8px 10px', fontSize: 11 }} />
              <input type="date" value={competitionDate} onChange={e => setCompetitionDate!(e.target.value)} style={{ ...INPUT, width: 150, padding: '8px 10px', fontSize: 11 }} />
              <input placeholder="Вес.кат." value={competitionWeight} onChange={e => setCompetitionWeight!(e.target.value)} style={{ ...INPUT, width: 110, padding: '8px 10px', fontSize: 11 }} />
              <button onClick={onAddCompetition} style={{ ...BTN_SMALL, background: '#ef4444', color: '#fff', border: 'none' }}>+ Бой</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={onPrintAnnual} style={{ ...BTN_SMALL, background: 'rgba(255,255,255,0.06)', color: '#fff', border:'0.5px solid rgba(255,255,255,0.08)' }}>🖨 Печать года</button>
            <button onClick={onDownloadIcs} style={{ ...BTN_SMALL, background: 'rgba(255,255,255,0.06)', color: '#fff', border:'0.5px solid rgba(255,255,255,0.08)' }}>📅 .ics</button>
          </div>
        </SectionCard>
      )}

      {/* Экспорт — Apple glass */}
      <SectionCard icon="📤" title="Экспорт и шаринг" subtitle="Печать · CSV · ICS · в программу">
        <GroupHeading icon="⎙" text="Копировать и печать" desc="Быстрый обмен" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8 }}>
          <button onClick={() => { const txt = buildCombatReport(plan); navigator.clipboard?.writeText(txt); doMsg('Скопировано'); }} style={BTN}>⎙ Копировать</button>
          <button onClick={() => { const html = buildCombatPrintHtml(plan); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); } else { navigator.clipboard?.writeText(html); doMsg('HTML скопирован'); } }} style={BTN}>🖨 Печать</button>
          <button onClick={onExportProgram} style={BTN_PRIMARY}>✦ В программу</button>
        </div>
        <Divider />
        <GroupHeading icon="📊" text="Файлы" desc="CSV для Excel · ICS для календаря" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8 }}>
          <button onClick={() => { downloadCombatCsv(plan); doMsg('CSV скачан'); }} style={BTN}>📊 CSV</button>
          <button onClick={() => { const ics = buildCombatPlanIcs(plan, startDate || null); const blob = new Blob([ics], { type: 'text/calendar' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `combat-plan-${plan.discipline}-${plan.weeks}w.ics`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); doMsg('ICS скачан'); }} style={BTN}>📅 План .ics</button>
        </div>
        <div style={{ fontSize:11, color:TEXT_3, background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', display:'flex', gap:6, flexWrap:'wrap' }}><Highlight>Экспорт</Highlight> — библиотека программ · печать · ICS · CSV</div>
      </SectionCard>
    </div>
  );
};
