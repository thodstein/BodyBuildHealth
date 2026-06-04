import React, { useEffect, useState } from 'react';
import { SummaryCard } from '../cards/SummaryCard';
import { RiskCard } from '../cards/RiskCard';
import { RecommendationCard } from '../cards/RecommendationCard';
import { registry } from '../../core/data/registry';

const SYSTEM_LABELS: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная', endocrine: 'Эндокринная', hematologic: 'Кроветворная',
  reproductive: 'Репродуктивная', musculoskeletal: 'Суставы и связки',
};

import type { LabDrugAlert } from '../../engines/lab-pharma-correlation.engine';
import { calculateHealthScore } from '../../engines/health-score.engine';
import { analyzeLabDrugCorrelation } from '../../engines/lab-pharma-correlation.engine';
import { computeLabIndexDetails, type LabIndexDetail } from '../../engines/labs-indices.engine';
import { RISK_SYSTEMS } from '../../core/constants';
import { useDataLink } from '../../core/data-link';
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
  const linked = useDataLink();
  const [labIndices, setLabIndices] = useState<Record<string, LabIndexDetail> | null>(null);
  const [healthScore, setHealthScore] = useState<{ score: number; trend: string; breakdown: { pharma: number; labs: number; nutrition: number }; recommendations: string[] } | null>(null);
  const [drugAlerts, setDrugAlerts] = useState<LabDrugAlert[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [missingLabs, setMissingLabs] = useState<string[]>([]);

  useEffect(() => {
    const computeDerived = async () => {
      const { labs, course, profile, readiness, risk } = linked;
      const settings = profile.settings;

      if (labs.length > 0) {
        setLabIndices(computeLabIndexDetails(labs));
      }

      try {
        const avg = { avgWeeklyKcal: linked.avgWeeklyKcal, avgWeeklyProtein: linked.avgWeeklyProtein };
        const nutritionLog = linked.avgWeeklyKcal > 0 ? [{ date: new Date().toISOString().slice(0, 10), total: { kcal: avg.avgWeeklyKcal, p: avg.avgWeeklyProtein, f: linked.avgWeeklyFat, c: linked.avgWeeklyCarbs, fiber: 0, water: 0, steps: 0 } }] : [];
        const hs = calculateHealthScore(labs, course, nutritionLog, avg.avgWeeklyKcal || 2500, avg.avgWeeklyProtein || 160);
        setHealthScore(hs);
      } catch {}

      try {
        const phase = settings.phase ?? 'baseline';
        const alerts = analyzeLabDrugCorrelation(labs, course, phase === 'on_cycle' ? 'on_cycle' : phase === 'pct' ? 'pct' : 'baseline');
        setDrugAlerts(alerts);
      } catch {}

      const phase = settings.phase ?? 'baseline';
      const requiredPanels = PHASE_REQUIRED_PANELS[phase] ?? PHASE_REQUIRED_PANELS.baseline;
      const requiredCodes = requiredPanels.flatMap(pid => (LAB_PANELS[pid]?.markers ?? []).map(m => m.ucumCode ?? m.id));
      const enteredCodes = new Set(labs.map(l => l.code.toUpperCase()));
      const missing = requiredCodes.filter(code => !enteredCodes.has(code.toUpperCase()));
      setMissingLabs(missing);

      const newAlerts: string[] = [];
      if (risk) {
        if (risk.overallRaw > 50) newAlerts.push(`Общий риск высокий: ${risk.overallRaw.toFixed(1)}% — рассмотрите снижение дозировок`);
      }
      if (readiness) {
        if (readiness.recovery < 40) newAlerts.push(`Восстановление критически низкое: ${readiness.recovery}%`);
        if (readiness.fatigue > 70) newAlerts.push(`Уровень усталости высокий: ${readiness.fatigue}%`);
        if (readiness.isConservative && readiness.conservativeReason) newAlerts.push(`Консервативный режим: ${readiness.conservativeReason}`);
      }
      if (drugAlerts.some(a => a.severity === 'critical' || a.severity === 'high')) {
        newAlerts.push(`${drugAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length} критическое(х) взаимодействие(й) препарата с анализами`);
      }
      if (labs.length === 0) {
        newAlerts.push('Анализы не введены — введите результаты на вкладке «Анализы»');
      } else if (missing.length > 0) {
        newAlerts.push(`Не хватает ${missing.length} обязательных анализов для фазы «${phase}»`);
      }
      setAlerts(newAlerts);
    };
    computeDerived();
  }, [linked.labs.length, linked.course.length, linked.readiness?.recovery]);

  if (!linked.risk || !linked.readiness) return <div className="screen dashboard"><div className="loading-spinner" /></div>;

  const riskResult = linked.risk;
  const readiness = linked.readiness;
  const labCount = linked.labs.length;
  const courseEntries = linked.course;

  const totalRisk = Math.round(riskResult.overallRaw);
  const riskAfterSupport = Math.round(riskResult.overallNet);
  const riskLevel = totalRisk > 60 ? 'HIGH' : totalRisk > 30 ? 'MEDIUM' : 'LOW';

  const activeDrugCount = courseEntries.length;
  const daysOnCourse = (() => {
    try {
      if (linked.profile.settings.courseStartDate) {
        const start = new Date(linked.profile.settings.courseStartDate);
        const now = new Date();
        return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }
    } catch {}
    return 0;
  })();

  const masterDb = registry.getDB();
  const systems = RISK_SYSTEMS;
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

      {healthScore && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Индекс здоровья</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: healthScore.score > 70 ? 'var(--success)' : healthScore.score > 45 ? 'var(--warning)' : 'var(--danger)' }}>{healthScore.score}</span>
              <span style={{ fontSize: 12, color: healthScore.trend === 'improving' ? 'var(--success)' : healthScore.trend === 'declining' ? 'var(--danger)' : 'var(--text-dim)' }}>
                {healthScore.trend === 'improving' ? '↗ улучшается' : healthScore.trend === 'declining' ? '↘ ухудшается' : '→ стабильно'}
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Фарма-нагрузка</div>
              <div style={{ fontWeight: 700, color: healthScore.breakdown.pharma > 70 ? 'var(--danger)' : 'var(--success)' }}>{healthScore.breakdown.pharma}%</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Лабы</div>
              <div style={{ fontWeight: 700, color: healthScore.breakdown.labs > 70 ? 'var(--success)' : 'var(--warning)' }}>{healthScore.breakdown.labs}%</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Питание</div>
              <div style={{ fontWeight: 700, color: healthScore.breakdown.nutrition > 70 ? 'var(--success)' : 'var(--warning)' }}>{healthScore.breakdown.nutrition}%</div>
            </div>
          </div>
          {healthScore.recommendations.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              {healthScore.recommendations.map((r, i) => <div key={i}>{r}</div>)}
            </div>
          )}
        </div>
      )}

      {drugAlerts.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 13, marginBottom: 6 }}>Взаимодействия препаратов с анализами</div>
          {drugAlerts.slice(0, 4).map((a, i) => (
            <div key={i} style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>{a.marker}</strong> {a.actualStatus === 'high' ? '↑' : '↓'} {a.value.toFixed(1)} — {a.drugCause.join(', ')}</span>
              <span style={{ color: a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f97316' : '#eab308', fontWeight: 600, fontSize: 11 }}>{a.severity === 'critical' ? 'КРИТИЧ.' : a.severity === 'high' ? 'ВЫСОКИЙ' : a.severity === 'med' ? 'СРЕДНИЙ' : 'НИЗКИЙ'}</span>
            </div>
          ))}
          {drugAlerts.length > 4 && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>ещё {drugAlerts.length - 4}...</div>}
        </div>
      )}

      <AlertBanner messages={alerts} />

      <div className="dashboard-stats-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 4 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Восстановление</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(readiness.recovery, 40, 70) }}>{readiness.recovery}%</div>
          <ProgressBar value={readiness.recovery} color={scoreColor(readiness.recovery, 40, 70)} />
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Питание</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(readiness.nutrition, 50, 75) }}>{readiness.nutrition}%</div>
          <ProgressBar value={readiness.nutrition} color={scoreColor(readiness.nutrition, 50, 75)} />
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Поддержка</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(readiness.support, 40, 70) }}>{readiness.support}%</div>
          <ProgressBar value={readiness.support} color={scoreColor(readiness.support, 40, 70)} />
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>Усталость</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: readiness.fatigue > 70 ? 'var(--danger)' : readiness.fatigue > 40 ? 'var(--warning)' : 'var(--success)' }}>{readiness.fatigue}%</div>
          <ProgressBar value={readiness.fatigue} color={readiness.fatigue > 70 ? 'var(--danger)' : readiness.fatigue > 40 ? 'var(--warning)' : 'var(--success)'} />
        </div>
      </div>

      <div className="dashboard-stats-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 4 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Препараты</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{activeDrugCount}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Дней на курсе</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{daysOnCourse}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Лабы</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{labCount}</div>
        </div>
      </div>

      <SectionHeader title="Системы организма" onNavigate={onNavigate} screenId="risks" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, marginBottom: 8 }}>
        {systems.map(sys => {
          const raw = riskResult.systemBreakdown?.[sys]?.raw ?? 0;
          const net = riskResult.systemBreakdown?.[sys]?.net ?? 0;
          const reduction = raw > 0 ? ((raw - net) / raw * 100) : 0;
          return (
            <div key={sys} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }} onClick={onNavigate ? () => onNavigate('risks') : undefined}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{SYSTEM_LABELS[sys] ?? sys}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {reduction > 0 && <span style={{ fontSize: 9, color: 'var(--success)' }}>-{Math.round(reduction)}%</span>}
                  <span style={{ fontSize: 12, fontWeight: 700, color: riskColor(net) }}>{Math.round(net)}%</span>
                </div>
              </div>
              <ProgressBar value={raw} color={riskColor(raw)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>Без поддержки: {Math.round(raw)}%</span>
                <span style={{ fontSize: 8, color: 'var(--success)' }}>С под.: {Math.round(net)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <SectionHeader title="Лабораторные индексы" onNavigate={onNavigate} screenId="labs" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, marginBottom: 8 }}>
        {labIndices && Object.entries(labIndices).map(([key, idx]) => {
          const pct = Math.round(idx.value * 100);
          const color = idx.value < 0.2 ? '#22c55e' : idx.value < 0.4 ? '#86efac' : idx.value < 0.6 ? '#eab308' : idx.value < 0.8 ? '#f97316' : '#ef4444';
          return (
            <div key={key} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }} onClick={onNavigate ? () => onNavigate('risks') : undefined}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{idx.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{pct}%</span>
              </div>
              <ProgressBar value={pct} color={color} />
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{idx.interpretation}</div>
              {idx.markers.length > 0 && idx.markers.some(m => m.ratio > 0) && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                  {idx.markers.filter(m => m.ratio > 0).map(m => (
                    <span key={m.code} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'var(--bg-tertiary, #1a1a2e)' }}>{m.code}: {m.value.toFixed(1)} ({Math.round(m.weight * 100)}%)</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {(!labIndices || Object.keys(labIndices).length === 0) && (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', color: 'var(--text-dim)', fontSize: 11, padding: 12 }}>
            Введите анализы для расчёта индексов
          </div>
        )}
      </div>

      <SectionHeader title="Ключевые риски" onNavigate={onNavigate} screenId="risks" />
      <div className="grid risks">
        {risks.map(r => <RiskCard key={r.id} risk={r} />)}
      </div>

      <SectionHeader title="Рекомендации" onNavigate={onNavigate} screenId="support" />
      <div className="grid recs">
        {recs.map(r => <RecommendationCard key={r.recId} rec={r} />)}
      </div>

      <div style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 8, fontSize: 14 }}>Быстрый доступ</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={onNavigate ? () => onNavigate('marketplace') : undefined}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>&#128722;</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Маркетплейс</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Препараты и БАДы</div>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={onNavigate ? () => onNavigate('articles') : undefined}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>&#128218;</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Статьи</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>База знаний</div>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={onNavigate ? () => onNavigate('assistant') : undefined}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>&#129302;</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Ассистент</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Чекапы и ответы</div>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={onNavigate ? () => onNavigate('reports') : undefined}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>&#128202;</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Отчёты</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Экспорт и печать</div>
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