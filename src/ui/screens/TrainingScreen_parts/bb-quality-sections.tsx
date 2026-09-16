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
import { CollapsibleCard } from './bb-auto-constructor-shared';
import { PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import BbQualityV2Card from './BbQualityV2Card';

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
