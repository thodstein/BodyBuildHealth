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
import BbQualityV2Card, { type BbQualityV2Context } from './BbQualityV2Card';
import { getPhaseConfig } from '../../../engines/periodization';
import { PHASE_COLORS } from './PlanOutput';
import { DELOAD_PROTOCOLS, type LoadStrategy, type DeloadType, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { sessionLimitsFor } from '../../../engines/bb/bb-volume.engine';
import { isPackingActive } from '../../../engines/bb/bb-packing.engine';
import type { PlanSafetyScore } from '../../../engines/bb/bb-safety-score.engine';
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
  /** Контекст пользователя для V2-карточки (уровень/цель/фокус/акцент/PED). */
  v2Context?: BbQualityV2Context;
}

export const BbQualityUnifiedCard: React.FC<BbQualityUnifiedCardProps> = ({
  qualityReport, builtPlan, vbtInput, setVbtInput, readiness, bbQualityV2, todayBadge, v2Context,
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
      <div style={{ fontSize: 9, opacity: 0.75, marginBottom: 6 }}>
        Применяется при сборке генерик-сплита (объём/RIR по порогу потери скорости, Pareja-Blanco). В режиме источника — справочно.
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
      {bbQualityV2 && <BbQualityV2Card v2={bbQualityV2} todayBadge={todayBadge} context={v2Context} />}
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
                  {/* Честность режима источника: faithful не переписывает программу. */}
                  {p.methodologyApplied === false && (
                    <div role="alert" style={{ fontSize:10, color:'#fbbf24', padding:'6px 8px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', lineHeight:1.45 }}>
                      ⚠ Режим «🎯 Точно по программе»: порядок, интенсив-техники, схемы объёма и суперсеты НЕ применяются — программа воспроизводится дословно. Чтобы выбранные методики реально работали, переключите режим на «⚙️ Адаптировать» на шаге «Параметры».
                    </div>
                  )}
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

export interface BbQualitySafetySectionProps {
  safetyScore: PlanSafetyScore | null;
  generalSafetyLoadOpen: boolean;
  setGeneralSafetyLoadOpen: React.Dispatch<React.SetStateAction<boolean>>;
  safetyOpen: boolean;
  setSafetyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  safetyFactorsOpen: boolean;
  setSafetyFactorsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  jointAnalysisOpen: boolean;
  setJointAnalysisOpen: React.Dispatch<React.SetStateAction<boolean>>;
  safetyPreventionOpen: boolean;
  setSafetyPreventionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  safetyDistributionOpen: boolean;
  setSafetyDistributionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  safetyConclusionOpen: boolean;
  setSafetyConclusionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pedAdapt: PEDAdaptation;
}

export const BbQualitySafetySection: React.FC<BbQualitySafetySectionProps> = ({
  safetyScore, generalSafetyLoadOpen, setGeneralSafetyLoadOpen, safetyOpen, setSafetyOpen,
  safetyFactorsOpen, setSafetyFactorsOpen, jointAnalysisOpen, setJointAnalysisOpen,
  safetyPreventionOpen, setSafetyPreventionOpen, safetyDistributionOpen, setSafetyDistributionOpen,
  safetyConclusionOpen, setSafetyConclusionOpen, pedAdapt,
}) => (
  <div style={{ ...CARD, padding:0, overflow:'hidden', marginBottom:8, border:'1px solid rgba(96,165,250,0.22)', background:'rgba(15,23,42,0.32)' }}>
    <button type="button" onClick={() => setGeneralSafetyLoadOpen(v=>!v)} aria-expanded={generalSafetyLoadOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', cursor:'pointer', background:'linear-gradient(135deg, rgba(239,68,68,0.16), rgba(96,165,250,0.06))', border:'none', borderBottom: generalSafetyLoadOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
       <span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>🛡️ Безопасность плана</span>
      <span style={{ width:32, height:32, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, transform: generalSafetyLoadOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
    </button>
    <div style={{ display: generalSafetyLoadOpen ? 'block' : 'none', padding:'8px 12px' }}>
      {safetyScore && (
        <div role="status" aria-label={`SafetyScore ${safetyScore.score} из 100`} style={{ marginBottom: 10, borderRadius: 14, border: `1px solid ${safetyScore.riskLevel === 'safe' ? '#22c55e' : safetyScore.riskLevel === 'caution' ? '#f59e0b' : '#ef4444'}`, background: 'rgba(255,255,255,0.03)', overflow:'hidden' }}>
          <button type="button" onClick={() => setSafetyOpen(v=>!v)} aria-expanded={safetyOpen} style={{ width:'100%', display:'flex', gap:12, alignItems:'center', padding:12, cursor:'pointer', background: `linear-gradient(135deg, ${safetyScore.riskLevel==='safe'?'rgba(34,197,94,0.14)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.14)':'rgba(239,68,68,0.14)'}, transparent)`, border:'none', borderBottom: safetyOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
            <div style={{ width:62, height:62, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', background: safetyScore.riskLevel==='safe'?'#22c55e': safetyScore.riskLevel==='caution'?'#f59e0b':'#ef4444', color:'#000', fontWeight:900, fontSize:22, boxShadow:'0 4px 12px rgba(0,0,0,0.25)' }}>{safetyScore.score}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>🛡 Безопасность плана: {safetyScore.score}/100 · {safetyScore.riskLevel === 'safe' ? 'Безопасный' : safetyScore.riskLevel === 'caution' ? 'Требует внимания' : 'Опасный'}</div>
              <div style={{ fontSize:11, color:'#fff', opacity:0.9, marginTop:2, lineHeight:1.3 }}>{safetyScore.recommendations[0]}</div>
              <div style={{ fontSize:10, color:'#fff', opacity:0.55, marginTop:4 }}>Веса: суставы 20 · ACWR 20 · восстановление 15 · травмы 15 · MRV 15 · частота 5 · баланс 10 = 100 · Формула каждого фактора — ниже</div>
            </div>
            <span style={{ width:32, height:32, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, transform: safetyOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
          </button>
          <div style={{ display: safetyOpen ? 'block' : 'none' }}>
            {/* Factor breakdown — сворачиваемая карточка с кнопкой */}
            {safetyScore.details?.factorBreakdown && (
              <div style={{ padding:0, overflow:'hidden', background:'rgba(0,0,0,0.08)', borderBottom:'1px solid rgba(255,255,255,0.06)', borderRadius:8 }}>
                <button type="button" onClick={() => setSafetyFactorsOpen(v=>!v)} aria-expanded={safetyFactorsOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', cursor:'pointer', background:'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))', border:'none', borderBottom: safetyFactorsOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
                  <span style={{ fontSize:10, fontWeight:800, color:'#fff', opacity:0.7, letterSpacing:0.3, textTransform:'uppercase' }}>🧮 Расчёт по факторам — откуда баллы</span>
                  <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, transform: safetyFactorsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                </button>
                <div style={{ display: safetyFactorsOpen ? 'grid' : 'none', padding:'8px 12px', gridTemplateColumns:'1fr', gap:6 }}>
                  {safetyScore.details.factorBreakdown.map(f=> (
                    <div key={f.key} style={{ padding:'7px 9px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:11, fontWeight:700, color: f.status==='ok'?'#22c55e': f.status==='warn'?'#f59e0b':'#ef4444' }}>{f.label}</span>
                        <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{f.score}/{f.max}</span>
                      </div>
                      <div style={{ height:6, borderRadius:6, background:'rgba(255,255,255,0.08)', marginTop:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${(f.score/f.max)*100}%`, background: f.status==='ok'?'#22c55e': f.status==='warn'?'#f59e0b':'#ef4444', transition:'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize:10, color:'#fff', opacity:0.68, marginTop:4, lineHeight:1.35, fontFamily:'ui-monospace, SFMono-Regular, monospace' }}>{f.calculation}</div>
                    </div>
                  ))}
                  <div style={{ padding:'7px 9px', borderRadius:8, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.12)', fontSize:9, color:'#fff', opacity:0.78, lineHeight:1.45 }}>
                    <b style={{ color:'#60a5fa' }}>Почему «Суставной стресс» и «Баланс» почти всегда показывают полный балл:</b> оба фактора вычитаются ТОЛЬКО при выявленной проблеме. Суставной стресс −20/−10 лишь если риск высокий/умеренный — при низком риске это 20, а детали по каждому суставу (пик/среднее/пороги) видны в карточке «🦴 Суставная нагрузка» ниже. Баланс −2 за каждую проблему антагонистов/симметрии (analyzeBBBalance) — если нарушений нет, честно остаётся 10. Полный балл ≠ «не считается», это «нарушений нет».
                  </div>
                </div>
              </div>
            )}
            {/* 🦴 Единый суставный анализ — качественная оценка нагрузки */}
            {(safetyScore.details?.jointStressDetails || safetyScore.details?.orthopedic || safetyScore.details?.loadDistribution || (safetyScore.details?.jointDiagnoses && safetyScore.details.jointDiagnoses.length>0)) && (
              <div style={{ padding:'8px 12px' }}>
                <div style={{ ...CARD, padding:0, overflow:'hidden', border:'1px solid rgba(96,165,250,0.22)', background:'rgba(15,23,42,0.42)' }}>
                  <button type="button" onClick={() => setJointAnalysisOpen(v=>!v)} aria-expanded={jointAnalysisOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', cursor:'pointer', background: safetyScore.details?.jointStressDetails?.overallRisk==='high' ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06))' : safetyScore.details?.jointStressDetails?.overallRisk==='moderate' ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))' : 'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.04))', border:'none', borderBottom: jointAnalysisOpen ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign:'left' }}>
                    <span style={{ fontSize:13, fontWeight:900, color:'#fff' }}>🦴 Суставная нагрузка — качественный анализ</span>
                    <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, transform: jointAnalysisOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                  </button>
                  <div style={{ display: jointAnalysisOpen ? 'block' : 'none' }}>
                    <div style={{ padding:'10px 12px', background: safetyScore.details?.jointStressDetails?.overallRisk==='high' ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06))' : safetyScore.details?.jointStressDetails?.overallRisk==='moderate' ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))' : 'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.04))', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:13, fontWeight:900, color:'#fff' }}>🦴 Суставная нагрузка — качественный анализ</span>
                        {(() => {
                          const r = safetyScore.details?.jointStressDetails?.overallRisk || 'low';
                          const label = r==='high'?'Высокий риск': r==='moderate'?'Умеренно':'Низкий риск';
                          const bg = r==='high'?'rgba(239,68,68,0.16)': r==='moderate'?'rgba(245,158,11,0.16)':'rgba(34,197,94,0.14)';
                          const color = r==='high'?'#ef4444': r==='moderate'?'#f59e0b':'#22c55e';
                          const border = r==='high'?'rgba(239,68,68,0.28)': r==='moderate'?'rgba(245,158,11,0.28)':'rgba(34,197,94,0.28)';
                          return <span style={{ marginLeft:'auto', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, background:bg, color, border:`1px solid ${border}` }}>{label}</span>;
                        })()}
                      </div>
                      <div style={{ fontSize:10, color:'#fff', opacity:0.78, marginTop:4, lineHeight:1.45 }}>
                        {(() => {
                          const d = safetyScore.details?.jointStressDetails;
                          if (!d) return 'Оценка по фактическому плану: стресс суставов, ортопедические блоки, распределение по неделе и точечная профилактика.';
                          const peak = d.peakWeek ? `пик — нед ${d.peakWeek}` : 'пиковая неделя —';
                          const avg = `средний нед. стресс ${Math.round(d.avgWeeklyStress)}`;
                          const most = d.mostLoadedJoint ? `лидер: ${(({ shoulder:'плечо', knee:'колено', hip:'таз', spine:'поясница', lower_back:'поясница', elbow:'локоть', wrist:'запястье', ankle:'голеностоп', neck:'шея'} as any)[d.mostLoadedJoint.joint] || d.mostLoadedJoint.joint)} · ${Math.round(d.mostLoadedJoint.stress)}` : 'лидер —';
                          const phase = safetyScore.details?.orthopedic?.phase;
                          const phaseRu = phase==='acute'?'острая': phase==='subacute'?'подострая': phase==='chronic'?'хроническая': phase==='maintenance'?'восстановление':'—';
                          return `${peak} · ${avg} · ${most} · фаза: ${phaseRu}`;
                        })()}
                      </div>
                    </div>
            <div style={{ padding:'10px 12px', display:'grid', gap:12 }}>
              {/* 1 · Нагрузка по суставам */}
              {(() => {
                const d = safetyScore.details?.jointStressDetails;
                if (!d || Object.keys(d.byJointPeak).length===0) {
                  return <div style={{ fontSize:10, color:'#fff', opacity:0.6, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)' }}>Нет данных о суставной нагрузке — план без силовых сессий или только разгрузочные недели.</div>;
                }
                // Нормализация: lower_back → spine (сумма), чтобы поясница не дублировалась и не терялась
                const normMap: Record<string, number> = {};
                for (const [j, v] of Object.entries(d.byJointPeak as Record<string, number>)) {
                  const key = j === 'lower_back' ? 'spine' : j;
                  normMap[key] = (normMap[key] || 0) + (v || 0);
                }
                const normAvg: Record<string, number> = {};
                for (const [j, v] of Object.entries(d.byJointAvg as Record<string, number>)) {
                  const key = j === 'lower_back' ? 'spine' : j;
                  normAvg[key] = (normAvg[key] || 0) + (v || 0);
                }
                const entries = Object.entries(normMap).sort((a,b)=> (b[1] as number)-(a[1] as number));
                const RU: Record<string,{label:string,icon:string}> = { shoulder:{label:'Плечо',icon:'🤸'}, knee:{label:'Колено',icon:'🦵'}, hip:{label:'Таз',icon:'🦵'}, spine:{label:'Поясница',icon:'🦴'}, lower_back:{label:'Поясница',icon:'🦴'}, elbow:{label:'Локоть',icon:'💪'}, wrist:{label:'Запястье',icon:'🤚'}, ankle:{label:'Голеностоп',icon:'🦶'}, neck:{label:'Шея',icon:'🧣'} };
                return (
                  <CollapsibleCard title="1 · Нагрузка по суставам" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(96,165,250,0.03))', color: '#60a5fa' }}>
                    <div style={{ display:'grid', gap:6 }}>
                      {entries.map(([joint, peak])=>{
                        const meta = RU[joint] || {label: joint, icon:'🦴'};
                        const avg = normAvg[joint] || 0;
                        const thresh = d.thresholds as any;
                        const lvl = (peak as number) > thresh.high ? 'high' : (peak as number) > thresh.moderate ? 'moderate' : (peak as number) > thresh.low ? 'low' : 'none';
                        const color = lvl==='high'?'#ef4444': lvl==='moderate'?'#f59e0b': lvl==='low'?'#eab308':'#22c55e';
                        const levelRu = lvl==='high'?'высокий': lvl==='moderate'?'умеренный': lvl==='low'?'низкий':'минимальный';
                        const pct = Math.min(100, ((peak as number)/(thresh.high*1.5))*100);
                        const tip = lvl==='high' ? 'Снизьте объём на 20–30% · RIR +1–2 · замените часть high-стресс упражнений на тренажёры/блоки' : lvl==='moderate' ? 'Держите технику, чередуйте тяжёлые и лёгкие дни, не ставьте тяжёлые подряд' : 'В пределах нормы — сохраняйте технику и контроль RIR';
                        return (
                          <div key={joint} style={{ padding:'8px 9px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:`1px solid ${color}18` }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:11, fontWeight:800, color:'#fff', display:'flex', alignItems:'center', gap:6 }}><span>{meta.icon}</span>{meta.label}</span>
                              <span style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:20, background: color+'18', color, border:`1px solid ${color}22` }}>{levelRu}</span>
                            </div>
                            <div style={{ display:'flex', gap:8, marginTop:4, alignItems:'center', fontSize:11 }}>
                              <span style={{ color:'#fff', fontWeight:700 }}>пик {Math.round(peak as number)}</span>
                              <span style={{ color:'#fff', opacity:0.7 }}>средн. {Math.round(avg as number)}</span>
                              <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', opacity:0.55 }}>пороги {thresh.low} / {thresh.moderate} / {thresh.high}</span>
                            </div>
                            <div style={{ height:5, borderRadius:5, background:'rgba(255,255,255,0.08)', marginTop:6, overflow:'hidden' }}>
                              <div style={{ width:`${pct}%`, height:'100%', background: color }} />
                            </div>
                            <div style={{ fontSize:10, color:'#fff', opacity:0.72, marginTop:4, lineHeight:1.35 }}>{tip}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize:9, color:'#fff', opacity:0.42, marginTop:6, lineHeight:1.3 }}>Расчёт: база 3/6/10 (low/med/high из каталога) × подходы × близость к отказу × вес. Сумма по упражнениям → пик и среднее по неделям (без учёта разгрузочных).</div>
                  </CollapsibleCard>
                );
              })()}

              {/* 2 · Ортопедия */}
              {(() => {
                const o = safetyScore.details?.orthopedic;
                if (!o) return null;
                const phaseRu = o.phase==='acute'?'Острая': o.phase==='subacute'?'Подострая': o.phase==='chronic'?'Хроническая':'Поддержание';
                const phaseColor = o.phase==='acute'?'#ef4444': o.phase==='subacute'?'#f59e0b': o.phase==='chronic'?'#60a5fa':'#22c55e';
                const PAT_RU: Record<string,string> = { squat:'присед', hinge:'наклон/тяга', lunge:'выпад', carry:'перенос', vertical_push:'жим вертик.', horizontal_push:'жим гориз.', vertical_pull:'тяга вертик.', horizontal_pull:'тяга гориз.', rotation:'вращение', anti_rotation:'анти-вращение', accessory:'изоляция' };
                const tr = (p:string)=> PAT_RU[p] || p;
                const jLabel = (j:string)=> ({ shoulder:'Плечо', spine:'Поясница', hip:'Таз', knee:'Колено', elbow:'Локоть', ankle:'Голеностоп', wrist:'Запястье', lower_back:'Поясница', neck:'Шея'} as any)[j] || j;
                return (
                  <CollapsibleCard title="2 · Ортопедика и ограничения" defaultOpen={true} headerStyle={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(168,85,247,0.03))', color: '#a78bfa' }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>Фаза:</span>
                      <span style={{ fontSize:11, fontWeight:800, padding:'3px 8px', borderRadius:20, background: phaseColor+'18', color: phaseColor, border:`1px solid ${phaseColor}22` }}>{phaseRu}</span>
                      <span style={{ fontSize:10, color:'#fff', opacity:0.6 }}>{o.phase==='acute'?'есть боль/воспаление — щадим': o.phase==='subacute'?'3+ блока — много ограничений': o.phase==='chronic'?'1–2 блока — контроль объёма':'блоков нет — работаем в штатном режиме'}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                      <div style={{ padding:'8px 9px', borderRadius:10, background: o.blockedPatterns.length?'rgba(239,68,68,0.07)':'rgba(34,197,94,0.07)', border:`1px solid ${o.blockedPatterns.length?'rgba(239,68,68,0.14)':'rgba(34,197,94,0.14)'}` }}>
                        <div style={{ fontSize:10, fontWeight:800, color: o.blockedPatterns.length?'#ef4444':'#22c55e' }}>Исключённые паттерны</div>
                        <div style={{ fontSize:11, color:'#fff', marginTop:3, lineHeight:1.35 }}>{o.blockedPatterns.length ? o.blockedPatterns.map(tr).join(', ') : '— нет, все движения разрешены'}</div>
                      </div>
                      <div style={{ padding:'8px 9px', borderRadius:10, background:'rgba(96,165,250,0.07)', border:'1px solid rgba(96,165,250,0.14)' }}>
                        <div style={{ fontSize:10, fontWeight:800, color:'#60a5fa' }}>Разрешённые</div>
                        <div style={{ fontSize:11, color:'#fff', marginTop:3, lineHeight:1.35 }}>{o.allowedPatterns.map(tr).join(', ') || '—'}</div>
                      </div>
                    </div>
                    {Object.keys(o.romLimits).length>0 && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:'#c084fc', marginBottom:4 }}>ROM-лимиты</div>
                        <div style={{ display:'grid', gap:4 }}>
                          {Object.entries(o.romLimits as any).map(([j,lim]:any)=> (
                            <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'5px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', fontSize:11 }}>
                              <span style={{ color:'#fff' }}>{jLabel(j)}</span><span style={{ fontWeight:800, color:'#fff' }}>{lim.min}° – {lim.max}°</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Object.keys(o.jointStressLimits).length>0 && (
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:'#f59e0b', marginBottom:4 }}>Лимиты стресса по суставам (1 — жёстко, 4 — мягко)</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4 }}>
                          {Object.entries(o.jointStressLimits as any).map(([j,lim]:any)=> {
                            const col = (lim as number)<=1?'#ef4444': (lim as number)<=2?'#f59e0b':'#22c55e';
                            const bg = (lim as number)<=1?'rgba(239,68,68,0.10)': (lim as number)<=2?'rgba(245,158,11,0.10)':'rgba(255,255,255,0.04)';
                            return <div key={j} style={{ padding:'6px 6px', borderRadius:8, background:bg, border:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.7 }}>{jLabel(j)}</div><div style={{ fontSize:13, fontWeight:900, color: col }}>{String(lim)}</div></div>;
                          })}
                        </div>
                      </div>
                    )}
                    {o.recommendations.length>0 && (
                      <div>
                        <div style={{ fontSize:10, fontWeight:800, color:'#00e68a', marginBottom:4 }}>Что учесть прямо сейчас</div>
                        {o.recommendations.map((r,i)=> <div key={i} style={{ fontSize:11, color:'#fff', marginBottom:3, paddingLeft:8, borderLeft:'2px solid rgba(0,230,138,0.5)', lineHeight:1.35 }}>{r}</div>)}
                      </div>
                    )}
                  </CollapsibleCard>
                );
              })()}

              {/* 3 · Профилактика */}
              {(() => {
                const diags = (safetyScore.details?.jointDiagnoses || []) as any[];
                if (!diags || diags.length===0) return null;
                return (
                  <div style={{ borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(34,197,94,0.14)' }}>
                    <button type="button" onClick={() => setSafetyPreventionOpen(v => !v)} aria-expanded={safetyPreventionOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', cursor:'pointer', background:'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.03))', border:'none', borderBottom: safetyPreventionOpen ? '1px solid rgba(34,197,94,0.14)' : 'none', textAlign:'left' }}>
                      <span style={{ fontSize:10, fontWeight:800, color:'#22c55e', letterSpacing:0.3, textTransform:'uppercase' }}>3 · Профилактика и точечная коррекция — по каждому суставу ({diags.length})</span>
                      <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.22)', color:'#22c55e', fontSize:11, transform: safetyPreventionOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                    </button>
                    <div style={{ display: safetyPreventionOpen ? 'block' : 'none', padding:'8px 10px' }}>
                    <div style={{ fontSize:9, color:'#fff', opacity:0.55, marginBottom:8, lineHeight:1.35 }}>Каждый нагруженный сустав расписан так же детально как колено/таз: опасные структуры, фаза, метод, ассисты и протокол. Плечо и остальные показаны наравне с нагруженными.</div>
                    <div style={{ display:'grid', gap:8 }}>
                      {diags.map((jd:any)=> (
                        <CollapsibleCard key={jd.joint.id} title={`${jd.joint.icon} ${jd.joint.label}`} defaultOpen={jd.joint.id==='shoulder' || jd.joint.id==='knee' || jd.joint.id==='hip' || jd.joint.id==='spine'} headerStyle={{ background: jd.phase==='acute'?'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))': jd.phase==='subacute'?'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.06))': jd.phase==='chronic'?'linear-gradient(135deg, rgba(96,165,250,0.14), rgba(96,165,250,0.06))':'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))', color: jd.phase==='acute'?'#ef4444':jd.phase==='subacute'?'#f59e0b':jd.phase==='chronic'?'#60a5fa':'#22c55e' }} badge={jd.joint.dangerous.slice(0,2).join(' · ')}>
                          <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontSize:13 }}>{jd.joint.icon}</span>
                            <span style={{ fontSize:11, fontWeight:800, color:'#fff' }}>{jd.joint.label}</span>
                            <span style={{ fontSize:10, padding:'2px 6px', borderRadius:6, background: jd.phase==='acute'?'rgba(239,68,68,0.14)': jd.phase==='subacute'?'rgba(245,158,11,0.14)': jd.phase==='chronic'?'rgba(96,165,250,0.14)':'rgba(34,197,94,0.12)', color: jd.phase==='acute'?'#ef4444': jd.phase==='subacute'?'#f59e0b': jd.phase==='chronic'?'#60a5fa':'#22c55e', fontWeight:700 }}>{jd.phase==='acute'?'острая': jd.phase==='subacute'?'подострая': jd.phase==='chronic'?'хроническая':'поддержание'}</span>
                            <span style={{ fontSize:10, color:'#fff', opacity:0.55, marginLeft:'auto' }}>{jd.joint.dangerous.join(' · ')}</span>
                          </div>
                          <div style={{ fontSize:10, color:'#fff', opacity:0.75, lineHeight:1.35, marginBottom:6 }}>{jd.joint.description}</div>
                          {jd.joint.relatedLifts?.length>0 && <div style={{ fontSize:9, color:'#fff', opacity:0.6, marginBottom:6 }}><b>Связанные движения:</b> {jd.joint.relatedLifts.join(', ')}</div>}
                          {jd.options?.length>0 && (
                            <div style={{ display:'grid', gap:6 }}>
                                {jd.options.map((opt:any)=> {
                                 const lvlRu = opt.level==='critical'?'критический': opt.level==='high'?'высокий': opt.level==='moderate'?'умеренный':'низкий';
                                 const lvlColor = opt.level==='critical'?'#ef4444': opt.level==='high'?'#f59e0b': opt.level==='moderate'?'#60a5fa':'#22c55e';
                                 return (
                                   <CollapsibleCard key={opt.id} title={`Профилактика: ${opt.label}`} defaultOpen={false} badge={lvlRu} headerStyle={{ background: opt.level==='critical'?'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))': opt.level==='high'?'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))':'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))', color: lvlColor }}>
                                   <div style={{ padding:'0 0 2px' }}>
                                     <div style={{ fontSize:11, fontWeight:700, color: lvlColor, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}><span>{opt.label}</span><span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:6, background:lvlColor+'18', border:`1px solid ${lvlColor}22` }}>{lvlRu}</span></div>
                                     <div style={{ fontSize:10, color:'#fff', opacity:0.8, marginTop:2, lineHeight:1.35 }}>{opt.description}</div>
                                     <div style={{ fontSize:10, color:'#00e68a', marginTop:3 }}><b>Метод:</b> {opt.method}</div>
                                     {opt.assistance?.length>0 && <div style={{ fontSize:10, color:'#fff', opacity:0.7, marginTop:2 }}><b>Ассисты:</b> {opt.assistance.join(', ')}</div>}
                                     {opt.rationale && <div style={{ fontSize:9, color:'#fff', opacity:0.55, marginTop:2, fontStyle:'italic' }}>{opt.rationale}</div>}
                                     <div style={{ fontSize:10, color:'#fff', marginTop:3, padding:'3px 6px', borderRadius:6, background:'rgba(0,0,0,0.18)', display:'inline-block' }}>Протокол: {opt.protocol.sets}×{opt.protocol.reps}{opt.protocol.pct?` @${opt.protocol.pct}%`:''} · RIR{opt.protocol.rir}{opt.protocol.tempo?` · ${opt.protocol.tempo}`:''}{opt.protocol.rest?` · ${opt.protocol.rest}`:''}{opt.protocol.note?` · ${opt.protocol.note}`:''}</div>
                                   </div>
                                   </CollapsibleCard>
                                 );
                               })}
                            </div>
                          )}
                        </CollapsibleCard>
                      ))}
                    </div>
                    </div>
                  </div>
                );
              })()}

              {/* 4 · Распределение — сворачиваемая */}
              {(() => {
                const ld = safetyScore.details?.loadDistribution as any;
                if (!ld) return null;
                return (
                  <div style={{ borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(96,165,250,0.14)' }}>
                    <button type="button" onClick={() => setSafetyDistributionOpen(v => !v)} aria-expanded={safetyDistributionOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', cursor:'pointer', background:'linear-gradient(135deg, rgba(96,165,250,0.10), rgba(96,165,250,0.03))', border:'none', borderBottom: safetyDistributionOpen ? '1px solid rgba(96,165,250,0.14)' : 'none', textAlign:'left' }}>
                      <span style={{ fontSize:10, fontWeight:800, color:'#60a5fa', letterSpacing:0.3, textTransform:'uppercase' }}>4 · Недельное распределение — восстановление суставов</span>
                      <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.22)', color:'#60a5fa', fontSize:11, transform: safetyDistributionOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                    </button>
                    <div style={{ display: safetyDistributionOpen ? 'block' : 'none', padding:'8px 10px' }}>
                     <div style={{ fontSize:10, fontWeight:800, color:'#60a5fa', letterSpacing:0.3, textTransform:'uppercase', marginBottom:6 }}>4 · Недельное распределение — восстановление суставов</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
                      {ld.weekPlan.map((d:any)=> (
                        <div key={d.day} style={{ padding:'6px 4px', borderRadius:8, textAlign:'center', background: d.difficulty==='hard'?'rgba(239,68,68,0.10)': d.difficulty==='medium'?'rgba(245,158,11,0.10)': d.difficulty==='light'?'rgba(96,165,250,0.10)': d.difficulty==='rehab'?'rgba(168,85,247,0.10)':'rgba(255,255,255,0.04)', border:`1px solid ${d.difficulty==='hard'?'rgba(239,68,68,0.16)': d.difficulty==='medium'?'rgba(245,158,11,0.14)': d.difficulty==='light'?'rgba(96,165,250,0.12)':'rgba(255,255,255,0.06)'}` }}>
                          <div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Дн {d.day}</div>
                          <div style={{ fontSize:10, fontWeight:800, color:'#fff' }}>{d.difficulty==='off'?'отдых': d.difficulty==='hard'?'тяж': d.difficulty==='medium'?'сред': d.difficulty==='light'?'лёг':'реаб'}</div>
                          {d.difficulty!=='off' && <><div style={{ fontSize:9, color:'#fff' }}>V{d.volumeTarget}</div><div style={{ fontSize:9, color:'#fff', opacity:0.7 }}>I{d.intensityTarget}</div></>}
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:6 }}>
                      <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Объём</div><div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{ld.totalVolume}</div></div>
                      <div style={{ padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Интенсивность</div><div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{ld.avgIntensity}</div></div>
                      <div style={{ padding:'6px 8px', borderRadius:8, background: ld.hardDays>=4?'rgba(239,68,68,0.10)':'rgba(34,197,94,0.08)', textAlign:'center' }}><div style={{ fontSize:9, color:'#fff', opacity:0.6 }}>Тяж. дней</div><div style={{ fontSize:12, fontWeight:800, color: ld.hardDays>=4?'#ef4444':'#22c55e' }}>{ld.hardDays}</div></div>
                    </div>
                    {ld.warnings.length>0 && <div>{ld.warnings.map((w:string,i:number)=> <div key={i} style={{ fontSize:10, color:'#f59e0b', marginTop:2, lineHeight:1.3 }}>⚠ {w}</div>)}</div>}
                    </div>
                  </div>
                );
              })()}

              {/* 5 · Вывод — сворачиваемая */}
              <div style={{ borderRadius:10, overflow:'hidden', background: safetyScore.riskLevel==='dangerous'?'rgba(239,68,68,0.08)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.08)':'rgba(34,197,94,0.08)', border:`1px solid ${safetyScore.riskLevel==='dangerous'?'rgba(239,68,68,0.16)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.16)':'rgba(34,197,94,0.16)'}` }}>
                <button type="button" onClick={() => setSafetyConclusionOpen(v => !v)} aria-expanded={safetyConclusionOpen} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 10px', cursor:'pointer', background: safetyScore.riskLevel==='dangerous'?'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))': safetyScore.riskLevel==='caution'?'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.06))':'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(34,197,94,0.06))', border:'none', borderBottom: safetyConclusionOpen ? `1px solid ${safetyScore.riskLevel==='dangerous'?'rgba(239,68,68,0.16)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.16)':'rgba(34,197,94,0.16)'}` : 'none', textAlign:'left' }}>
                  <span style={{ fontSize:11, fontWeight:800, color: safetyScore.riskLevel==='dangerous'?'#ef4444': safetyScore.riskLevel==='caution'?'#f59e0b':'#22c55e' }}>{safetyScore.riskLevel==='dangerous'?'🚨 Требуется коррекция': safetyScore.riskLevel==='caution'?'⚠ На контроле — есть что улучшить':'✅ Суставы в порядке'} · 5 · Вывод</span>
                  <span style={{ width:24, height:24, borderRadius:7, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color: safetyScore.riskLevel==='dangerous'?'#ef4444': safetyScore.riskLevel==='caution'?'#f59e0b':'#22c55e', fontSize:11, transform: safetyConclusionOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.2s' }}>▼</span>
                </button>
                <div style={{ display: safetyConclusionOpen ? 'block' : 'none', padding:'9px 10px' }}>
                <div style={{ fontSize:11, fontWeight:800, color: safetyScore.riskLevel==='dangerous'?'#ef4444': safetyScore.riskLevel==='caution'?'#f59e0b':'#22c55e', display:'none' }}>
                  {safetyScore.riskLevel==='dangerous'?'🚨 Требуется коррекция': safetyScore.riskLevel==='caution'?'⚠ На контроле — есть что улучшить':'✅ Суставы в порядке'}
                </div>
                <div style={{ fontSize:11, color:'#fff', marginTop:4, lineHeight:1.45 }}>
                  {(() => {
                    const d = safetyScore.details?.jointStressDetails as any;
                    const highJoints = d ? Object.entries(d.byJointPeak as Record<string, number>).filter(([_,v])=> (v as number) > d.thresholds.high).map(([k])=> ({ shoulder:'плечо', knee:'колено', hip:'таз', spine:'поясница', lower_back:'поясница', elbow:'локоть', wrist:'запястье', ankle:'голеностоп', neck:'шея'} as any)[k] || k) : [];
                    if (highJoints.length>0) return `Перегружены: ${highJoints.join(', ')} — снизьте объём на 20–30%, повысьте RIR на 1–2, замените часть высокострессовых упражнений на тренажёры/блоки и проверьте технику.`;
                    if (d?.overallRisk==='moderate') return 'Нагрузка умеренная — следите за техникой, чередуйте тяжёлые и лёгкие дни, не ставьте тяжёлые подряд, добавляйте 5–10 мин мобилити.';
                    return 'Нагрузка сбалансирована. Сохраняйте технику, объём и равномерное распределение — суставы успевают восстанавливаться.';
                  })()}
                </div>
                {(() => {
                  const recs: string[] = [];
                  const d = safetyScore.details?.jointStressDetails as any;
                  const o = safetyScore.details?.orthopedic as any;
                  const ld = safetyScore.details?.loadDistribution as any;
                  if (d && d.overallRisk==='high') recs.push('Снизьте общий недельный объём на 10–15% или добавьте лёгкий/восстановительный день.');
                  if (o && o.blockedPatterns?.length>0) recs.push(`Избегайте паттернов: ${o.blockedPatterns.map((p:string)=> (({squat:'присед', hinge:'наклон/тяга', lunge:'выпад', carry:'перенос', vertical_push:'жим верт.', horizontal_push:'жим гориз.', vertical_pull:'тяга верт.', horizontal_pull:'тяга гориз.'} as any)[p]||p)).join(', ')} — используйте разрешённые.`);
                  if (ld && ld.hardDays>=4) recs.push('Сократите тяжёлые дни до 2–3 и разнесите их днями отдыха.');
                  if (d && Object.values((d.byJointPeak as any)||{}).some((v:any)=> v>40)) recs.push('Для пикового сустава: RIR +1–2, темп 3-1-1-0, больше машин вместо штанги, изометрия для сухожилий.');
                  if ((pedAdapt as any)?.combinedMrvMultiplier >= 1.3) recs.push('PED ×≥1.3: сухожилия отстают от мышц — при боли снижайте веса, еженедельно проверяйте суставы, коллаген/омега-3.');
                  if (recs.length===0) recs.push('Профилактика: суставная разминка 5 мин, мобилити голеностопа/плеча, контроль RIR 2–3 в базе, сон ≥7 ч.');
                  return <div style={{ marginTop:6 }}>{recs.slice(0,4).map((r,i)=> <div key={i} style={{ fontSize:10, color:'#fff', marginTop:3, paddingLeft:7, borderLeft:`2px solid ${safetyScore.riskLevel==='dangerous'?'rgba(239,68,68,0.5)': safetyScore.riskLevel==='caution'?'rgba(245,158,11,0.5)':'rgba(34,197,94,0.5)'}`, lineHeight:1.35 }}>{r}</div>)}</div>;
                })()}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
      </div>
      </div>
    )}
    </div>
  </div>
);
