import React, { useState, useMemo, useCallback } from 'react';
import { type BioStackProfile } from '../../engines/biostack-ai.engine';
import { buildStack, explainStack } from '../../engines/supplement-finder.engine';
import { GlassCard } from './BioStackAIConstants';
import { toFinderProfile } from './BioStackAIConstants';

export function CompareTab({ profile, stackIds, setStackIds }: { profile: BioStackProfile; stackIds: string[]; setStackIds: (ids: string[]) => void }) {
  const [optimized, setOptimized] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const currentExplanation = useMemo(() => {
    if (stackIds.length === 0) return null;
    return explainStack(stackIds, toFinderProfile(profile));
  }, [stackIds, profile]);

  const optimizedExplanation = useMemo(() => {
    if (!optimized) return null;
    return explainStack(optimized, toFinderProfile(profile));
  }, [optimized, profile]);

  const handleOptimize = useCallback(() => {
    if (stackIds.length === 0) return;
    setLoading(true);
    setTimeout(() => {
      const fp = toFinderProfile(profile);
      const result = buildStack({
        baseIds: stackIds, targetSize: Math.max(stackIds.length, 8),
        goal: profile.goals[0] || undefined,
        autoFill: true, profile: fp,
      });
      setOptimized(result.stack);
      setLoading(false);
    }, 300);
  }, [stackIds, profile]);

  const handleReplace = useCallback(() => {
    if (optimized) setStackIds(optimized);
  }, [optimized, setStackIds]);

  if (stackIds.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚖</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Стек пуст</div>
        <div style={{ fontSize: 10, maxWidth: 280, margin: '0 auto', lineHeight: 1.5 }}>Сначала соберите стек в 🔍 Поиск или 🧩 Сборка</div>
      </div>
    );
  }

  const MetricRow: React.FC<{ label: string; current: string | number; optimized: string | number; color: string; better: 'up' | 'down' | 'same' }> =
    ({ label, current, optimized, color, better }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{current}</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>→</span>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>{optimized}</span>
        <span style={{ fontSize: 7 }}>
          {better === 'up' ? '▲' : better === 'down' ? '▼' : '—'}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      <GlassCard title="⚖ Сравнение стеков" icon="📊" color="#8b5cf6">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.4 }}>
          Текущий стек: <strong style={{ color: '#fff' }}>{stackIds.length} компонентов</strong>
          {optimized ? ` → Оптимизированный: ${optimized.length} компонентов` : ''}
        </div>
        {!optimized && (
          <button onClick={handleOptimize} disabled={loading} style={{
            width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6',
          }}>
            {loading ? '⏳ Оптимизация...' : '⚡ Оптимизировать стек'}
          </button>
        )}
      </GlassCard>

      {optimized && (
        <>
          <GlassCard title="📊 Метрики" icon="📈" color="#60a5fa">
            <MetricRow label="Синергия" color="#8b5cf6"
              current={currentExplanation?.totalSynergyScore ?? 0}
              optimized={optimizedExplanation?.totalSynergyScore ?? 0}
              better={(optimizedExplanation?.totalSynergyScore ?? 0) >= (currentExplanation?.totalSynergyScore ?? 0) ? 'up' : 'down'} />
            <MetricRow label="Покрытие целей" color="#60a5fa"
              current={`${currentExplanation?.completeness ?? 0}%`}
              optimized={`${optimizedExplanation?.completeness ?? 0}%`}
              better={(optimizedExplanation?.completeness ?? 0) >= (currentExplanation?.completeness ?? 0) ? 'up' : 'down'} />
            <MetricRow label="Компонентов" color="#00e68a"
              current={stackIds.length}
              optimized={optimized.length}
              better={optimized.length !== stackIds.length ? 'up' : 'same'} />
            <MetricRow label="С дозировкой" color="#f59e0b"
              current={`${currentExplanation?.totalDoseCount ?? 0}/${stackIds.length}`}
              optimized={`${optimizedExplanation?.totalDoseCount ?? 0}/${optimized.length}`}
              better={(optimizedExplanation?.totalDoseCount ?? 0) >= (currentExplanation?.totalDoseCount ?? 0) ? 'up' : 'down'} />
            <MetricRow label="Предупреждений" color="#ef4444"
              current={currentExplanation?.warnings.length ?? 0}
              optimized={optimizedExplanation?.warnings.length ?? 0}
              better={(optimizedExplanation?.warnings.length ?? 0) <= (currentExplanation?.warnings.length ?? 0) ? 'up' : 'down'} />
          </GlassCard>

          <GlassCard title="🔍 Состав: текущий vs оптимизированный" icon="📋" color="#00e68a">
            <button onClick={() => setShowDetails(!showDetails)}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 8, cursor: 'pointer', fontWeight: 600, marginBottom: 6,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
              {showDetails ? '▲ Скрыть детали' : '▼ Показать детали'}
            </button>
            {showDetails && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 4 }}>Текущий стек:</div>
                  {currentExplanation?.substances.map(s => (
                    <div key={s.id} style={{ fontSize: 8, color: '#fff', padding: '2px 0' }}>• {s.name}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 600, marginBottom: 4 }}>Оптимизированный:</div>
                  {optimizedExplanation?.substances.map(s => (
                    <div key={s.id} style={{ fontSize: 8, color: '#00e68a', padding: '2px 0' }}>• {s.name}</div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>

          <button onClick={handleReplace} style={{
            width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginBottom: 8,
            background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.2)', color: '#00e68a',
          }}>
            📥 Заменить текущий стек оптимизированным
          </button>

          {optimizedExplanation?.warnings && optimizedExplanation.warnings.length > 0 && (
            <GlassCard title="⚠ Предупреждения оптимизированного" icon="⚠" color="#ef4444">
              {optimizedExplanation.warnings.slice(0, 5).map((w, i) => (
                <div key={i} style={{ fontSize: 8, color: '#f87171', lineHeight: 1.3, padding: '2px 0' }}>• {w}</div>
              ))}
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
