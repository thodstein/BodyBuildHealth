import React, { useEffect, useState, useCallback } from 'react';
import { SummaryCard } from '../cards/SummaryCard';
import { SystemCard } from '../cards/SystemCard';
import { RiskCard } from '../cards/RiskCard';
import { RecommendationCard } from '../cards/RecommendationCard';
import { registry } from '../../core/data/registry';
import { HulkHero } from '../../App';
import type { MasterDB, RiskResult, ReadinessScores } from '../../core/types';
import { calculateRisks } from '../../engines/risk.engine';
import { calcReadiness } from '../../engines/readiness.engine';
import { getProfile } from '../../core/profile-manager';

type ScreenId = 'dashboard' | 'pharma' | 'course' | 'peptides' | 'nutrition' | 'plan' | 'substances' | 'labs' | 'risks' | 'profile' | 'predictive' | 'marketplace' | 'articles' | 'assistant' | 'gamification' | 'fertility-pct' | 'calculators' | 'reports' | 'integrations' | 'role-management';

interface Props {
  onNavigate?: (screen: ScreenId) => void;
}

function TrendArrow({ current, previous }: { current: number; previous?: number }) {
  if (previous == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 4 }}>&#8596;</span>;
  if (diff > 0) return <span style={{ color: 'var(--danger)', fontSize: 12, marginLeft: 4 }}>&#8593;{Math.abs(Math.round(diff))}</span>;
  return <span style={{ color: 'var(--success)', fontSize: 12, marginLeft: 4 }}>&#8595;{Math.abs(Math.round(diff))}</span>;
}

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  );
}

function AlertBanner({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return (
    <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
      <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 13, marginBottom: 4 }}>&#9888; Внимание</div>
      {messages.map((m, i) => (
        <div key={i} style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.6 }}>{m}</div>
      ))}
    </div>
  );
}

function SectionHeader({ title, onNavigate, screenId }: { title: string; onNavigate?: (s: ScreenId) => void; screenId: ScreenId }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 16 }}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {onNavigate && (
        <button
          onClick={() => onNavigate(screenId)}
          style={{ background: 'none', border: '1px solid var(--text-dim)', borderRadius: 6, color: 'var(--text-dim)', fontSize: 11, padding: '2px 10px', cursor: 'pointer' }}
        >
          Подробнее &#8594;
        </button>
      )}
    </div>
  );
}

