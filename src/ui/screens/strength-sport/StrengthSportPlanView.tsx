/**
 * StrengthSportPlanView.tsx — шаг «План» конструктора ТА/стронг (вынесен из StrengthSportConstructor для декомпозиции).
 * Презентационный слой: сводка, гант, попытки, контест, кондиция, heatmap, medley, недели, годовой, экспорты.
 * Логика (сборка, правки, годовые пересборки) — колбэки из конструктора; движки не тронуты.
 */
import React from 'react';
import type { StrengthSportPlan } from '../../../engines/strength-sport/strength-sport.types';
import type { OutsideLoad } from '../../../engines/outside-load.engine';
import { buildStrengthSportReport } from '../../../engines/strength-sport/strength-sport-finalize.engine';
import { buildStrengthCsv, downloadStrengthCsv, downloadStrengthXlsx, buildStrengthPrintHtml, shareStrengthDigest, downloadStrengthIcs } from '../../../engines/strength-sport/strength-sport-export';
import { buildWLMeetPlan, wlAttemptRationale } from '../../../engines/strength-sport/strength-sport-attempts.engine';
import { estimate1RMFromVelocitySS } from '../../../engines/strength-sport/strength-sport-vbt.engine';
import { buildSMEventPlan, smEventRationale } from '../../../engines/strength-sport/strength-sport-strongman-attempts.engine';
import { EVENT_META } from '../../../engines/strength-sport/strength-sport-event-types';
import { TAPER_CESSATION_DAYS } from '../../../engines/strength-sport/strength-sport-taper.engine';
import { buildConditioningRationale } from '../../../engines/strength-sport/strength-sport-conditioning';
import { moveAnnualBlock } from '../../../engines/strength-sport/strength-sport-annual';
import { CARD, BTN, BTN_PRIMARY, BTN_SMALL, INPUT, TEXT_2, TEXT_3, ACCENT, ACCENT_STRONG, ACCENT_SOFT, STRONG_SOFT, ACCENT_BORDER, STRONG_BORDER, ACCENT_GRAD, SectionCard, StatTile, Badge, InfoBanner, GroupHeading, CardHeader, Highlight, HighlightStrong, ChipToggle, Divider } from './StrengthUI';
import { StrengthGantt, StrengthHeatmap, EventCard } from './StrengthUI';
import { MODE_RU, LEVEL_RU, PHASE_RU, ruLabel } from './StrengthUI';

void buildStrengthCsv;

