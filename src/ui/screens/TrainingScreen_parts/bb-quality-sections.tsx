/**
 * bb-quality-sections.tsx — под-секции шага «Качество» ББ-авто, вынесенные из
 * god-component `BbAutoConstructor.tsx` (§4.3, этап 4: большие renderQuality/
 * renderContestPrep режутся под-секциями, а не целиком). Перенос 1-в-1:
 * логика/тексты/стили не менялись; в `BbQualityUnifiedCard` одна осознанная
 * замена — readiness-выражение (linked) вынесено в prop `readiness` тем же
 * результатом (`65` при наличии recovery/HRV, иначе `null`).
 */
import React from 'react';
import type { BBPlan } from '../../../engines/bb/bb-builder.engine';
import { buildBBQualityReport, bbQualityReportSummary, bbQualityBadge } from '../../../engines/bb/bb-quality-report.engine';
import { bbPlanQualityV2 } from '../../../engines/bb/bb-quality-v2.engine';
import { unilateralRatioOf } from '../../../engines/bb/bb-sfr-db';
import { estimateSessionTimeWithSupersets, suggestSupersetPairs } from '../../../engines/bb/bb-fatigue.engine';
import { bbVbtRecommendation, bbVbtZoneLabel } from '../../../engines/bb/bb-vbt.engine';
import { overreachingCheck } from '../../../engines/bb/bb-recovery.engine';
import { CollapsibleCard, isAbRotationActive, type BBPhase } from './bb-auto-constructor-shared';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import BbQualityV2Card from './BbQualityV2Card';
import { getPhaseConfig } from '../../../engines/periodization';
import { PHASE_COLORS } from './PlanOutput';
import { DELOAD_PROTOCOLS, type LoadStrategy, type DeloadType, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { sessionLimitsFor } from '../../../engines/bb/bb-volume.engine';
import { isPackingActive } from '../../../engines/bb/bb-packing.engine';
import { buildBBMethodologySummary } from '../../../engines/bb/bb-report.engine';
import type { BBRankedPattern } from '../../../engines/bb/bb-selector.engine';
import type { DUPMode } from '../../../engines/bb/bb-dup.engine';
import type { SessionMethodology } from '../../../engines/bb/bb-session-order.engine';
import type { PED, PEDAdaptation } from '../../../engines/bb/bb-ped-adaptation.engine';
import type { InjurySelectEntry } from './InjurySelectCard';
import { CARD } from './training-ui';

export interface BbQualityUnifiedCardProps {
  qualityReport: ReturnType<typeof buildBBQualityReport> | null;
  builtPlan: BBPlan;
  vbtInput: { lift: string; best: string; last: string };
  setVbtInput: React.Dispatch<React.SetStateAction<{ lift: string; best: string; last: string }>>;
  /** `65` при наличии recovery/HRV в профиле, иначе `null` (паритет с linked-выражением). */
  readiness: number | null;
  bbQualityV2: ReturnType<typeof bbPlanQualityV2> | null;
  todayBadge: string | null;
}

export const BbQualityUnifiedCard: React.FC<BbQualityUnifiedCardProps> = ({
  qualityReport, builtPlan, vbtInput, setVbtInput, readiness, bbQualityV2, todayBadge,
}) => {
  if (!qualityReport) return null;
  return (
    <CollapsibleCard title="🛡 Единое качество плана" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(16,185,129,0.04))', color: '#34d399' }} badge={bbQualityBadge(qualityReport.riskLevel).label}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: qualityReport.score >= 75 ? '#00e68a' : qualityReport.score >= 60 ? '#fbbf24' : '#f87171', border: `3px solid ${qualityReport.score >= 75 ? '#00e68a' : qualityReport.score >= 60 ? '#fbbf24' : '#f87171'}` }}>
          {qualityReport.score}
        </div>
        <div style={{ flex: 1, fontSize: 11, color: '#fff' }}>{bbQualityReportSummary(qualityReport)}</div>
      </div>
      <div style={{ fontSize: 9, opacity: 0.8, marginBottom: 8 }}>
        🧲 SFR-профиль: {Math.round(unilateralRatioOf(builtPlan as any) * 100)}% односторонних сетов · lengthened-покрытие учитывается при выборе (Maeo 2023)
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
        <span style={{ fontSize:9, opacity:0.8 }}>⚡ VBT скорость (м/с):</span>
        <PopupSelect
          label="Движение"
          value={vbtInput.lift}
          onChange={v => setVbtInput({ ...vbtInput, lift: v })}
          options={[
            { id: 'bench', label: 'Жим лёжа' },
            { id: 'squat', label: 'Присед' },
            { id: 'deadlift', label: 'Тяга' },
            { id: 'ohp', label: 'Жим стоя' },
            { id: 'row', label: 'Тяга в наклоне' },
            { id: 'pulldown', label: 'Верхний блок' },
          ]}
        />
        <input type="number" step="0.01" placeholder="лучший" value={vbtInput.best} onChange={e => setVbtInput({ ...vbtInput, best: e.target.value })} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'#fff', fontSize:10, padding:'2px 6px', width:64 }} />
        <input type="number" step="0.01" placeholder="последний" value={vbtInput.last} onChange={e => setVbtInput({ ...vbtInput, last: e.target.value })} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, color:'#fff', fontSize:10, padding:'2px 6px', width:76 }} />
      </div>
      {(() => {
        const w0 = (builtPlan as any).weeks?.[0]?.sessions?.[0];
        if (!w0?.exercises?.length) return null;
        const t = estimateSessionTimeWithSupersets(w0 as any);
        if (t.pairs === 0) return null;
        return (
          <div style={{ fontSize: 9, opacity: 0.85, marginBottom: 6 }}>
            ⏱ Неделя 1: ~{Math.round(t.baseSeconds / 60)} мин → суперсеты экономят ~{Math.round(t.savedSeconds / 60)} мин ({t.pairs} пар) — итого ~{Math.round(t.supersetSeconds / 60)} мин.
          </div>
        );
      })()}
      {(() => {
        const w0 = (builtPlan as any).weeks?.[0]?.sessions?.[0];
        if (!w0?.exercises?.length) return null;
        const sug = suggestSupersetPairs(w0 as any, 60);
        if (sug.pairs.length === 0) return null;
        return (
          <div style={{ fontSize: 9, padding: '5px 7px', borderRadius: 6, background: 'rgba(147,197,253,0.05)', color: '#bfdbfe', border: '1px solid rgba(147,197,253,0.18)', marginBottom: 6 }}>
            🔁 Рекомендуемые суперсет-пары для экономии времени: {sug.pairs.map(p => `${p.aExercise} ↔ ${p.bExercise}`).join(' · ')} (экономия ~{Math.round(sug.totalSavedSeconds / 60)} мин).
          </div>
        );
      })()}
      {(() => {
        const b = Number(vbtInput.best), l = Number(vbtInput.last);
        if (!(b > 0) || !(l > 0)) return null;
        const r = bbVbtRecommendation(vbtInput.lift, b, l);
        const z = bbVbtZoneLabel(r.lossPct);
        return (
          <div style={{ fontSize: 9, padding: '5px 7px', borderRadius: 6, background: 'rgba(56,189,248,0.06)', color: '#bfdbfe', border: '1px solid rgba(56,189,248,0.2)', marginBottom: 6 }}>
            ⚡ VBT ({vbtInput.lift}, {b.toFixed(2)}→{l.toFixed(2)} м/с): <b style={{ color: z.color }}>{z.label}</b> · {r.recommendation}
          </div>
        );
      })()}
      {(() => {
        const deloadWeeks = (builtPlan as any).weeks?.filter((w: any) => w.deload || w.phase === 'deload').map((w: any) => w.week) || [];
        if (!deloadWeeks.length) return null;
        const o = overreachingCheck(readiness != null && Number.isFinite(readiness) ? readiness - 8 : 60, readiness != null && Number.isFinite(readiness) ? readiness : 68);
        return (
          <div style={{ fontSize: 9, padding: '5px 7px', borderRadius: 6, background: o.cleared ? 'rgba(0,230,138,0.08)' : 'rgba(251,191,36,0.08)', color: o.cleared ? '#6ee7b7' : '#fcd34d', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }}>
            📉 Deload нед {deloadWeeks.join(', ')}: после разгрузки проверьте готовность — {o.recommendation}
          </div>
        );
      })()}
      {qualityReport.issues.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 140, overflowY: 'auto' }}>
          {qualityReport.issues.map((iss, i) => (
            <div key={i} style={{ fontSize: 9, padding: '4px 6px', borderRadius: 6, background: iss.level === 'error' ? 'rgba(248,113,113,0.10)' : 'rgba(251,191,36,0.08)', color: iss.level === 'error' ? '#fca5a5' : '#fcd34d', border: `1px solid ${iss.level === 'error' ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.2)'}` }}>
              <b>[{iss.source}]</b>{iss.week ? ` нед ${iss.week}` : ''} · {iss.message}
            </div>
          ))}
        </div>
      )}
      {bbQualityV2 && <BbQualityV2Card v2={bbQualityV2} todayBadge={todayBadge} />}
    </CollapsibleCard>
  );
};

