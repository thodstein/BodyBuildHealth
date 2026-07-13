/**
 * BioStackAIClinicalBuild.tsx
 *
 * Вкладка «🔬 Клинический подбор» BioStack AI.
 *
 * НЕ гадает дозы и состав — вызывает buildClinicalStack (biostack-clinical-recommender),
 * который переиспользует движок калькулятора поддержки (runSupportUnified) как источник
 * истины, берёт канонические дозировки и пропускает кандидатов через клинический шлюз
 * безопасности selectStack. Отображает состав, дозы, механизмы ТЗ, риск до/после,
 * отсеянные (с причиной) и лаб-коррекции.
 */

import React, { useState } from 'react';
import { GlassCard, PillBtn, inputS } from './BioStackAIConstants';
import type { BioStackProfile } from '../../engines/biostack-ai.engine';
import type { LabCompositeResult } from '../../engines/lab-analysis.engine';
import { buildClinicalStack, type ClinicalStackResult } from '../../engines/biostack-clinical-recommender';
import type { StackStrategy } from '../../engines/biostack-clinical-v2.engine';
import { showToast, initBioToast } from './BioStackAIConstants';

interface Props {
  profile: BioStackProfile;
  stackIds: string[];
  setStackIds: (ids: string[]) => void;
  labAnalysis?: LabCompositeResult | null;
  linked?: any;
}

const STRATEGIES: { id: StackStrategy; label: string }[] = [
  { id: 'comprehensive', label: 'Полный' },
  { id: 'safe', label: 'Безопасный' },
  { id: 'budget', label: 'Бюджет' },
];

