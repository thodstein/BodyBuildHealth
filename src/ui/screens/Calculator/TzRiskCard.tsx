import React, { useState } from 'react';
import type { TzSpecResult, TzSpecOrganResult, TzSpecMechanismResult } from '../../../engines/risk-engine-tz-spec';
import { getCategoryLabel } from '../../../engines/risk-engine-tz-spec';
import { GLASS } from './Calc.types';

const ACCENT = '#00e68a';

const SYSTEM_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  cardio:       { accent: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.20)' },
  hepatic:      { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.20)' },
  renal:        { accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.20)' },
  cns:          { accent: '#a855f7', bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.20)' },
  reproductive: { accent: '#ec4899', bg: 'rgba(236,72,153,0.08)',  border: 'rgba(236,72,153,0.20)' },
  hematologic:  { accent: '#14b8a6', bg: 'rgba(20,184,166,0.08)',  border: 'rgba(20,184,166,0.20)' },
};

const riskColor = (pct: number): string => {
  if (pct < 25) return '#22c55e';
  if (pct < 50) return '#eab308';
  if (pct < 75) return '#f97316';
  return '#ef4444';
};

const riskLabel = (pct: number): string => {
  if (pct < 25) return 'Низкий';
  if (pct < 50) return 'Умеренный';
  if (pct < 75) return 'Высокий';
  return 'Очень высокий';
};

interface Props {
  tz: TzSpecResult;
  before: number;
  after: number;
  /** Неделя пика курса (значения before/after — пиковые, а не текущие). */
  peakWeek?: number;
}