type Props = {
  plan: StrengthSportPlan;
  mode: 'weightlifting' | 'strongman' | 'hybrid';
  modeColor: string;
  days: number;
  bodyweight: number;
  sex: 'male' | 'female';
  outside: OutsideLoad | null;
  outsideMetrics: { volumeMultiplier: number } | null;
  vbtMap: Record<string, number>;
  onVbtMap: (k: string, v: number) => void;
  expandedWeek: number | null;
  onToggleWeek: (w: number | null) => void;
  onUpdateEx: (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => void;
  onUpdateSet: (wkIdx: number, day: number, exId: string, setIdx: number, patch: Partial<{ weight: number; reps: number; rir: number; distanceM: number; timeCapS: number }>) => void;
  onMoveEx: (wkIdx: number, day: number, exId: string, dir: -1 | 1) => void;
  onMedleyChange: (id: string, patch: { distanceM?: number; timeCapS?: number }) => void;
  annual: any;
  onAnnualChange: (ann: any) => void;
  annualCycleSel: string[] | null;
  onAnnualCycleSel: React.Dispatch<React.SetStateAction<string[] | null>>;
  rankedCycles: { cycle: { meta: { id: string; title: string } }; blocked?: string }[];
  msg?: string;
  setMsg: (s: string) => void;
  onExportProgram: () => void;
  onBuildSeason: () => void;
  onBuildAnnualFromCycles: () => void;
};

export const StrengthSportPlanView: React.FC<Props> = ({
  plan, mode, modeColor, days, bodyweight, sex, outside, outsideMetrics,
  vbtMap, onVbtMap, expandedWeek, onToggleWeek, onUpdateEx, onUpdateSet, onMoveEx, onMedleyChange,
  annual, onAnnualChange, annualCycleSel, onAnnualCycleSel, rankedCycles,
  msg, setMsg, onExportProgram, onBuildSeason, onBuildAnnualFromCycles,
}) => {
  const doMsg = (m: string, ms = 1800) => { setMsg?.(m); setTimeout(() => setMsg?.(''), ms); };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Сводка — Apple glass + Highlights + StatTiles */}
      <SectionCard icon="📋" title="Сводка плана" subtitle={`${ruLabel(MODE_RU, plan.mode)} · ${ruLabel(PHASE_RU, plan.weeksData[0]?.phase || 'accumulation')} · ${plan.weeks} нед`} accent>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px,1fr))', gap:10 }}>
          <StatTile label="Недель" value={String(plan.weeks)} color={modeColor} sub={plan.patternId} icon="📅" />
          <StatTile label="Дней/нед" value={`${days}×`} color={modeColor} sub={ruLabel(LEVEL_RU, plan.level)} icon="🗓️" />
          <StatTile label="Сетов" value={String(plan.weeksData.reduce((a,w)=>a+(w.totalSets||0),0))} color={modeColor} sub="за цикл" icon="📊" />
          <StatTile label="Тоннаж" value={`${Math.round(plan.weeksData.reduce((a,w)=>a+(w.totalTonnage||0),0)/1000)}т`} color={modeColor} sub="за цикл" icon="⚖️" />
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}22`}>{ruLabel(MODE_RU, plan.mode)}</Badge>
          <Badge color={modeColor} bg={`${modeColor}12`} border={`${modeColor}22`}>{ruLabel(PHASE_RU, plan.weeksData[0]?.phase || '')}</Badge>
          <Badge>{plan.patternId}</Badge>
          {plan.inputSnapshot?.focus && <Badge color={mode==='strongman'?ACCENT_STRONG:ACCENT} bg={mode==='strongman'?STRONG_SOFT:ACCENT_SOFT} border={mode==='strongman'?STRONG_BORDER:ACCENT_BORDER}>Фокус {plan.inputSnapshot.focus}</Badge>}
        </div>
        <div style={{ display:'flex', gap:6, overflowX:'auto' as const, scrollbarWidth:'none' as const, WebkitOverflowScrolling:'touch' as const, paddingBottom:2 }}>
          {plan.weeksData.map(w=> (
            <span key={w.week} style={{ flexShrink:0, padding:'6px 10px', borderRadius:12, background:'rgba(255,255,255,0.045)', border:'0.5px solid rgba(255,255,255,0.07)', fontSize:12, fontWeight:600, color:'#fff', fontFamily:'-apple-system, system-ui, sans-serif', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>Н{w.week} · <Highlight color={w.deload?'#f59e0b': (w as any).taper?'#60a5fa':modeColor}>{w.totalSets}</Highlight> · <Highlight>{Math.round((w.totalTonnage||0)/1000)}т</Highlight></span>
          ))}
        </div>
        {/* Sinclair / DOTS блок */}
        {(() => {
          const bw = (plan.inputSnapshot as any)?.bodyweight as number | undefined;
          if (!bw || !plan.workMax) return null;
          const wm: any = plan.workMax || {};
          let total = 0;
          if (plan.mode === 'weightlifting') total = (wm.snatch||0)+(wm.cleanJerk||wm.clean||0);
          else if (plan.mode === 'strongman') total = (wm.deadlift||0)+(wm.logPress||wm.overheadPress||0)+(wm.backSquat||0);
          else total = (wm.snatch||0)+(wm.cleanJerk||0)+(wm.backSquat||0);
          if (!total) return null;
          const reportLines = buildStrengthSportReport(plan).split('\n');
          const sinLine = reportLines.find(l=> l.includes('Sinclair') || l.includes('DOTS'));
          return sinLine ? <div style={{ fontSize:13, color:'#fff', background:'rgba(255,255,255,0.035)', padding:'12px 14px', borderRadius:14, border:'0.5px solid rgba(255,255,255,0.07)', lineHeight:1.5 }}>{sinLine.split('·').map((p,i)=> <span key={i} style={{ marginRight:6 }}>{p.trim().split(' ').map((w,j)=> /[0-9]/.test(w) ? <Highlight key={j} color={modeColor}>{w}</Highlight> : w+' ').reduce((a,c)=> <>{a} {c}</> as any, null as any)}</span>)}</div> : null;
        })()}
        {plan.outsideMetrics && <InfoBanner tone={plan.outsideMetrics.interference==='high'?'warn':'info'}><Highlight color={plan.outsideMetrics.interference==='high'?'#ff9f0a':'#30d158'}>{plan.outsideMetrics.weeklyLoad} load</Highlight> → объём <Highlight>×{plan.outsideMetrics.volumeMultiplier}</Highlight> · {plan.outsideMetrics.interference}</InfoBanner>}
        {plan.rationale?.length ? <div style={{ fontSize:13, color:'#fff', background:'rgba(0,0,0,0.16)', padding:'12px 14px', borderRadius:14, border:'0.5px solid rgba(255,255,255,0.07)', lineHeight:1.55 }}>{plan.rationale.slice(0,3).map((r,i)=> <div key={i} style={{ display:'flex', gap:8 }}><span style={{ color:modeColor }}>•</span><span>{r}</span></div>)}</div> : null}
      </SectionCard>

      <SectionCard icon="🗓️" title="Gantt фаз" subtitle="Накопление · интенсификация · пик · taper 1-2нед перед стартом" collapsible defaultOpen={false} summary={`${plan.weeks} нед · ${plan.weeksData.length} блоков`}>
        <StrengthGantt weeks={plan.weeksData} totalWeeks={plan.weeks} />
        <div style={{ fontSize:12, color: TEXT_3, background:'rgba(255,255,255,0.035)', padding:'10px 12px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.05)', lineHeight:1.5 }}>Тапер <span style={{ color:'#30D158', fontWeight:700 }}>зелёный</span> 1-2нед (объём ×0.45/0.65) выносится отдельной фазой в Gantt — как в annual-training taperWeeksForBlock</div>
      </SectionCard>

      {plan.mode === 'weightlifting' && (plan.workMax.snatch || 0) > 0 && (plan.workMax.cleanJerk || (plan.workMax as any).clean || 0) > 0 && (() => {
        const meet = buildWLMeetPlan(plan.workMax.snatch as number, (plan.workMax.cleanJerk || (plan.workMax as any).clean) as number, 'balanced', { bodyweight, sex });
        return meet ? (
          <div data-ss="attempts"><SectionCard icon="🏋️" title="Попытки ТА · IWF 1кг" subtitle={`Тотал ${meet.total}кг`} accent collapsible defaultOpen={false} summary={`Тотал ${meet.total}кг · 92/97/102%`}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Badge color="#0a84ff" bg="rgba(10,132,255,0.12)" border="rgba(10,132,255,0.22)">Тотал <Highlight color="#0a84ff">{meet.total}кг</Highlight></Badge>
              {meet.sinclair && <Badge color="#30d158" bg="rgba(48,209,88,0.10)" border="rgba(48,209,88,0.18)">Sinclair <Highlight color="#30d158">{meet.sinclair}</Highlight></Badge>}
              {(meet as any).robi && <Badge color="#a855f7" bg="rgba(168,85,247,0.10)" border="rgba(168,85,247,0.18)">Robi <Highlight color="#a855f7">{(meet as any).robi}</Highlight></Badge>}
              <Badge>кат. {(() => { try{ const c=(plan.inputSnapshot as any)?.bodyweight; return c? c+'кг':'' }catch{return ''} })()}</Badge>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ background:'rgba(255,255,255,0.035)', padding:'14px 16px', borderRadius:16, border:'0.5px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>⚡️ Рывок <Badge color="#0a84ff" bg="rgba(10,132,255,0.12)" border="rgba(10,132,255,0.22)">{meet.total? Math.round(meet.snatch.opener/meet.total*100)+'%' : ''}</Badge></div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:15, fontVariantNumeric:'tabular-nums' }}><Highlight color="#30d158">{meet.snatch.opener}кг</Highlight><span style={{ color:TEXT_3 }}>→</span><Highlight color="#ff9f0a">{meet.snatch.second}кг</Highlight><span style={{ color:TEXT_3 }}>→</span><Highlight color="#ff3b30">{meet.snatch.third}кг</Highlight></div>
                <div style={{ fontSize:12, color:TEXT_3, marginTop:6, lineHeight:1.5 }}>92% · 97% · 102% от ПМ</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.035)', padding:'14px 16px', borderRadius:16, border:'0.5px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>🏋️ Толчок <Badge color="#0a84ff" bg="rgba(10,132,255,0.12)" border="rgba(10,132,255,0.22)">{meet.total? Math.round(meet.cleanJerk.opener/meet.total*100)+'%' : ''}</Badge></div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:15, fontVariantNumeric:'tabular-nums' }}><Highlight color="#30d158">{meet.cleanJerk.opener}кг</Highlight><span style={{ color:TEXT_3 }}>→</span><Highlight color="#ff9f0a">{meet.cleanJerk.second}кг</Highlight><span style={{ color:TEXT_3 }}>→</span><Highlight color="#ff3b30">{meet.cleanJerk.third}кг</Highlight></div>
                <div style={{ fontSize:12, color:TEXT_3, marginTop:6, lineHeight:1.5 }}>92% · 97% · 102% от ПМ</div>
              </div>
            </div>
            <div style={{ fontSize:13, color:'#fff', background:'rgba(0,0,0,0.16)', padding:'12px 14px', borderRadius:14, border:'0.5px solid rgba(255,255,255,0.07)', lineHeight:1.5 }}>{wlAttemptRationale(meet).slice(0,3).map((t,i)=> <span key={i} style={{ marginRight:8 }}>{t.includes('кг') ? t.split(' ').map((w,j)=> /[0-9]/.test(w) ? <Highlight key={j} color="#0a84ff">{w}</Highlight> : w+' ') : t}</span>)}</div>
          </SectionCard></div>
        ) : null;
      })()}
      {(plan.inputSnapshot as any)?.contest?.events?.length ? (
        <SectionCard icon="🏆" title="Контест-пакет" subtitle={`${(plan.inputSnapshot as any).contest.events.length} ивентов · ${(plan.inputSnapshot as any).contestStrategy||'balanced'} · taper Winwood 8.6д`} strong collapsible defaultOpen={false} summary={`${(plan.inputSnapshot as any).contest.events.length} ивентов · ${(plan.inputSnapshot as any).contestStrategy||'balanced'}`}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {(plan.inputSnapshot as any).contest.events.map((e:any, i:number)=> (
              <span key={i} style={{ padding:'7px 12px', borderRadius:12, background:'rgba(245,158,11,0.10)', border:'0.5px solid rgba(245,158,11,0.20)', fontSize:12, fontWeight:600, color:'#fff' }}><HighlightStrong>{(EVENT_META as any)[e.id]?.label || e.id}</HighlightStrong> {e.format} {e.weight?`${e.weight}кг`:''} {e.distanceM?`${e.distanceM}м`:''} {e.timeCapS?`cap${e.timeCapS}с`:''} {e.heightCm?`${e.heightCm}см`:''} {e.turn?'разв.':''} {(TAPER_CESSATION_DAYS as any)[e.id] ? `· cess ${(TAPER_CESSATION_DAYS as any)[e.id]}д`:''}</span>
            ))}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
            {(() => {
              const rows = (plan.inputSnapshot as any).contest.events.map((e:any)=> {
                const pm = ((): number =>{ const wm:any=plan.workMax||{}; if(e.id==='yoke_walk') return wm.yokeWalk||wm.deadlift||180; if(['farmers_walk_heavy','frame_carry','husafell_carry','conan_wheel','shield_carry'].includes(e.id)) return wm.farmersWalk||wm.deadlift||140; if(['atlas_stone_load','atlas_stone_over_bar','natural_stone_shoulder','sandbag_load'].includes(e.id)) return wm.atlasStone||100; if(['log_press','axle_press','viking_press','circus_db_press'].includes(e.id)) return wm.logPress||wm.overheadPress||60; return 100; })();
                const ratio = e.weight ? Math.round(pm/e.weight*100) : 100; const place = ratio>=100?1: ratio>=95?2: ratio>=90?3:4;
                return <span key={e.id} style={{ padding:'7px 12px', borderRadius:12, background: ratio>=100?'rgba(48,209,88,0.12)':'rgba(255,159,10,0.10)', border:`0.5px solid ${ratio>=100?'rgba(48,209,88,0.22)':'rgba(255,159,10,0.18)'}`, fontSize:12, fontWeight:700, color:'#fff' }}>{(EVENT_META as any)[e.id]?.label||e.id} {ratio}% · P{place}</span>;
              });
              return rows;
            })()}
          </div>
          <InfoBanner tone="strong">Прогрессия: 85%→100% к контесту · дистанции/высота/cap/разворот из пакета · medley по implements контеста · стратегия { (plan.inputSnapshot as any).contestStrategy } → 85/92/98 vs 90/97/102%</InfoBanner>
        </SectionCard>
      ) : null}
      {(() => {
        const cond = buildConditioningRationale(1, plan.weeks, plan.mode);
        return cond.length && plan.mode==='strongman' ? (
          <SectionCard icon="🏃" title="Кондиция" subtitle={cond.join(' · ')} collapsible defaultOpen={false} summary={buildConditioningRationale(1, plan.weeks, plan.mode).join(' · ')}>
            <InfoBanner tone="info">Фаза: alactic 8×10с/50с → lactic 5×60с/90с → aerobic Zone2 30′ · внезала high — пауза (Winwood 54% plyo)</InfoBanner>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {cond.map((c,i)=> <Badge key={i} color="#0a84ff" bg="rgba(10,132,255,0.08)" border="rgba(10,132,255,0.16)">{c}</Badge>)}
            </div>
          </SectionCard>
        ) : null;
      })()}
      {plan.mode !== 'weightlifting' && (() => {
        const yoke = (plan.workMax as any).yokeWalk || (plan.workMax as any).deadlift;
        const log = (plan.workMax as any).logPress || (plan.workMax as any).overheadPress;
        const yPlan = yoke ? buildSMEventPlan('yoke_walk', yoke, (plan.inputSnapshot as any)?.contestStrategy) : null;
        const lPlan = log ? buildSMEventPlan('log_press', log, (plan.inputSnapshot as any)?.contestStrategy) : null;
        // medley для ивент-дня: берём первые 2 carries недели 1
        const medleyEx = plan.weeksData[0]?.sessions.find(s=> s.sessionTag==='event_day')?.exercises.filter(e=> ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','sled_push_sprint'].includes(e.id)).slice(0,2) || [];
        return (yPlan || lPlan || medleyEx.length>=2) ? (
          <div data-ss="attempts"><SectionCard icon="🪨" title="Попытки стронг + Medley" subtitle="шаг йок 10кг / лог 2.5кг · medley 90с переход cap 180с" strong collapsible defaultOpen={false} summary="опенеры 90/96/102 · medley 90с">
            <div style={{ display:'grid', gridTemplateColumns: yPlan && lPlan ? '1fr 1fr' : '1fr', gap:10 }}>
              {yPlan && <div style={{ background:'rgba(255,159,10,0.08)', padding:'10px 12px', borderRadius:12, border:'0.5px solid rgba(255,159,10,0.18)' }}><div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>🚜 Йок {(yPlan.warmup[0] as any)?.distanceM||20}м cap {(yPlan.warmup[0] as any)?.timeCapS||60}с</div><div style={{ display:'flex', gap:8, marginTop:8, fontSize:16, fontVariantNumeric:'tabular-nums' }}><HighlightStrong>{yPlan.attempts.opener}кг</HighlightStrong><span style={{ color:TEXT_3 }}>→</span><HighlightStrong>{yPlan.attempts.second}кг</HighlightStrong><span style={{ color:TEXT_3 }}>→</span><HighlightStrong>{yPlan.attempts.third}кг</HighlightStrong></div>{yPlan.ladder && <div style={{ fontSize:10, color:TEXT_3, marginTop:4 }}>Лестница: {yPlan.ladder.weights.slice(0,3).join('→')}кг</div>}</div>}
              {lPlan && <div style={{ background:'rgba(255,159,10,0.08)', padding:'10px 12px', borderRadius:12, border:'0.5px solid rgba(255,159,10,0.18)' }}><div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>🪵 Лог</div><div style={{ display:'flex', gap:8, marginTop:8, fontSize:16, fontVariantNumeric:'tabular-nums' }}><HighlightStrong>{lPlan.attempts.opener}кг</HighlightStrong><span style={{ color:TEXT_3 }}>→</span><HighlightStrong>{lPlan.attempts.second}кг</HighlightStrong><span style={{ color:TEXT_3 }}>→</span><HighlightStrong>{lPlan.attempts.third}кг</HighlightStrong></div></div>}
            </div>
            {medleyEx.length>=2 && <div style={{ background:'rgba(59,130,246,0.08)', border:'0.5px solid rgba(59,130,246,0.18)', padding:'8px 10px', borderRadius:10, fontSize:11, color:TEXT_2 }}><b style={{ color:'#60a5fa' }}>Medley</b> · {medleyEx.map(e=> `${e.name} ${e.weight}кг ${(e.workSets[0] as any)?.distanceM||20}м`).join(' → ')} <span style={{ color:TEXT_3 }}>· переход 90с · cap 180с</span></div>}
            <div style={{ fontSize:10, color:TEXT_3, lineHeight:1.4 }}>{yPlan && smEventRationale(yPlan).slice(0,2).join(' · ')} {lPlan && smEventRationale(lPlan).slice(0,2).join(' · ')}</div>
          </SectionCard></div>
        ) : null;
      })()}

      {plan.validation?.warnings.map((w,i) => <InfoBanner key={i} tone="warn">{w}</InfoBanner>)}

      {/* Heatmap 4 rows (carry/stone/overhead / squat+deadlift) — P2 как CardioUI */}
      <SectionCard icon="🔥" title="Heatmap · 4 ряда" subtitle="Carry м / Stone подъёмы / Overhead+Жим / Присед+Тяга — как CardioUI 4 rows" collapsible defaultOpen={false} summary="Carry · Stone · Overhead · Присед+Тяга">
        <StrengthHeatmap weeksData={plan.weeksData as any} level={plan.level} />
      </SectionCard>

      {/* Medley EventCard — глобальные слайдеры distance/timeCap как в ТЗ K UI */}
      {plan.mode==='strongman' && plan.weeksData.some(w=> w.sessions.some(s=> s.sessionTag==='event_day')) && (
        <EventCard
          title="⛓️ Medley — цепь 2+1 в плане"
          subtitle={`${plan.weeksData.filter(w=> w.sessions.some(s=> s.sessionTag==='event_day')).length} ивент-дней · distance 10-50м / cap 30-180с · суммарный cap < 360с`}
          events={(() => {
            const ev = plan.weeksData[0].sessions.find(s=> s.sessionTag==='event_day');
            if (!ev) return [];
            const carries = ev.exercises.filter(e=> ['yoke_walk','farmers_walk_heavy','frame_carry','husafell_carry','sandbag_carry','zercher_carry'].includes(e.id)).slice(0,2);
            const stones = ev.exercises.filter(e=> ['atlas_stone_load','sandbag_load','stone_lift','sandbag_shoulder','keg_toss'].includes(e.id)).slice(0,1);
            return [...carries, ...stones].map(e=> ({
              id: e.id, label: e.name,
              distanceM: (e.workSets[0] as any)?.distanceM ?? (e.id.includes('yoke')?20:40),
              timeCapS: (e.workSets[0] as any)?.timeCapS ?? 60,
              weight: e.weight
            }));
          })()}
          onChange={(id,patch)=> onMedleyChange(id, patch)}
        />
      )}

      {/* Недели — collapsible Apple accordion */}
      {plan.weeksData.map(wk => {
        const isOpen = expandedWeek === wk.week - 1;
        const tone = wk.deload ? '#f59e0b' : (wk as any).taper ? '#60a5fa' : '#30d158';
        const border = wk.deload ? 'rgba(245,158,11,0.22)' : (wk as any).taper ? 'rgba(59,130,246,0.22)' : 'rgba(48,209,88,0.16)';
        const tonnage = Math.round(wk.sessions.reduce((a,s)=>a+s.exercises.reduce((x,e)=>x+e.workSets.reduce((q,w)=>q+w.weight*w.reps,0),0),0)/1000);
        return (
        <div key={wk.week} data-ss="week" style={{ ...CARD, padding:0, overflow:'hidden', borderColor: border, background: isOpen ? 'linear-gradient(180deg, rgba(26,24,38,0.82), rgba(18,16,28,0.66))' : CARD.background }}>
          <button onClick={()=> onToggleWeek(isOpen? null : wk.week-1)} style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:'16px 18px', background: wk.deload? 'rgba(245,158,11,0.07)' : (wk as any).taper? 'rgba(59,130,246,0.07)':'transparent', border:'none', cursor:'pointer', textAlign:'left', minHeight:72 }}>
            <span style={{ width:46, height:46, borderRadius:14, background: wk.deload? 'linear-gradient(135deg,#f59e0b,#f97316)' : (wk as any).taper? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : ACCENT_GRAD, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:16, flexShrink:0, boxShadow:'0 6px 18px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.22)', fontFamily:'-apple-system, system-ui, sans-serif' }}>{wk.week}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#fff', lineHeight:1.2, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}><Highlight color={tone}>{ruLabel(PHASE_RU, wk.phase)}</Highlight>{wk.deload? <Highlight color="#f59e0b">разгрузка</Highlight> : (wk as any).taper? <Highlight color="#60a5fa">тапер</Highlight> : null}<span style={{ fontWeight:400, color:TEXT_3 }}>· {wk.totalSets} сетов · <Highlight color={tone}>{tonnage}т</Highlight></span></div>
              <div style={{ fontSize:11, color:TEXT_3, marginTop:1, fontFamily:'-apple-system, system-ui, sans-serif' }}>Неделя {wk.week} · {wk.sessions.length} сессий · {wk.sessions.reduce((a,s)=>a+s.exercises.length,0)} упр.</div>
            </div>
            <span style={{ width:38, height:38, borderRadius:12, background: isOpen? `${tone}14`:'rgba(255,255,255,0.06)', border:`0.5px solid ${isOpen? tone+'22':'rgba(255,255,255,0.08)'}`, display:'flex', alignItems:'center', justifyContent:'center', color: isOpen? tone:'#fff', fontSize:13, transition:'transform 0.18s', transform: isOpen? 'rotate(180deg)':'rotate(0deg)', flexShrink:0 }}>▾</span>
          </button>
          {!isOpen && (
            <div style={{ padding:'0 14px 12px', display:'flex', gap:6, flexWrap:'wrap' }}>
              {wk.sessions.map(s=> <span key={s.day} style={{ fontSize:12, fontWeight:600, padding:'7px 12px', borderRadius:12, background:'rgba(255,255,255,0.045)', border:'0.5px solid rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.78)', fontFamily:'-apple-system, system-ui, sans-serif' }}>{s.sessionTag} · {s.exercises.length}упр · {s.character}</span>)}
            </div>
          )}
          {isOpen && (
          <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', justifyContent:'flex-end' }}><button onClick={()=>{
              const txt = wk.sessions.map(s=> `${s.sessionTag} (${s.character}) д${s.day}:\n` + s.exercises.map(e=> `  ${e.name} ${e.sets}x${e.reps} ${e.weight}кг RIR${e.rir}`).join('\n')).join('\n\n');
              navigator.clipboard?.writeText(`Неделя ${wk.week} ${wk.phase}\n`+txt); doMsg(`Неделя ${wk.week} скопирована`);
            }} style={{ ...BTN_SMALL, background:'rgba(255,255,255,0.06)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.08)' }}>⎙ Копировать неделю</button></div>
            {wk.sessions.map(sess => (
              <div key={sess.day} style={{ background:'rgba(255,255,255,0.032)', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:18, padding:14, backdropFilter:'blur(8px)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:8 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'#fff', fontFamily:'-apple-system, system-ui, sans-serif' }}>{sess.sessionTag} <span style={{ fontWeight:500, color:TEXT_3 }}>· <Highlight color={sess.character==='тяж'?'#f59e0b': sess.character==='памп'?'#30d158':'#64d2ff'}>{sess.character}</Highlight> · день {sess.day} · {sess.durationMin}′</span></span>
                  <span style={{ fontSize:10, color:TEXT_3, background:'rgba(0,0,0,0.16)', padding:'3px 7px', borderRadius:20, border:'0.5px solid rgba(255,255,255,0.06)', fontVariantNumeric:'tabular-nums' }}>⏱ {Math.round(sess.exercises.reduce((a,e)=>a+ e.workSets.length* (e.restSeconds||90),0)/60)}′ отдыха</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {sess.exercises.map(ex => (
                    <div key={ex.id} data-ss="exercise" style={{ background:'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', border:'0.5px solid rgba(255,255,255,0.08)', borderLeft:'3px solid rgba(0,230,138,0.35)', borderRadius:16, padding:14, display:'flex', flexDirection:'column', gap:10 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ fontSize:15, fontWeight:700, color:'#fff', flex:'1 1 160px', fontFamily:'-apple-system, system-ui, sans-serif', lineHeight:1.35 }}>{ex.name} <span style={{ fontWeight:500, color:'#fff' }}>— <Highlight color={mode==='strongman'?ACCENT_STRONG:ACCENT}>{ex.sets}×{ex.reps}</Highlight>{(ex.workSets[0] as any)?.distanceM ? <> · <Highlight color={ACCENT_STRONG}>{(ex.workSets[0] as any).distanceM}м</Highlight></> : null}{(ex.workSets[0] as any)?.timeCapS ? <> · <Highlight>{(ex.workSets[0] as any).timeCapS}с cap</Highlight></> : null} · <Highlight>{ex.weight}кг</Highlight> · <Highlight color={ex.rir<=1?'#ff3b30': ex.rir<=2?'#ff9f0a':'#30d158'}>RIR{ex.rir}</Highlight></span><span style={{ fontSize:11.5, color:TEXT_3, marginLeft:6, fontVariantNumeric:'tabular-nums' }}>· {ex.tempo} · {ex.restSeconds}с{ex.isCompetitionLift?' ★':''}</span></span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'76px 76px 76px auto', gap:8, alignItems:'center' }}>
                        <input type="number" value={ex.weight} onChange={e=> onUpdateEx(wk.week-1, sess.day, ex.id, { weight: Number(e.target.value)||0 })} style={{ ...INPUT, padding:'12px 8px', fontSize:15, fontWeight:700, textAlign:'center', fontVariantNumeric:'tabular-nums', minHeight:52 }} placeholder="кг" />
                        <input type="text" value={ex.reps} onChange={e=> onUpdateEx(wk.week-1, sess.day, ex.id, { reps: e.target.value })} style={{ ...INPUT, padding:'12px 8px', fontSize:15, fontWeight:700, textAlign:'center', minHeight:52 }} placeholder="повт" />
                        <input type="number" value={ex.rir} onChange={e=> onUpdateEx(wk.week-1, sess.day, ex.id, { rir: Number(e.target.value)||0 })} style={{ ...INPUT, padding:'12px 8px', fontSize:15, fontWeight:700, textAlign:'center', fontVariantNumeric:'tabular-nums', minHeight:52 }} placeholder="RIR" />
                        <div style={{ display:'flex', gap:6 }}><button onClick={()=> onMoveEx(wk.week-1, sess.day, ex.id, -1)} style={{ width:46, height:52, borderRadius:12, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.09)', color:'#fff', cursor:'pointer', fontSize:15 }}>↑</button><button onClick={()=> onMoveEx(wk.week-1, sess.day, ex.id, 1)} style={{ width:46, height:52, borderRadius:12, background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.09)', color:'#fff', cursor:'pointer', fontSize:15 }}>↓</button></div>
                      </div>
                      {ex.comment && <div style={{ fontSize:11, color:'#fff', background: mode==='strongman'?'rgba(245,158,11,0.08)':'rgba(48,209,88,0.08)', borderLeft:`2px solid ${mode==='strongman'?'rgba(245,158,11,0.28)':'rgba(48,209,88,0.28)'}`, padding:'6px 8px', borderRadius:8, lineHeight:1.4 }}>{ex.comment}</div>}
                      {ex.warmupSets && ex.warmupSets.length>0 && <div style={{ fontSize:10.5, color:TEXT_3, fontFamily:'-apple-system, system-ui, sans-serif' }}>Разминка: {ex.warmupSets.map(s=> `${s.reps}×${s.weight}кг`).join(' → ')} → рабочие</div>}
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {ex.workSets.map((s,si)=> (
                          <span key={si} data-ss="set-row" style={{ display:'flex', gap:6, alignItems:'center', background:'rgba(255,255,255,0.045)', padding:'8px 10px', borderRadius:12, fontSize:12, fontWeight:600, color:'#fff', border:'0.5px solid rgba(255,255,255,0.07)', fontVariantNumeric:'tabular-nums', minHeight:52 }}>
                            <span style={{ color:'#fff', fontWeight:700 }}>#{si+1}</span>
                            <input type="number" value={s.weight} onChange={e=> onUpdateSet(wk.week-1,sess.day,ex.id,si,{weight:Number(e.target.value)||0})} style={{ width:62, minHeight:44, padding:'8px 6px', fontSize:14, fontWeight:700, background:'rgba(255,255,255,0.07)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:10, textAlign:'center', fontVariantNumeric:'tabular-nums' }} />кг
                            <input type="number" value={s.reps} onChange={e=> onUpdateSet(wk.week-1,sess.day,ex.id,si,{reps:Number(e.target.value)||0})} style={{ width:48, minHeight:44, padding:'8px 6px', fontSize:14, fontWeight:700, background:'rgba(255,255,255,0.07)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:10, textAlign:'center', fontVariantNumeric:'tabular-nums' }} />×
                            <input type="number" value={s.rir} onChange={e=> onUpdateSet(wk.week-1,sess.day,ex.id,si,{rir:Number(e.target.value)||0})} style={{ width:46, minHeight:44, padding:'8px 6px', fontSize:14, fontWeight:700, background:'rgba(255,255,255,0.07)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:10, textAlign:'center', fontVariantNumeric:'tabular-nums' }} />RIR
                            <input type="number" step="0.05" placeholder="м/с" value={vbtMap[`${wk.week}-${sess.day}-${ex.id}-${si}`] ?? ''} onChange={e=> { const v=parseFloat(e.target.value); const k=`${wk.week}-${sess.day}-${ex.id}-${si}`; onVbtMap(k, Number.isFinite(v)?v:0); }} style={{ width:58, minHeight:44, padding:'8px 6px', fontSize:13, background:'rgba(255,255,255,0.07)', color:'#fff', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:10, textAlign:'center', fontVariantNumeric:'tabular-nums' }} />
                            {(ex.id.includes('yoke')||ex.id.includes('farmers')||ex.id.includes('carry')||ex.id.includes('husafell')||ex.id.includes('frame')||ex.id.includes('sled')||ex.id.includes('tire')||ex.id.includes('stone')||ex.id.includes('sandbag')) && <>
                              <input type="number" placeholder="м" title="дистанция м" value={(s as any).distanceM ?? ''} onChange={e=> onUpdateSet(wk.week-1,sess.day,ex.id,si,{distanceM: Number(e.target.value)||0} as any)} style={{ width:54, minHeight:44, padding:'8px 6px', fontSize:13, fontWeight:700, background:'rgba(255,159,10,0.10)', color:'#fff', border:'0.5px solid rgba(255,159,10,0.20)', borderRadius:10, textAlign:'center' }} />
                              <input type="number" placeholder="с" title="cap с" value={(s as any).timeCapS ?? ''} onChange={e=> onUpdateSet(wk.week-1,sess.day,ex.id,si,{timeCapS: Number(e.target.value)||0} as any)} style={{ width:54, minHeight:44, padding:'8px 6px', fontSize:13, fontWeight:700, background:'rgba(59,130,246,0.10)', color:'#fff', border:'0.5px solid rgba(59,130,246,0.20)', borderRadius:10, textAlign:'center' }} />
                            </>}
                            {(() => { const v=vbtMap[`${wk.week}-${sess.day}-${ex.id}-${si}`]; if(!v||v<=0) return null; const e1=estimate1RMFromVelocitySS(s.weight, v, ex.id); return e1? <span style={{ fontSize:9, color:TEXT_3, fontVariantNumeric:'tabular-nums' }}>e1RM {Math.round(e1)}кг</span>:null; })()}
                          </span>
                        ))}
                      </div>
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

      {annual && (
        <>
        <SectionCard icon="🗓️" title="Годовой план" subtitle={`${annual.totalWeeks} нед · ${annual.blocks.length} блоков · синхронизация Stark`} collapsible defaultOpen={false} summary={`${annual.totalWeeks} нед · ${annual.blocks.length} блоков`}>
          <CardHeader icon="🗓️" title={`Годовой · ${annual.totalWeeks} нед`} subtitle={`${annual.blocks.length} блоков · ${plan.weeks} нед текущий`} />
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {annual.blocks.map((b:any) => {
              const col = b.mode==='weightlifting'?'#30d158': b.mode==='strongman'?'#ff9f0a':'#0a84ff';
              return <span key={b.id} style={{ padding:'8px 12px', borderRadius:12, background:`${col}14`, border:`0.5px solid ${col}26`, color:col, fontSize:12, fontWeight:800, fontVariantNumeric:'tabular-nums' }}><Highlight color={col}>Нед {b.startWeek}-{b.startWeek+b.weeks-1}</Highlight>: {ruLabel(MODE_RU, b.mode)} ×{b.weeks}{((b as any).plan?.inputSnapshot as any)?.cycleId ? ` · ${String(((b as any).plan.inputSnapshot as any).cycleId).replace(/^ss-/, '')}` : ''}{b.competitionDate ? ' 🏁' : ''}</span>;
            })}
          </div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {annual.blocks.map((b:any, idx:number)=> (
              <div key={b.id} style={{ display:'flex', gap:6, alignItems:'center', background:'rgba(255,255,255,0.045)', padding:'8px 10px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#fff', fontVariantNumeric:'tabular-nums' }}>{idx+1}. {b.weeks}нед</span>
                <button disabled={idx===0} onClick={()=> { const n=moveAnnualBlock(annual, idx, idx-1); if(n){ onAnnualChange(n); doMsg(`◀ блок ${idx+1} → ${idx}`, 1500); } }} style={{ ...BTN_SMALL, padding:'8px 12px', fontSize:13, opacity: idx===0?0.4:1 }}>◀</button>
                <button disabled={idx===annual.blocks.length-1} onClick={()=> { const n=moveAnnualBlock(annual, idx, idx+1); if(n){ onAnnualChange(n); doMsg(`▶ блок ${idx+1} → ${idx+2}`, 1500); } }} style={{ ...BTN_SMALL, padding:'8px 12px', fontSize:13, opacity: idx===annual.blocks.length-1?0.4:1 }}>▶</button>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', height:28, borderRadius:14, overflow:'hidden', border:'0.5px solid rgba(255,255,255,0.10)', background:'rgba(0,0,0,0.20)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            {annual.blocks.map((b:any)=> {
              const w = (b.weeks/annual.totalWeeks*100).toFixed(1);
              const col = b.mode==='weightlifting'?'#30d158': b.mode==='strongman'?'#ff9f0a':'#0a84ff';
              const grad = b.competitionDate ? `linear-gradient(90deg, ${col}, #fff)` : `linear-gradient(180deg, ${col}, ${col}CC)`;
              return <div key={b.id} title={`${b.mode} ${b.weeks}нед${b.competitionDate?` · 🏁 ${b.competitionDate}`:''}`} style={{ width: `${w}%`, background: grad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color: b.mode==='weightlifting'?'#06281c':'#fff', fontWeight:800, fontVariantNumeric:'tabular-nums', textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>{b.weeks}</div>;
            })}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:TEXT_3, fontVariantNumeric:'tabular-nums' }}><span>Нед 1</span><span>Нед {annual.totalWeeks}</span></div>
            <div style={{ fontSize:12, color:'#fff', background:'rgba(255,255,255,0.035)', padding:'10px 12px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.07)', lineHeight:1.5 }}>Синхронизация: <Highlight>he_strength_annual_sync_v1</Highlight> · годовой доступен в дневнике и общем плане</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {rankedCycles.filter(r=> !r.blocked).map(r=> {
                const id = r.cycle.meta.id;
                const sel = annualCycleSel ? annualCycleSel.includes(id) : rankedCycles.filter(x=> !x.blocked).slice(0, 3).some(x=> x.cycle.meta.id===id);
                return (
                  <ChipToggle key={id} active={sel} onClick={()=> onAnnualCycleSel(prev=> {
                    const base = prev ?? rankedCycles.filter(x=> !x.blocked).slice(0, 3).map(x=> x.cycle.meta.id);
                    return base.includes(id) ? base.filter(x=> x!==id) : [...base, id];
                  })}>{r.cycle.meta.title}</ChipToggle>
                );
              })}
            </div>
            <button onClick={onBuildAnnualFromCycles} style={{ ...BTN_SMALL, background:'linear-gradient(135deg, #0A84FF, #30D158)', color:'#fff', border:'none' }}>📚 Год из циклов ({annualCycleSel?.length || 3})</button>
          </SectionCard>
        {plan.mode==='strongman' && (
          <SectionCard icon="🗓️" title="Сезон — Multi-peak (PRO)" subtitle="GPP 4w + 2×camp 8-12w + transition 2w (season planner)" collapsible defaultOpen={false} summary="GPP 4w · 2 пика · transition 2w">
            <GroupHeading icon="🏁" text="Сезон 2 пика" desc="GPP + camp→пик + transition + camp→пик — backend готов, фронт Season Planner"/>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:13, fontWeight:700, color:TEXT_2 }}>GPP</span><input type="number" value={4} style={{ width:72, ...INPUT, padding:'12px 8px', fontSize:14, fontWeight:700, textAlign:'center', minHeight:52 }} readOnly />
              <span style={{ fontSize:13, fontWeight:700, color:TEXT_2 }}>Transition</span><input type="number" value={2} style={{ width:72, ...INPUT, padding:'12px 8px', fontSize:14, fontWeight:700, textAlign:'center', minHeight:52 }} readOnly />
              <button onClick={onBuildSeason} style={{ ...BTN_SMALL, background:'linear-gradient(135deg, #f59e0b, #ef4444)', color:'#fff', border:'none' }}>✦ Собрать сезон 2 пика</button>
            </div>
            <InfoBanner tone="strong">Multi-peak: GPP 4w + peak1 ({plan.weeks}w) + trans 2w + peak2 6w — {annual.totalWeeks}w → ~{annual.totalWeeks+8}w сезон</InfoBanner>
          </SectionCard>
        )}
        </>
      )}

      <div data-ss="exports"><SectionCard icon="📤" title="Экспорт и шаринг" subtitle="Печать · CSV/XLS · ICS · дайджест · в программу" collapsible defaultOpen={false} summary="CSV · XLS · ICS · печать">
        <GroupHeading icon="⎙" text="Копировать и печать" desc="Быстрый обмен и печать" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:10 }}>
          <button onClick={() => { const txt = buildStrengthSportReport(plan); navigator.clipboard?.writeText(txt); setMsg('Скопировано'); setTimeout(()=>setMsg(''),1800); }} style={BTN}>⎙ Копировать</button>
          <button onClick={() => { const html = buildStrengthPrintHtml(plan); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); } setMsg('Печать'); }} style={BTN}>🖨 Печать</button>
          <button onClick={()=> { const d=shareStrengthDigest(plan); navigator.clipboard?.writeText(d); setMsg('Дайджест'); }} style={BTN}>📋 Дайджест</button>
        </div>
        <Divider />
        <GroupHeading icon="📊" text="Файлы" desc="CSV / XLS для Excel · ICS для календаря" />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:10 }}>
          <button onClick={() => { downloadStrengthCsv(plan); setMsg('CSV'); }} style={BTN}>📊 CSV</button>
          <button onClick={() => { downloadStrengthXlsx(plan); setMsg('XLS'); }} style={{ ...BTN, background:'rgba(48,209,88,0.12)', color:'#30d158', border:'0.5px solid rgba(48,209,88,0.20)' }}>📗 XLSX</button>
          <button onClick={() => { downloadStrengthIcs(plan, (plan as any).inputSnapshot?.startDate); setMsg('ICS'); }} style={BTN}>📅 План .ics</button>
          <button onClick={onExportProgram} style={BTN_PRIMARY}>✦ В программу</button>
        </div>
        <div style={{ fontSize:12, color:TEXT_3, background:'rgba(255,255,255,0.035)', padding:'10px 12px', borderRadius:12, border:'0.5px solid rgba(255,255,255,0.07)', display:'flex', gap:8, flexWrap:'wrap', lineHeight:1.5 }}><Highlight>Экспорт</Highlight> — библиотека программ · печать · шаринг в ТГ · ICS · CSV/XLS</div>
      </SectionCard></div>
      {msg && <InfoBanner tone="ok"><Highlight>{msg}</Highlight></InfoBanner>}
    </div>
  );
};
