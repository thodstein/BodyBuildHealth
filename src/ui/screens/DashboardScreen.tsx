import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SummaryCard } from '../cards/SummaryCard';
import { SystemCard } from '../cards/SystemCard';
import { RiskCard } from '../cards/RiskCard';
import { RecommendationCard } from '../cards/RecommendationCard';
import { registry } from '../../core/data/registry';

const SYSTEM_LABELS: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная', endocrine: 'Эндокринная', hematologic: 'Кроветворная',
  reproductive: 'Репродуктивная', musculoskeletal: 'Суставы и связки',
};

import type { MasterDB, RiskResult, ReadinessScores, CourseEntry, LabPoint } from '../../core/types';
import { calculateRisks } from '../../engines/risk.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { calcReadiness } from '../../engines/readiness.engine';
import { generateSupportStack } from '../../engines/support.engine';
import { RISK_SYSTEMS } from '../../core/constants';
import { db } from '../../core/db';
import { getProfile } from '../../core/profile-manager';
import { PHASE_REQUIRED_PANELS, LAB_PANELS } from '../../data/labs-phase-panels';

type ScreenId = 'dashboard' | 'pharma' | 'course' | 'peptides' | 'nutrition' | 'plan' | 'substances' | 'labs' | 'risks' | 'profile' | 'predictive' | 'marketplace' | 'articles' | 'assistant' | 'gamification' | 'fertility-pct' | 'calculators' | 'reports' | 'integrations' | 'role-management' | 'support';

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
  const [masterDb, setMasterDb] = useState<MasterDB | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [readiness, setReadiness] = useState<ReadinessScores | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [prevRecovery, setPrevRecovery] = useState<number | undefined>(undefined);
  const prevRecoveryRef = useRef<number | undefined>(undefined);
  const [courseEntries, setCourseEntries] = useState<CourseEntry[]>([]);
  const [labCount, setLabCount] = useState(0);
  const [missingLabs, setMissingLabs] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
    const data = registry.getDB();
    setMasterDb(data);

    const profile = getProfile();
    const settings = profile.settings;

    let courseData: CourseEntry[] = [];
    let labData: (LabPoint & { patientId?: string })[] = [];
    let missingRequiredLabs: string[] = [];
    try {
      await db.init();
      courseData = await db.getAll<CourseEntry>('course_log');
      setCourseEntries(courseData);
      labData = await db.getAll<LabPoint & { patientId?: string }>('labs_log');
      const userLabs = labData.filter(l => l.patientId === 'current-user');
      setLabCount(userLabs.length);

      const phase = settings.phase ?? 'baseline';
      const requiredPanels = PHASE_REQUIRED_PANELS[phase] ?? PHASE_REQUIRED_PANELS.baseline;
      const requiredCodes = requiredPanels.flatMap(pid => (LAB_PANELS[pid]?.markers ?? []).map(m => m.ucumCode ?? m.id));
      const enteredCodes = new Set(userLabs.map(l => l.code.toUpperCase()));
      missingRequiredLabs = requiredCodes.filter(code => !enteredCodes.has(code.toUpperCase()));
      setMissingLabs(missingRequiredLabs);
    } catch {}

    const activeDrugs: Record<string, { dosePerWeek: number }> = {};
    courseData.forEach(entry => {
      const freq = typeof entry.frequency === 'number' ? entry.frequency : entry.frequency === 'daily' ? 7 : entry.frequency === 'eod' ? 3.5 : 1;
      activeDrugs[entry.substanceId] = { dosePerWeek: entry.doseValue * freq };
    });

    const goal = settings.goal ?? settings.primaryGoal ?? 'maintenance';
    const supportSubs = generateSupportStack(goal);
    const supportCoverage: Record<string, number> = {};
    for (const sub of supportSubs) {
      if (sub.effects) {
        for (const eff of sub.effects) {
          supportCoverage[eff.effect] = (supportCoverage[eff.effect] || 0) + eff.strength;
        }
      }
    }

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

    const userLabs = labData.filter(l => l.patientId === 'current-user');
    if (userLabs.length > 0) {
      const labRisks = calculateRiskFromAnalyses(userLabs);
      if (risk.systemBreakdown) {
        for (const sys of RISK_SYSTEMS) {
          if (risk.systemBreakdown[sys]) {
            const labVal = labRisks.systemContributions?.[sys as keyof typeof labRisks.systemContributions] ?? 0;
            risk.systemBreakdown[sys].raw = Math.max(risk.systemBreakdown[sys].raw, labVal);
          }
        }
      }
    }
    setRiskResult(risk);

    const daysOnCourse = (() => {
      if (settings.courseStartDate) {
        const start = new Date(settings.courseStartDate);
        const now = new Date();
        return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }
      return 0;
    })();

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
    if (highRisks.length > 0)     newAlerts.push(`${highRisks.length} риск(ов) высокого уровня`);

    const userLabCount = labData.filter(l => l.patientId === 'current-user').length;
    if (userLabCount === 0) {
      newAlerts.push('Анализы не введены — введите результаты на вкладке «Анализы» для точного расчёта рисков');
    } else if (missingRequiredLabs.length > 0) {
      newAlerts.push(`Не хватает ${missingRequiredLabs.length} обязательных анализов для фазы «${settings.phase ?? 'baseline'}»`);
    }

    setAlerts(newAlerts);
    setPrevRecovery(prevRecoveryRef.current);
    prevRecoveryRef.current = rdy.recovery;
    };
    loadData();
  }, []);

  if (!masterDb || !riskResult || !readiness) return <div className="screen dashboard"><div className="loading-spinner" /></div>;

  const totalRisk = Math.round(riskResult.overallRaw);
  const riskAfterSupport = Math.round(riskResult.overallNet);
  const riskLevel = totalRisk > 60 ? 'HIGH' : totalRisk > 30 ? 'MEDIUM' : 'LOW';

  const activeDrugCount = courseEntries.length || (Object.keys(riskResult.systemBreakdown).length > 0 ? Math.min(masterDb.substances.length, 5) : 0);
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

  const systems = masterDb.systems.slice(0, 6);
  const risks = masterDb.risks.slice(0, 4);
  const recs = masterDb.recommendations.slice(0, 5);

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
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <h1>Health Engine</h1>
          <p>Панель состояния здоровья</p>
        </div>
      </div>

      {labCount === 0 && (
        <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14, marginBottom: 4 }}>&#9888; Анализы не введены</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Для расчёта рисков и рекомендаций необходимо ввести результаты анализов. Перейдите на вкладку «Анализы».</div>
        </div>
      )}
      {labCount > 0 && missingLabs.length > 0 && (
        <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 14, marginBottom: 4 }}>&#9888; Не хватает {missingLabs.length} анализов</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Для полной оценки введите недостающие показатели: {missingLabs.slice(0, 5).join(', ')}{missingLabs.length > 5 ? '...' : ''}</div>
        </div>
      )}
      <SummaryCard totalRisk={totalRisk} riskAfterSupport={riskAfterSupport} riskLevel={riskLevel} />

      <AlertBanner messages={alerts} />

      <div className="dashboard-stats-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 4 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Восстановление</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(readiness.recovery, 40, 70) }}>{readiness.recovery}%<TrendArrow current={readiness.recovery} previous={prevRecovery} /></div>
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

      <div className="dashboard-stats-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 4 }}>
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
          <div style={{ fontSize: 18, fontWeight: 700 }}>{labCount}</div>
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
              <span style={{ fontSize: 12, fontWeight: 600 }}>{SYSTEM_LABELS[sys] ?? sys}</span>
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

      <SectionHeader title="Рекомендации" onNavigate={onNavigate} screenId="support" />
      <div className="grid recs">
        {recs.map(r => <RecommendationCard key={r.recId} rec={r} />)}
      </div>

      <div style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 10 }}>Быстрый доступ</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={onNavigate ? () => onNavigate('marketplace') : undefined}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>&#128722;</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Маркетплейс</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Препараты и БАДы</div>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={onNavigate ? () => onNavigate('articles') : undefined}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>&#128218;</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Статьи</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>База знаний</div>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={onNavigate ? () => onNavigate('assistant') : undefined}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>&#129302;</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Ассистент</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Чекапы и ответы</div>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={onNavigate ? () => onNavigate('reports') : undefined}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>&#128202;</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Отчёты</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Экспорт и печать</div>
          </div>
        </div>
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