export const TzRiskCard: React.FC<Props> = ({ tz, before, after, peakWeek }) => {
  const [expandedOrgan, setExpandedOrgan] = useState<string | null>(null);
  const noData = tz?.riskStatus === 'no_data';
  const organs = noData ? [] : (Array.isArray(tz?.organs) ? tz.organs : []);

  return (
    <div className="calc-tzrisk" style={{ ...GLASS, padding: '10px 12px', marginTop: 6, marginBottom: 6 }}>
      {/* ── Заголовок ── */}
      <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 3, height: 14, borderRadius: 2, background: ACCENT, display: 'inline-block' }} />
        Интегральный риск
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginLeft: 'auto' }}>
          R = &Sigma;(w &times; m &times; E &times; U &times; &Pi;(1&minus;k*)) &middot; union
        </span>
      </div>

      {/* ── Честность расчёта: не смоделированные препараты ── */}
      {tz.riskStatus && tz.riskStatus !== 'ok' && (
        <div style={{
          padding: '7px 9px', borderRadius: 8, marginBottom: 9,
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)',
          fontSize: 8, lineHeight: 1.55, color: '#fca5a5',
        }}>
          <div style={{ fontWeight: 800, marginBottom: 2 }}>
            ⚠ {tz.riskStatus === 'no_data' ? 'Риск НЕ рассчитан' : 'Расчёт неполный'}
          </div>
          <div>
            {tz.riskStatus === 'no_data'
              ? 'Ни один препарат курса не сопоставлен механизм-модели — цифры ниже были бы выдуманными.'
              : 'Часть препаратов не сопоставлена механизм-модели, их вклад принят за 0 — риск занижен.'}
          </div>
          {tz.unmodeledDrugs?.length > 0 && (
            <div style={{ marginTop: 3, color: 'rgba(255,255,255,0.75)' }}>
              Не учтено: <b>{tz.unmodeledDrugs.join(', ')}</b>
            </div>
          )}
        </div>
      )}

      {/* ── Hero: before → after ── */}
      {tz.riskStatus === 'no_data' ? (
        <div style={{
          textAlign: 'center', padding: '14px 10px', borderRadius: 10, marginBottom: 8,
          background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.35)', lineHeight: 1 }}>—</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            Добавьте препараты курса, которые модель знает (ААС, GH, инсулин, кленбутерол, T3/T4).
          </div>
        </div>
      ) : (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 8, color: '#f87171', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Без поддержки</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: riskColor(before), lineHeight: 1 }}>
            {Math.round(before)}
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>%</span>
          </div>
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.2)', fontWeight: 300 }}>&rarr;</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 8, color: '#4ade80', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>С поддержкой</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: riskColor(after), lineHeight: 1 }}>
            {Math.round(after)}
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>%</span>
          </div>
        </div>
      </div>
      )}

      {/* ── Поддержка, не имеющая механизмов ТЗ ── */}
      {tz.unmappedSupport && tz.unmappedSupport.length > 0 && (
        <div style={{
          padding: '5px 8px', borderRadius: 6, marginBottom: 8,
          background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)',
          fontSize: 7.5, lineHeight: 1.5, color: '#fbbf24',
        }}>
          Не участвуют в покрытии (нет привязки к 28 механизмам): {tz.unmappedSupport.join(', ')}
        </div>
      )}

      {/* ── Поддержка с ОЦЕНОЧНЫМИ механизмами (выведены из каталога, q=C) ──
          Такие k правдоподобны, но не доказаны: без этой строки процент
          покрытия читался бы как посчитанный по ТЗ-таблице. */}
      {tz.derivedSupport && tz.derivedSupport.length > 0 && (
        <div style={{
          padding: '5px 8px', borderRadius: 6, marginBottom: 8,
          background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.22)',
          fontSize: 7.5, lineHeight: 1.5, color: '#c4b5fd',
        }}>
          Оценочно (механизмы выведены из каталога, q=C, k≤0.12): {tz.derivedSupport.join(', ')}
        </div>
      )}

      {/* ── Статус + Kp ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{
          padding: '3px 12px', borderRadius: 12,
          background: riskColor(after) + '18',
          border: `1px solid ${riskColor(after)}33`,
          fontSize: 10, fontWeight: 700, color: riskColor(after),
        }}>
          {noData ? 'Не рассчитано' : <>{riskLabel(after)} &middot; Kp={tz.k_protect_overall}%{peakWeek ? ` · пик курса — нед ${peakWeek}` : ''}</>}
        </div>
      </div>

      {/* ── Progress bar ── */}
      {!noData && (
      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: `linear-gradient(90deg, #22c55e, ${riskColor(after)})`,
          width: `${Math.min(100, after)}%`,
          transition: 'width 0.6s ease',
        }} />
      </div>
      )}

      {/* ── Stats row ── */}
      {!noData && (
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, fontSize: 8, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
        <span>D_cov: {tz.d_cov.toFixed(1)}</span>
        <span>U: &times;{tz.u_i.toFixed(2)}</span>
        <span>Поддержка: {tz.supportCount} веществ</span>
      </div>
      )}

      {/* ── Верификация анализами ── */}
      {tz.overallVerification !== undefined && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '4px 8px', borderRadius: 6,
          background: tz.overallVerification >= 0.5 ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${tz.overallVerification >= 0.5 ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.25)'}`,
          fontSize: 8, color: tz.overallVerification >= 0.5 ? '#4ade80' : '#fbbf24',
        }}>
          {tz.overallVerification >= 0.5 ? '🔬' : '⚠'} Индекс риска · верифицировано анализами: {Math.round(tz.overallVerification * 100)}% систем
          {tz.overallVerification < 0.5 && <span style={{ color: 'rgba(255,255,255,0.5)' }}>— оценка по фармакологии, сдайте анализы</span>}
        </div>
      )}

      {/* ── Системы ── */}
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
        Риск по системам
      </div>

       {organs.map((organ: TzSpecOrganResult) => {
         const sc = SYSTEM_COLORS[organ.id] || { accent: ACCENT, bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' };
         const isExpanded = expandedOrgan === organ.id;
         const delta = organ.rawPercent - organ.afterPercent;
         const mechanisms = Array.isArray(organ.mechanisms) ? organ.mechanisms : [];
         const protectedMechs = mechanisms.filter(m => m.k_used > 0).length;
         const totalMechs = mechanisms.length;

        return (
          <div key={organ.id} style={{
            marginBottom: 5, borderRadius: 10, overflow: 'hidden',
            border: `1px solid ${sc.border}`,
            background: sc.bg,
          }}>
            {/* Header */}
            <div onClick={() => setExpandedOrgan(isExpanded ? null : organ.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              cursor: 'pointer', userSelect: 'none',
            }}>
              <span style={{ fontSize: 16 }}>{organ.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{organ.name}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
                  {totalMechs} мех. &middot; защищено {protectedMechs}/{totalMechs}
                  {delta > 0 && <span style={{ color: '#4ade80', marginLeft: 4 }}>&darr;{Math.round(delta)}%</span>}
                  {organ.verification !== undefined && organ.verification < 0.5 && (
                    <span style={{ color: '#fbbf24', marginLeft: 4 }}>⚠ не верифицировано</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: riskColor(organ.afterPercent) }}>
                  {Math.round(organ.afterPercent)}
                  <span style={{ fontSize: 8, fontWeight: 400, opacity: 0.6 }}>%</span>
                </div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>
                  raw {Math.round(organ.rawPercent)}%
                </div>
              </div>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginLeft: 1 }}>
                {isExpanded ? '\u25B2' : '\u25BC'}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ height: 2, background: 'rgba(0,0,0,0.2)', margin: '0 10px', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${Math.min(100, organ.afterPercent)}%`,
                background: sc.accent, borderRadius: 1, transition: 'width 0.5s ease',
              }} />
            </div>

            {/* Expanded mechanisms */}
                 {isExpanded && (
               <div style={{ padding: '5px 10px 8px', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: 3 }}>
                  {mechanisms.map((m: TzSpecMechanismResult) => {
                   const hasProtection = m.k_used > 0;
                   const beforePct = organ.maxRaw ? Math.min(100, Math.round((m.raw / organ.maxRaw) * 100)) : Math.round(m.raw);
                   const afterPct = organ.maxRaw ? Math.min(100, Math.round((m.afterSupport / organ.maxRaw) * 100)) : Math.round(m.afterSupport);
                   return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                      borderRadius: 6, marginBottom: 2,
                      background: hasProtection ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.02)',
                      border: hasProtection ? '1px solid rgba(0,230,138,0.10)' : '1px solid transparent',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>
                          {m.name}
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 7, color: '#8b5cf6', fontWeight: 600, padding: '1px 5px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            w={m.weight}
                          </span>
                          <span style={{ fontSize: 7, color: '#f59e0b', fontWeight: 600, padding: '1px 5px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            m={m.m_i}
                          </span>
                          <span style={{ fontSize: 7, color: '#3b82f6', fontWeight: 600, padding: '1px 5px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            E={m.E_i.toFixed(1)}
                          </span>
                        </div>
                      </div>
                       <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                         <div style={{ fontSize: 9, fontWeight: 700, color: riskColor(afterPct) }}>
                           {beforePct}% &rarr; {afterPct}%
                         </div>
                         {hasProtection && (
                           <div style={{ fontSize: 7, color: ACCENT, fontWeight: 600 }}>
                             &darr;{m.k_used}% &middot; Q={m.q_label}
                           </div>
                         )}
                       </div>
                    </div>
                  );
                })}
                {organ.floors && organ.floors.length > 0 && (
                  <div style={{ marginTop: 4, padding: '4px 6px', borderRadius: 6, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {organ.floors.map((f, i) => (
                      <div key={i} style={{ fontSize: 7, color: '#fca5a5', lineHeight: 1.5 }}>
                        ⚓ {f.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