export interface BbQualityPlanLogicProps {
  ranked: BBRankedPattern[];
  builtPlan: BBPlan;
  bbLevel: string;
  bbTrainingYears: number;
  bbGoal: string;
  bbTrainingFocus: 'strength' | 'hypertrophy' | 'endurance';
  bbMethodology: SessionMethodology;
  bbVolGoal: string;
  trainingVolumeMode: 'standard' | 'high';
  loadStrategy: LoadStrategy;
  deloadType: DeloadType;
  dupMode: DUPMode;
  supersetMode: 'none' | 'antagonist' | 'same_muscle' | 'giant';
  volumeScheme: 'standard' | 'gvt' | 'fst7' | 'gironda';
  bbDays: number;
  bbWeeks: number;
  weakPoints: string[];
  specTargets: string[];
  injuries: InjurySelectEntry[];
  mobilityRestrictions: string[];
  bbEquipment: string[];
  pedAdapt: PEDAdaptation;
  peds: PED[];
  bfrMode: boolean;
  blastCruiseEnabled: boolean;
  blastWeeks: number;
  cruiseWeeks: number;
  autoDeload: boolean;
  rotationMode: 'forbid' | 'strict' | 'variety';
  fewerCompound: boolean;
  allowStrengthLifts: boolean;
  avoidAxialLoadUi: boolean;
  eccentricMult: number;
  intensityTech: IntensityTechnique;
  abRotation: boolean;
  packingV2: boolean;
}