export const DashboardScreen: React.FC<Props> = ({ onNavigate }) => {
  const [db, setDb] = useState<MasterDB | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [readiness, setReadiness] = useState<ReadinessScores | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [prevRisk, setPrevRisk] = useState<number | undefined>(undefined);

  useEffect(() => {
    const data = registry.getDB();
    setDb(data);

    const profile = getProfile();
    const settings = profile.settings;

    const activeDrugs: Record<string, { dosePerWeek: number }> = {};
    const drugCount = Math.min(Object.keys(data.substances).length, 3);
    const substanceIds = data.substances.slice(0, drugCount).map(s => s.id);
    substanceIds.forEach(id => {
      const threshold = (window as any).__DRUG_THRESHOLDS__?.[id];
      if (threshold) activeDrugs[id] = { dosePerWeek: threshold.dosePerWeek };
    });

    const supportCoverage: Record<string, number> = {};
    data.recommendations.slice(0, 8).forEach(r => {
      if (r.riskId) supportCoverage[r.riskId] = 0.3;
    });

    const riskInput = {
      genetics: settings.genetics,
      nutritionFactor: settings.nutritionFactor,
      trainingFactor: settings.trainingFactor,
      activeDrugs: Object.keys(activeDrugs).length > 0 ? activeDrugs : undefined,
      supportCoverage,
      biomarkerValues: undefined,
      hgiMarkers: undefined,
      interventionResponse: undefined,
      overallBiomarkerValue: undefined,
      overallHgiMarkers: undefined,
      overallInterventionResponse: undefined,
    };
    const risk = calculateRisks(riskInput);
    setRiskResult(risk);

    const readinessInput = {
      sleepHours: settings.baselineSleepHours ?? 7,
      sleepQuality: settings.baselineSleepQuality ?? 0.7,
      nightAwakenings: 1,
      hrvRatio: settings.baselineHrvRatio ?? 1.2,
      doms: 2,
      stress: settings.baselineStressLevel ?? 3,
      riskCoverageMap: supportCoverage,
      calRatio: 0.85,
      proteinRatio: 0.8,
      waterRatio: 0.7,
      fiberRatio: 0.6,
      omega3Flag: settings.currentSupplements?.includes('omega3') ?? false,
      trainingLoadRatio: 0.7,
      subjFatigue: 3,
      hrIncrease: 0.1,
    };
    const rdy = calcReadiness(readinessInput);
    setReadiness(rdy);

    const newAlerts: string[] = [];
    const totalRiskPct = risk.overallRaw;
    if (totalRiskPct > 50) newAlerts.push(`Общий риск высокий: ${totalRiskPct.toFixed(1)}% — рассмотрите снижение дозировок`);
    if (rdy.recovery < 40) newAlerts.push(`Восстановление критически низкое: ${rdy.recovery}%`);
    if (rdy.fatigue > 70) newAlerts.push(`Уровень усталости высокий: ${rdy.fatigue}%`);
    if (rdy.isConservative && rdy.conservativeReason) newAlerts.push(`Консервативный режим: ${rdy.conservativeReason}`);

    const highRisks = data.risks.filter(r => r.level === 'HIGH' || r.level === 'CRITICAL');
    if (highRisks.length > 0) newAlerts.push(`${highRisks.length} риск(ов) высокого уровня`);

    setAlerts(newAlerts);
    setPrevRisk(undefined);
  }, []);

  if (!db || !riskResult || !readiness) return <div className="screen dashboard"><div className="loading-spinner" /></div>;

  const totalRisk = Math.round(riskResult.overallRaw);
  const riskAfterSupport = Math.round(riskResult.overallNet);
  const riskLevel = totalRisk > 60 ? 'HIGH' : totalRisk > 30 ? 'MEDIUM' : 'LOW';

  const activeDrugCount = Object.keys(riskResult.systemBreakdown).length > 0 ? Math.min(db.substances.length, 5) : 0;
  const daysOnCourse = (() => {
    try {
      const profile = getProfile();
      if (profile.settings.courseStartDate) {
        const start = new Date(profile.settings.courseStartDate);
        const now = new Date();
        return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }
    } catch {}
    return 0;
  })();

  const systems = db.systems.slice(0, 6);
  const risks = db.risks.slice(0, 4);
  const recs = db.recommendations.slice(0, 5);

  const scoreColor = (val: number, lowThreshold: number, highThreshold: number) => {
    if (val >= highThreshold) return 'var(--success)';
    if (val >= lowThreshold) return 'var(--warning)';
    return 'var(--danger)';
  };

  const riskColor = (val: number) => {
    if (val >= 70) return 'var(--danger)';
    if (val >= 40) return 'var(--warning)';
    return 'var(--success)';
  };

  return (
    <div className="screen dashboard">
      <HulkHero />
      <SummaryCard totalRisk={totalRisk} riskAfterSupport={riskAfterSupport} riskLevel={riskLevel} />

      <AlertBanner messages={alerts} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 4 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Восстановление</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(readiness.recovery, 40, 70) }}>{readiness.recovery}%<TrendArrow current={readiness.recovery} previous={prevRisk} /></div>
          <ProgressBar value={readiness.recovery} color={scoreColor(readiness.recovery, 40, 70)} />
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Питание</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(readiness.nutrition, 50, 75) }}>{readiness.nutrition}%</div>
          <ProgressBar value={readiness.nutrition} color={scoreColor(readiness.nutrition, 50, 75)} />
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Поддержка</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(readiness.support, 40, 70) }}>{readiness.support}%</div>
          <ProgressBar value={readiness.support} color={scoreColor(readiness.support, 40, 70)} />
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Усталость</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: readiness.fatigue > 70 ? 'var(--danger)' : readiness.fatigue > 40 ? 'var(--warning)' : 'var(--success)' }}>{readiness.fatigue}%</div>
          <ProgressBar value={readiness.fatigue} color={readiness.fatigue > 70 ? 'var(--danger)' : readiness.fatigue > 40 ? 'var(--warning)' : 'var(--success)'} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Препараты</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{activeDrugCount}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Дней на курсе</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{daysOnCourse}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Лабы</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{db.analyses.length}</div>
        </div>
      </div>

      <SectionHeader title="Системы организма" onNavigate={onNavigate} screenId="risks" />
      <div className="grid systems">
        {systems.map(s => (
          <SystemCard
            key={s.id}
            system={s}
            onClick={onNavigate ? () => onNavigate('risks') : undefined}
          />
        ))}
      </div>

      <SectionHeader title="Системные риски" onNavigate={onNavigate} screenId="risks" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 8 }}>
        {Object.entries(riskResult.systemBreakdown).map(([sys, vals]) => (
          <div key={sys} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{sys}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: riskColor(vals.raw) }}>{vals.raw.toFixed(1)}%</span>
            </div>
            <ProgressBar value={vals.raw} color={riskColor(vals.raw)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>С поддержкой</span>
              <span style={{ fontSize: 10, color: 'var(--success)' }}>{vals.net.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>

      <SectionHeader title="Ключевые риски" onNavigate={onNavigate} screenId="risks" />
      <div className="grid risks">
        {risks.map(r => <RiskCard key={r.id} risk={r} />)}
      </div>

      <SectionHeader title="Рекомендации" onNavigate={onNavigate} screenId="plan" />
      <div className="grid recs">
        {recs.map(r => <RecommendationCard key={r.recId} rec={r} />)}
      </div>

      {readiness.isConservative && (
        <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
          <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 13 }}>&#9888; Консервативный режим</div>
          <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>{readiness.conservativeReason}</div>
        </div>
      )}
    </div>
  );
};