export const BioStackAIClinicalBuild: React.FC<Props> = ({
  profile,
  setStackIds,
  labAnalysis,
  linked,
}) => {
  const [strategy, setStrategy] = useState<StackStrategy>('comprehensive');
  const [result, setResult] = useState<ClinicalStackResult | null>(null);
  const [building, setBuilding] = useState(false);
  initBioToast();

  // неделя курса из linked (если есть данные фармы)
  const courseWeek = linked?.pharma?.week ?? linked?.courseWeek ?? 1;

  const onBuild = () => {
    setBuilding(true);
    // даём UI перерисоваться
    setTimeout(() => {
      try {
        const r = buildClinicalStack(profile, {
          strategy,
          lab: labAnalysis ?? null,
          courseWeek: typeof courseWeek === 'number' ? courseWeek : 1,
        });
        setResult(r);
      } catch (e: any) {
        showToast('Ошибка подбора: ' + (e?.message || e), 'error');
      } finally {
        setBuilding(false);
      }
    }, 10);
  };

  const onToPlan = () => {
    if (!result) return;
    const ids = result.substances.map((s) => s.id);
    localStorage.setItem(
      'he_biostack_to_plan',
      JSON.stringify({ stackIds: ids, name: 'Клинический подбор (BioStack)' }),
    );
    setStackIds(ids);
    showToast(`Клинический стек (${ids.length}) отправлен в план поддержки`, 'success');
  };

  return (
    <div style={{ padding: 12 }}>
      <GlassCard
        title="🔬 Клинический подбор"
        icon="🧬"
        color="#00e68a"
      >
        <div style={{ fontSize: 12, color: 'rgba(235,235,245,0.7)', lineHeight: 1.5 }}>
          Стек собирается <b>движком калькулятора поддержки</b> (тот же источник истины, что и
          раздел «Калькулятор поддержки»). BioStack не придумывает дозы — берутся канонические
          значения и механизмы ТЗ, затем вещества проходят клинический шлюз безопасности
          (противопоказания, ЛС-конфликты, верхние пределы, лаб-коррекции).
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STRATEGIES.map((s) => (
            <PillBtn
              key={s.id}
              active={strategy === s.id}
              onClick={() => setStrategy(s.id)}
              color="#00e68a"
              small
            >
              {s.label}
            </PillBtn>
          ))}
        </div>

        <button
          onClick={onBuild}
          disabled={building}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '12px',
            borderRadius: 12,
            border: 'none',
            background: building
              ? 'rgba(0,230,138,0.4)'
              : 'linear-gradient(135deg,#00e68a,#00b4d8)',
            color: '#00120c',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {building ? 'Собираю…' : '⚕️ Собрать клинический стек'}
        </button>
      </GlassCard>

      {result && (
        <>
          {/* Риск до/после + покрытие */}
          <GlassCard title="📊 Результат" icon="📈" color="#60a5fa" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 11, color: 'rgba(235,235,245,0.6)' }}>Риск до поддержки</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{result.riskBefore}</div>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 11, color: 'rgba(235,235,245,0.6)' }}>Риск после поддержки</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#00e68a' }}>
                  {result.riskAfter}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 11, color: 'rgba(235,235,245,0.6)' }}>Покрытие</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{result.coveragePercent}%</div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(235,235,245,0.55)' }}>
              Источник: {result.sourceOfTruth} · неделя курса {result.courseWeek}
            </div>
          </GlassCard>

          {/* Состав */}
          <GlassCard title={`💊 Состав (${result.substances.length})`} icon="💊" color="#a78bfa" style={{ marginTop: 12 }}>
            {result.substances.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#00e68a', fontWeight: 700 }}>
                    {s.doseDisplay || `${s.doseMg} мг`}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(235,235,245,0.6)' }}>
                  {s.timing} · tier {s.tier}
                </div>
                {s.tzMechanisms.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {s.tzMechanisms.slice(0, 5).map((m) => (
                      <span
                        key={m.mechId}
                        style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: 'rgba(96,165,250,0.18)',
                          color: '#93c5fd',
                        }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                )}
                {s.mechanismReason && (
                  <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(235,235,245,0.5)' }}>
                    {s.mechanismReason}
                  </div>
                )}
              </div>
            ))}
          </GlassCard>

          {/* Отсеянные */}
          {result.excluded.length > 0 && (
            <GlassCard title={`⛔ Отсеяно шлюзом (${result.excluded.length})`} icon="🛡️" color="#f87171" style={{ marginTop: 12 }}>
              {result.excluded.map((x, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{x.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(235,235,245,0.6)' }}>{x.reason}</div>
                </div>
              ))}
            </GlassCard>
          )}

          {/* Лаб-коррекции */}
          {result.safety.labAdjustments.length > 0 && (
            <GlassCard title="🔬 Лабораторные коррекции" icon="🧪" color="#f59e0b" style={{ marginTop: 12 }}>
              {result.safety.labAdjustments.map((a: any, i: number) => (
                <div key={i} style={{ padding: '6px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>
                  • {a.message || a.reason || JSON.stringify(a)}
                </div>
              ))}
            </GlassCard>
          )}

          {/* Мониторинг + инструкции */}
          {result.monitoring.length > 0 && (
            <GlassCard title="🩺 Мониторинг" icon="📋" color="#34d399" style={{ marginTop: 12 }}>
              {result.monitoring.map((m, i) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>
                  • {m}
                </div>
              ))}
            </GlassCard>
          )}
          {result.specialInstructions.length > 0 && (
            <GlassCard title="📌 Особые указания" icon="⚠️" color="#fbbf24" style={{ marginTop: 12 }}>
              {result.specialInstructions.map((m, i) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>
                  • {m}
                </div>
              ))}
            </GlassCard>
          )}

          {/* Конфликты */}
          {result.conflicts.length > 0 && (
            <GlassCard title="🔗 Конфликты" icon="⚡" color="#c084fc" style={{ marginTop: 12 }}>
              {result.conflicts.map((m, i) => (
                <div key={i} style={{ padding: '4px 0', fontSize: 11, color: 'rgba(235,235,245,0.75)' }}>
                  • {m}
                </div>
              ))}
            </GlassCard>
          )}

          <button
            onClick={onToPlan}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg,#00e68a,#00b4d8)',
              color: '#00120c',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ➕ Отправить в план поддержки ({result.substances.length})
          </button>
        </>
      )}
    </div>
  );
};

export default BioStackAIClinicalBuild;