export const BbQualityPlanLogicCard: React.FC<BbQualityPlanLogicProps> = ({
  ranked, builtPlan, bbLevel, bbTrainingYears, bbGoal, bbTrainingFocus, bbMethodology, bbVolGoal,
  trainingVolumeMode, loadStrategy, deloadType, dupMode, supersetMode, volumeScheme, bbDays, bbWeeks,
  weakPoints, specTargets, injuries, mobilityRestrictions, bbEquipment, pedAdapt, peds,
  bfrMode, blastCruiseEnabled, blastWeeks, cruiseWeeks, autoDeload, rotationMode, fewerCompound,
  allowStrengthLifts, avoidAxialLoadUi, eccentricMult, intensityTech, abRotation, packingV2,
}) => {
  const levelRu: Record<string,string> = { beginner:'новичок', intermediate:'средний', advanced:'продвинутый', enhanced:'продвинутый+' };
  const goalRu: Record<string,string> = { mass:'масса', cut:'сушка', recomp:'рекомпозиция', maintenance:'поддержание', strength_mass:'сила+масса', strength:'сила' };
  const focusRu: Record<string,string> = { hypertrophy:'гипертрофия', strength:'сила', endurance:'выносливость' };
  const methRu: Record<string,string> = { compound_first:'база → изоляция', pre_exhaust:'предутомление', post_exhaust:'пост-утомление', mountain_dog:'Mountain Dog', fst7:'FST-7 порядок', hyperemia:'Hyperemia', antagonistic:'антагонисты', giant_sets:'гигант-сеты' };
  const volRu: Record<string,string> = { mev:'минимум (MEV)', mav:'оптимум (MAV)', mrv:'максимум (MRV)' };
  const stratRu: Record<string,string> = { double_progression:'двойная', linear:'линейная', wave:'волновая', rpe_based:'RPE-регуляция', undulating:'волновая', block:'блочная' };
  const totalW = builtPlan.weeks.length;
  const phaseGroups: Record<string, number[]> = {};
  for (const w of builtPlan.weeks) { const pr = ((w as any).phase || 'accumulation') as string; if (!phaseGroups[pr]) phaseGroups[pr]=[]; phaseGroups[pr].push(w.week); }
  const phaseRu: Record<string,string> = { accumulation:'накопление', intensification:'интенсификация', deload:'разгрузка', peaking:'пик' };
  const phaseText = Object.entries(phaseGroups).map(([pr,ws])=> `${phaseRu[pr]||pr} ${ws.length} нед`).join(' · ');
  const sel = ranked.find(r=> r.pattern.id===builtPlan.pattern?.id);
  const scoreText = sel ? `${sel.score}/${Math.max(...ranked.map(r=>r.score),1)}` : '—';
  const topAlt = ranked.slice(0,3).map(r=> `${r.pattern.name} ${r.score}`).join(' · ');
  const injText = injuries.length ? injuries.map(i=> `${i.muscle}${i.exclude?' (искл.)':' (щадящ.)'}`).join(', ') : 'нет';
  const mobText = mobilityRestrictions.length ? mobilityRestrictions.join(', ') : 'нет';
  const equipText = bbEquipment.length ? bbEquipment.slice(0,4).join(', ') : 'всё доступно';
  const specText = specTargets.length ? specTargets.join(' + ') : 'баланс';
  const pedMult = (pedAdapt as any).combinedMrvMultiplier ?? 1;
  const pedLabel = pedMult>1 ? `MRV ×${Number(pedMult).toFixed(2)} · ${peds.join(', ')||'курс'}` : 'натурал';
  return <CollapsibleCard title="🧠 Логика построения плана" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.18), rgba(96,165,250,0.08))', color: '#60a5fa' }} badge={`${totalW} нед · ${builtPlan.pattern?.name || ''}`}>
    <div style={{ ...CARD, marginTop:0, padding:0, overflow:'hidden', border:'1px solid rgba(96,165,250,0.22)', background:'rgba(15,23,42,0.38)' }}>
      <div style={{ padding:'10px 12px', display:'grid', gap:10 }}>
        <CollapsibleCard title="1 · Вход и цель" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(96,165,250,0.03))', color: '#60a5fa' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {[
              `уровень: ${levelRu[bbLevel]||bbLevel} (${bbTrainingYears} г)`,
              `цель: ${goalRu[bbGoal]||bbGoal}`,
              `фокус: ${focusRu[bbTrainingFocus]||bbTrainingFocus}`,
              `методика: ${methRu[bbMethodology]||bbMethodology}`,
              `объём: ${volRu[bbVolGoal]||bbVolGoal}${trainingVolumeMode==='high'?' · объёмный режим':''}`,
              `прогрессия: ${stratRu[loadStrategy]||loadStrategy} · RIR ${(getPhaseConfig('accumulation', bbTrainingFocus as any) as any).rir ?? '2–3'}→${(getPhaseConfig('intensification', bbTrainingFocus as any) as any).rir ?? '1–2'}`,
            ].map((t,i)=> <span key={i} style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>{t}</span>)}
          </div>
          <div style={{ fontSize:10, color:'#fff', opacity:0.7, lineHeight:1.35, marginTop:6 }}>
            Уровень задаёт капы подходов/упражнений и доступ к сложным техникам · цель меняет фазовый профиль (масса — больше накопления, сушка — ниже объём) · фокус меняет RIR/повторы/темп · методика — порядок упражнений в сессии.
          </div>
        </CollapsibleCard>
        <CollapsibleCard title="2 · Сплит — почему выбран" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(168,85,247,0.03))', color: '#a78bfa' }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:800, color:'#fff', background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.22)', padding:'4px 8px', borderRadius:8 }}>{builtPlan.pattern?.name || '—'} · {bbDays}×/нед · {totalW} нед</span>
            <span style={{ fontSize:11, fontWeight:700, color: (sel ? (Number(scoreText.split('/')[0])/Number(scoreText.split('/')[1]||1) >=0.8 ? '#22c55e' : Number(scoreText.split('/')[0])/Number(scoreText.split('/')[1]||1) >=0.6 ? '#f59e0b' : '#ef4444') : '#fff') }}>скор {scoreText}</span>
          </div>
          {sel && <div style={{ fontSize:10, color:'#fff', opacity:0.78, lineHeight:1.35, marginTop:6 }}><b>Подходит из-за:</b> {sel.rationale.slice(0,2).join(' · ') || 'баланс по дням и уровню'}</div>}
          <div style={{ fontSize:10, color:'#fff', opacity:0.62, lineHeight:1.35, marginTop:4 }}>Альтернативы топ-3: {topAlt || '—'} · слабые: {weakPoints.join(', ')||'баланс'} · специализация: {specText}</div>
          {sel?.warnings?.length ? <div style={{ fontSize:10, color:'#f59e0b', marginTop:4 }}>⚠ {sel.warnings.slice(0,2).join(' · ')}</div> : null}
        </CollapsibleCard>
        <CollapsibleCard title="3 · Периодизация — как меняется нагрузка" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.03))', color: '#22c55e' }}>
          <div style={{ display:'flex', gap:2, height:8, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)' }}>
            {builtPlan.weeks.map(w=>{ const pr = ((w as any).phase || 'accumulation') as BBPhase; return <div key={w.week} title={`Нед ${w.week}: ${phaseRu[pr]||pr}`} style={{ flex:1, background: PHASE_COLORS[pr]||'#fff', opacity:0.9 }} />; })}
          </div>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.35, marginTop:6 }}><b>Фазы:</b> {phaseText} · <b>RIR:</b> накопление {String((getPhaseConfig('accumulation', bbTrainingFocus as any) as any).rir || '2–3')} → интенсификация {String((getPhaseConfig('intensification', bbTrainingFocus as any) as any).rir || '1–2')} · <b>темп:</b> {getPhaseConfig('accumulation', bbTrainingFocus as any).tempo} → {getPhaseConfig('intensification', bbTrainingFocus as any).tempo}</div>
          <div style={{ fontSize:10, color:'#fff', opacity:0.62, marginTop:4 }}>Прогрессия весов: {stratRu[loadStrategy]||loadStrategy} · делод: {DELOAD_PROTOCOLS[deloadType]?.description || deloadType} · DUP {dupMode} · суперсеты {supersetMode} · схемы {volumeScheme}</div>
        </CollapsibleCard>
        <CollapsibleCard title="4 · Объём и восстановление — стратегия" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))', color: '#f59e0b' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            <span style={{ fontSize:10, color:'#fff', background: pedMult>1?'rgba(245,158,11,0.12)':'rgba(255,255,255,0.04)', border:`1px solid ${pedMult>1?'rgba(245,158,11,0.22)':'rgba(255,255,255,0.06)'}`, padding:'3px 7px', borderRadius:20 }}>{pedLabel}</span>
            <span style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>лимиты {builtPlan.maxWorkingSets} сетов / {builtPlan.maxExercises} упр. · режим {sessionLimitsFor({onCourse: pedMult>1, level: bbLevel, trainingYears: bbTrainingYears, trainingVolumeMode} as any).weeklyWorkingSets} в неделю</span>
          </div>
          <div style={{ fontSize:10, color:'#fff', opacity:0.7, lineHeight:1.35, marginTop:6 }}>Детализация по мышцам — в карточке «Тренировочный объём» ниже: там прямой/косвенный, недельный и общий, подмышцы и статус MEV/MAV/MRV.</div>
        </CollapsibleCard>
        <CollapsibleCard title="5 · Приоритеты" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.10), rgba(236,72,153,0.03))', color: '#ec4899' }}>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.45 }}>
            <div><b>Слабые:</b> {weakPoints.length? weakPoints.join(' · ') : 'баланс — без акцента'}</div>
            <div><b>Специализация:</b> {specText}{specTargets.length? ` · блоки: ${specTargets.length} (по ${Math.round(bbWeeks/Math.max(1,specTargets.length))} нед)` : ''}</div>
            {builtPlan.rationale?.some((r:string)=> /специализ|донор/i.test(r)) && <div style={{ opacity:0.75, marginTop:4 }}>Донорское перераспределение сохраняет косвенную нагрузку до MEV — прямой объём донора снижается, целевой растёт.</div>}
          </div>
        </CollapsibleCard>
        <CollapsibleCard title="6 · Безопасность" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.03))', color: '#ef4444' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            <span style={{ fontSize:10, color:'#fff', background: injuries.length?'rgba(239,68,68,0.10)':'rgba(34,197,94,0.08)', border:`1px solid ${injuries.length?'rgba(239,68,68,0.18)':'rgba(34,197,94,0.16)'}`, padding:'3px 7px', borderRadius:20 }}>травмы: {injText}</span>
            <span style={{ fontSize:10, color:'#fff', background: mobilityRestrictions.length?'rgba(245,158,11,0.10)':'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>мобильность: {mobText}</span>
            <span style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>оборудование: {equipText}</span>
            {avoidAxialLoadUi || (builtPlan.safetyConstraints as any)?.avoidAxialLoad ? <span style={{ fontSize:10, color:'#f59e0b', background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.22)', padding:'3px 7px', borderRadius:20 }}>без осевой</span> : null}
            {fewerCompound ? <span style={{ fontSize:10, color:'#fff', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>меньше многосуставных</span> : null}
            {abRotation && isAbRotationActive(builtPlan) ? <span style={{ fontSize:10, color:'#22d3ee', background:'rgba(34,211,238,0.10)', border:'1px solid rgba(34,211,238,0.25)', padding:'3px 7px', borderRadius:20 }}>🔀 A/B ротация</span> : null}
            {packingV2 && isPackingActive(builtPlan) ? <span style={{ fontSize:10, color:'#a78bfa', background:'rgba(167,139,250,0.10)', border:'1px solid rgba(167,139,250,0.25)', padding:'3px 7px', borderRadius:20 }}>📦 Packing заливка</span> : null}
            {packingV2 && !isPackingActive(builtPlan) ? <span title="Тогл включён, но заливка не сработала (weak/focus-цель, deload или нечего паковать)" style={{ fontSize:10, color:'#fff', opacity:0.55, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>Packing — не применён</span> : null}
            {abRotation && !isAbRotationActive(builtPlan) ? <span title="Тогл включён, но план дословный (faithful) или без sibling-сессий — ротировать нечего" style={{ fontSize:10, color:'#fff', opacity:0.55, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', padding:'3px 7px', borderRadius:20 }}>A/B ротация — не применена</span> : null}
          </div>
        </CollapsibleCard>
        <CollapsibleCard title="7 · Выбранные методики — детально" defaultOpen={false} headerStyle={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))', color: '#a78bfa' }} badge={`${[bbMethodology, loadStrategy, intensityTech, volumeScheme, supersetMode, dupMode, deloadType].filter(v=>v!=='none'&&v!=='standard'&&v!=='compound_first').length} активных`}>
          <div style={{ display:'grid', gap:8 }}>
            {(() => {
              const methRu: Record<string,string> = { compound_first:'База → изоляция', pre_exhaust:'Пред-истощение', post_exhaust:'Пост-истощение', mountain_dog:'Mountain Dog', fst7:'FST-7 порядок', hyperemia:'Гиперемия', antagonistic:'Антагонисты', giant_sets:'Гигант-сеты' };
              const stratRu: Record<string,string> = { double_progression:'Двойная прогрессия', linear:'Линейная', wave:'Волновая', rpe_based:'RPE-авто', undulating:'Волновая', block:'Блочная' };
              const techRu: Record<string,string> = { none:'—', drop_set:'Дроп-сет', rest_pause:'Рест-пауза', myo_rep:'Мио-репс', giant_set:'Гигант-сет', superset:'Суперсет' } as any;
              const schemeRu: Record<string,string> = { standard:'Стандарт', gvt:'GVT 10×10', fst7:'FST-7', gironda:'8×8 Жиронда' };
              const superRu: Record<string,string> = { none:'—', antagonist:'Антагонисты', same_muscle:'Одна группа', giant:'Гигант' };
              const dupRu: Record<string,string> = { none:'—', heavy_light:'Тяж/Лёг', strength_hypertrophy:'Сила/Гипер', full_dup:'Полный DUP' };
              const deloadRu: Record<string,string> = { pump:'Памп', strength:'Силовая', custom:'Кастом' } as any;
              const focusRu: Record<string,string> = { hypertrophy:'Гипертрофия', strength:'Сила', endurance:'Выносливость' };
              const p: any = builtPlan as any;
              const actualMeth = p.methodology || bbMethodology;
              const actualStrat = p.loadStrategy || loadStrategy;
              const actualScheme = p.volumeScheme || volumeScheme;
              const actualSuper = p.supersetMode || supersetMode;
              const actualDup = p.dupMode || dupMode;
              const actualDeload = p.deloadType || deloadType;
              const actualFocus = p.trainingFocus || bbTrainingFocus;
              const actualVolMode = p.trainingVolumeMode || trainingVolumeMode;
              const selItems: Array<{label:string, selected:string, actual:string, selectedRu:string, actualRu:string, changed:boolean}> = [
                { label:'Порядок упражнений', selected: bbMethodology, actual: actualMeth, selectedRu: methRu[bbMethodology]||bbMethodology, actualRu: methRu[actualMeth]||actualMeth, changed: bbMethodology!==actualMeth },
                { label:'Прогрессия нагрузки', selected: loadStrategy, actual: actualStrat, selectedRu: stratRu[loadStrategy]||loadStrategy, actualRu: stratRu[actualStrat]||actualStrat, changed: loadStrategy!==actualStrat },
                { label:'Интенсив-техника', selected: intensityTech, actual: (p.intensityTechnique||intensityTech||'none'), selectedRu: techRu[intensityTech]||intensityTech, actualRu: techRu[p.intensityTechnique||intensityTech||'none']|| (p.intensityTechnique||intensityTech), changed: intensityTech!==(p.intensityTechnique||intensityTech) },
                { label:'Схема объёма', selected: volumeScheme, actual: actualScheme, selectedRu: schemeRu[volumeScheme]||volumeScheme, actualRu: schemeRu[actualScheme]||actualScheme, changed: volumeScheme!==actualScheme },
                { label:'Суперсеты', selected: supersetMode, actual: actualSuper, selectedRu: superRu[supersetMode]||supersetMode, actualRu: superRu[actualSuper]||actualSuper, changed: supersetMode!==actualSuper },
                { label:'DUP', selected: dupMode, actual: actualDup, selectedRu: dupRu[dupMode]||dupMode, actualRu: dupRu[actualDup]||actualDup, changed: dupMode!==actualDup },
                { label:'Разгрузка', selected: deloadType, actual: actualDeload, selectedRu: deloadRu[deloadType]||deloadType, actualRu: deloadRu[actualDeload]||actualDeload, changed: deloadType!==actualDeload },
                { label:'Фокус', selected: bbTrainingFocus, actual: actualFocus, selectedRu: focusRu[bbTrainingFocus]||bbTrainingFocus, actualRu: focusRu[actualFocus]||actualFocus, changed: bbTrainingFocus!==actualFocus },
                { label:'Объёмный режим', selected: trainingVolumeMode, actual: actualVolMode, selectedRu: trainingVolumeMode==='high'?'Объёмный':'Стандарт', actualRu: actualVolMode==='high'?'Объёмный':'Стандарт', changed: trainingVolumeMode!==actualVolMode },
              ];
              const abActive = isAbRotationActive(builtPlan);
              const packActive = isPackingActive(builtPlan);
              const extraItems: Array<{label:string, value:string, active:boolean}> = [
                { label:'A/B ротация', value: !abRotation ? 'Выкл' : (abActive ? 'Вкл' : 'Вкл (не применена)'), active: abRotation && abActive },
                { label:'Packing заливка', value: !packingV2 ? 'Выкл' : (packActive ? 'Вкл' : 'Вкл (не применён)'), active: packingV2 && packActive },
                { label:'BFR', value: bfrMode ? 'Вкл' : 'Выкл', active: bfrMode },
                { label:'Blast/Cruise', value: blastCruiseEnabled ? `${blastWeeks}н/${cruiseWeeks}н` : 'Выкл', active: blastCruiseEnabled },
                { label:'Авто-разгрузка', value: autoDeload ? 'Вкл' : 'Выкл', active: autoDeload },
                { label:'Ротация', value: rotationMode, active: rotationMode!=='variety' },
                { label:'Меньше базы', value: fewerCompound ? 'Да' : 'Нет', active: fewerCompound },
                { label:'Силовые лифты', value: allowStrengthLifts ? 'Да' : 'Нет', active: allowStrengthLifts },
                { label:'Без осевой', value: avoidAxialLoadUi ? 'Да' : 'Нет', active: avoidAxialLoadUi },
                { label:'Эксцентрик', value: `×${eccentricMult}`, active: eccentricMult!==1 },
                { label:'PED', value: peds.length? peds.join(', '):'—', active: peds.length>0 },
              ];
              const methodsSummary = (()=>{ try{ return buildBBMethodologySummary(builtPlan); } catch{ return []; } })();
              return (
                <div style={{ display:'grid', gap:8 }}>
                  <div style={{ fontSize:10, color:'#fff', opacity:0.7, lineHeight:1.35 }}>Показано что выбрал пользователь и что реально используется в плане. Если отличается — применена автокоррекция (уровень, травмы, оборудование).</div>
                  <div style={{ display:'grid', gap:6 }}>
                    {selItems.map((it,i)=> (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8, background: it.changed? 'rgba(245,158,11,0.08)':'rgba(255,255,255,0.03)', border: it.changed? '1px solid rgba(245,158,11,0.18)':'1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{it.label}</span>
                        <span style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}>
                          <span style={{ fontSize:10, color: it.changed? '#f59e0b':'#fff', background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:6, textDecoration: it.changed? 'line-through': undefined, opacity: it.changed?0.6:1 }}>{it.selectedRu}</span>
                          <span style={{ fontSize:10, color:'#fff', opacity:0.5 }}>→</span>
                          <span style={{ fontSize:10, fontWeight:800, color: it.changed? '#f59e0b':'#22c55e', background: it.changed? 'rgba(245,158,11,0.12)':'rgba(34,197,94,0.10)', padding:'2px 6px', borderRadius:6, border: it.changed? '1px solid rgba(245,158,11,0.22)':'1px solid rgba(34,197,94,0.18)' }}>{it.actualRu}{it.changed?' ⚠️':''}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:6 }}>
                    {extraItems.map((it,i)=> (
                      <div key={i} style={{ padding:'5px 7px', borderRadius:8, background: it.active? 'rgba(139,92,246,0.10)':'rgba(255,255,255,0.03)', border: it.active? '1px solid rgba(139,92,246,0.18)':'1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:10, color:'#fff', opacity:0.7 }}>{it.label}</span>
                        <span style={{ fontSize:10, fontWeight:700, color: it.active? '#a78bfa':'#fff' }}>{it.value}</span>
                      </div>
                    ))}
                  </div>
                  {methodsSummary.length>0 && (
                    <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.12)' }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#a78bfa', marginBottom:4 }}>🧩 Фактически применённые методики в плане:</div>
                      {methodsSummary.map((m,idx)=> <div key={idx} style={{ fontSize:10, color:'#fff', marginBottom:2, paddingLeft:6, borderLeft:'2px solid rgba(139,92,246,0.3)' }}>{m}</div>)}
                    </div>
                  )}
                  <div style={{ fontSize:9, color:'#fff', opacity:0.5, lineHeight:1.3, padding:'4px 6px', background:'rgba(255,255,255,0.02)', borderRadius:6, border:'1px solid rgba(255,255,255,0.04)' }}>
                    Источник: `inputSnapshot` (выбор) vs `builtPlan` (факт) + `buildBBMethodologySummary` (анализ комментариев плана). Отличия — автокоррекция по уровню/травмам/оборудованию.
                  </div>
                </div>
              );
            })()}
          </div>
        </CollapsibleCard>
      </div>
    </div></CollapsibleCard>
  ;
};
