/**
 * bb-hub-stimulus-tab.tsx — таб «Стимул-карта» (волна 3 плана хабов: декомпозиция).
 *
 * Перенос разметки 1:1 из `BBDiagnosticsHub.tsx`: карта «где теряется рост» строится
 * по аудиту портфеля плана, объёмов здесь нет (они в 6-м табе и в Объём-хабе).
 * Компонент без состояния: всё приходит пропсами, поэтому словари/движки остаются
 * в хабе, а здесь только рендер.
 */
import React from 'react';

export interface BbStimulusTabProps {
  /** Отчёт диагностики: stimulus (global/issues/noPlan/bfrEligible). */
  report: {
    stimulus: {
      global: { lengthened: number; midRange: number; shortened: number; compound: number; isolation: number };
      issues: string[];
      /** Плана нет — карта строится не по чему (движок отдаёт флаг, может отсутствовать). */
      noPlan?: boolean;
      bfrEligible: string[];
    };
  };
  /** Аудит портфеля плана (byMuscle) или null, если плана нет. */
  planAudit: {
    byMuscle: Record<string, {
      totalSets: number;
      lengthened: number;
      shortened: number;
      avgSfr?: number | null;
      angleCoverage: { covered: number; total: number; missing: string[] };
      strictCoverage: { covered: number; total: number; missing: string[] };
    }>;
  } | null;
  /** Баланс плана (issues) или null. */
  balance: { issues: string[] } | null;
  /** Русские названия мышц — словарь живёт в хабе. */
  muscleLabelRu: Record<string, string>;
}

export const BbStimulusTab: React.FC<BbStimulusTabProps> = ({ report, planAudit, balance, muscleLabelRu: MUSCLE_LABEL_RU }) => (
  <div>
    <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Стимул-карта — где теряется рост (из плана, без объёмов)</div>
    <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: '#fff' }}>Всего: растянутых {report.stimulus.global.lengthened} · средних {report.stimulus.global.midRange} · пиковых {report.stimulus.global.shortened} · база {report.stimulus.global.compound} / изоляция {report.stimulus.global.isolation}</div>
      <div style={{ fontSize: 10, color: report.stimulus.noPlan ? '#94a3b8' : report.stimulus.issues.length ? '#f59e0b' : '#22c55e', marginTop: 4 }}>{report.stimulus.noPlan ? 'Нет плана — анализировать нечего. Собери план в ББ-авто, вернись сюда: карта покажет перекос растянутых/пиковых.' : report.stimulus.issues.join(' · ') || 'Стимул сбалансирован'}</div>
      {report.stimulus.bfrEligible.length > 0 && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 4 }}>Жгуты подходят: {report.stimulus.bfrEligible.join(', ')} (20–30%, схема 30-15-15-15, пауза 30 с)</div>}
      <div style={{ fontSize: 10, color: '#fff', marginTop: 6 }} data-bb="stimulus-chip">Разбор каждого упражнения — во вкладке <b>🏋️ Разбор → Аудит портфеля</b> (здесь карта, без дублей).</div>
    </div>
    {planAudit ? (
      <div style={{ display: 'grid', gap: 6 }} data-bb="stimulus-map">
        {Object.entries(planAudit.byMuscle).map(([m, bm]) => {
          const lenPct = bm.totalSets ? Math.round((bm.lengthened / bm.totalSets) * 100) : 0;
          const badLen = bm.totalSets >= 6 && lenPct < 30;
          const badAngle = bm.angleCoverage.total > 1 && bm.angleCoverage.covered === 1 && bm.totalSets >= 6;
          const badStrict = bm.strictCoverage.total > 0 && bm.strictCoverage.covered === 0 && bm.totalSets >= 6;
          const badShort = bm.totalSets >= 6 && bm.shortened === 0;
          const col = badLen || badAngle || badStrict || badShort ? '#f59e0b' : '#22c55e';
          return (
            <div key={m} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${col}33`, fontSize: 10, lineHeight: 1.5 }}>
              <b style={{ color: '#fff', fontSize: 11 }}>{MUSCLE_LABEL_RU[m] || m}</b>
              <span style={{ color: col, marginLeft: 6 }}>{bm.totalSets} сет · SFR {bm.avgSfr ?? '—'} · раст. {lenPct}% · углы {bm.angleCoverage.covered}/{bm.angleCoverage.total} · строгие {bm.strictCoverage.covered}/{bm.strictCoverage.total}</span>
              {(badLen || badAngle || badStrict || badShort) && (
                <div style={{ color: '#fbbf24', marginTop: 2 }}>
                  Чинить: {[badLen ? 'добавь растянутую (наклон 30°/RDL/разводка с паузой)' : null, badAngle ? `второй угол (нет: ${bm.angleCoverage.missing.slice(0, 2).join(', ')})` : null, badStrict ? `строгая группа (нет: ${bm.strictCoverage.missing.slice(0, 2).join(', ')})` : null, badShort ? 'пиковая (сечка): добей изоляцией с паузой в пике' : null].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    ) : (
      <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, color: '#fff' }}>Нет плана ББ — собери в ББ-авто, карта построится по упражнениям.</div>
    )}
    <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
      План-баланс: {balance ? balance.issues.slice(0, 2).join(' · ') : '— нет плана (собери в ББ-авто)'} · Объёмы MEV/MRV — <b>📐 Объём-хаб</b> · Качество плана — <b>→ Качество</b>
    </div>
  </div>
);

export default BbStimulusTab;
