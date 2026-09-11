/**
 * QualityActions.tsx — P6 Quality Hub PRO: действия хаба качества.
 * V2-оценка + применение фиксов (мост) + снапшоты/сравнение + экспорт.
 * Чистый презентационный компонент; вся логика — в quality-hub-helpers.ts.
 */
import React, { useMemo, useState } from 'react';
import type { QualityScoreV2 } from '../../../engines/quality-score-v2.engine';
import {
  QUALITY_HISTORY_CAP,
  buildQualityExportCsv,
  buildQualityExportHtml,
  compareQualitySnapshots,
  loadQualityHistory,
  removeQualitySnapshot,
  saveQualitySnapshot,
  sendQualityDeloadFix,
  sendQualityVolumeFix,
  sendQualityWeakpointsFix,
  type QualityExportInput,
  type QualitySnapshot,
} from './quality-hub-helpers';

export interface QualityActionsProps {
  programId: string;
  title: string;
  division: 'bb' | 'pl';
  level: string;
  pedLabel: string;
  base: {
    score: number;
    grade: string;
    perMuscle: Array<{ muscle: string; peakSets: number; avgSets: number; mev: number; mav: number; mrv: number; status: string }>;
  };
  v2: QualityScoreV2 | null;
  /** Перегруженные мышцы → целевой MAV (для кнопки «Снизить до MAV»). */
  overloadFix: Record<string, number>;
  /** Недогруженные/слабые группы (для кнопки «Добить»). */
  weakGroups: string[];
  needsDeload: boolean;
}

const BTN: React.CSSProperties = {
  minHeight: 44, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
  fontWeight: 800, fontSize: 11, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.02)', color: '#fff',
};
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export const QualityActions: React.FC<QualityActionsProps> = (props) => {
  const { programId, title, division, level, pedLabel, base, v2, overloadFix, weakGroups, needsDeload } = props;
  const [history, setHistory] = useState<QualitySnapshot[]>(() => loadQualityHistory());
  const [cmpA, setCmpA] = useState('');
  const [cmpB, setCmpB] = useState('');
  const [flash, setFlash] = useState('');

  const say = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(''), 4000);
  };

  const exportInput: QualityExportInput = useMemo(() => ({
    title, division, level, pedLabel,
    score: base.score, grade: base.grade,
    v2Score: v2?.score ?? null, v2Grade: v2?.grade ?? null,
    perMuscle: base.perMuscle,
    v2Issues: (v2?.issues || []).map(i => ({ id: i.id, severity: i.severity, message: i.message })),
  }), [title, division, level, pedLabel, base, v2]);

  const cmp = useMemo(() => {
    const a = history.find(h => h.id === cmpA);
    const b = history.find(h => h.id === cmpB);
    if (!a || !b) return null;
    return { a, b, ...compareQualitySnapshots(a, b) };
  }, [history, cmpA, cmpB]);

  const doSave = () => {
    const next = saveQualitySnapshot({
      programId, title, division,
      score: base.score, grade: base.grade, v2Score: v2?.score ?? null,
      perMuscle: base.perMuscle.map(p => ({ muscle: p.muscle, peakSets: p.peakSets, status: p.status })),
    });
    setHistory(next);
    say(`💾 Снапшот сохранён (${next.length}/${QUALITY_HISTORY_CAP})`);
  };

  const doExportCsv = () => {
    try {
      const csv = buildQualityExportCsv(exportInput);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quality-${division}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      say('📥 CSV выгружен');
    } catch { say('⚠ Не удалось выгрузить CSV'); }
  };

  const doPrint = (asHtmlFile: boolean) => {
    try {
      const html = buildQualityExportHtml(exportInput);
      if (asHtmlFile) {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quality-${division}-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        say('📥 HTML выгружен');
        return;
      }
      const w = window.open('', '_blank');
      if (!w) { say('⚠ Всплывающие окна заблокированы'); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      say('🖨 Печать открыта');
    } catch { say('⚠ Не удалось открыть печать'); }
  };

  const v2Color = !v2 ? '#fff' : v2.score >= 85 ? '#22c55e' : v2.score >= 65 ? '#f59e0b' : v2.score >= 45 ? '#fb923c' : '#ef4444';
  const overMuscles = Object.keys(overloadFix);

  return (
    <div data-q="quality-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
      {/* V2-оценка */}
      <div data-q="v2-score" style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: `1px solid ${v2Color}40` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: v2Color }}>V2-оценка {v2 ? `${v2.grade} · ` : ''}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: v2Color, ...NUM }}>{v2 ? <>{v2.score}<span style={{ fontSize: 11, opacity: 0.6 }}>/100</span></> : 'нет данных'}</span>
        </div>
        {v2 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(Object.entries(v2.breakdown) as Array<[string, number]>).map(([k, got]) => {
              const max = { volume: 40, frequency: 15, rir: 10, deload: 10, shoulder: 10, length: 10, load: 5 }[k] || 10;
              const pct = Math.round((got / max) * 100);
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#fff' }}>
                  <span style={{ minWidth: 70, fontWeight: 700 }}>{k}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
                  </div>
                  <span style={{ ...NUM, minWidth: 52, textAlign: 'right' }}>{got}/{max}</span>
                </div>
              );
            })}
            <div style={{ fontSize: 9, color: '#fff', marginTop: 2 }}>
              {v2.meta.hasDiary ? 'Нагрузка: по дневнику' : 'Нагрузка: нет дневника — не штрафуется'} · Сетов/нед: <span style={NUM}>{v2.meta.totalSets}</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: '#fff' }}>Недостаточно данных программы для V2-расчёта.</div>
        )}
      </div>

      {/* V2-замечания */}
      {v2 && v2.issues.length > 0 && (
        <div data-q="v2-issues" style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {v2.issues.slice(0, 8).map(i => (
            <div key={i.id} style={{ fontSize: 10, color: i.severity === 'critical' ? '#ef4444' : i.severity === 'warning' ? '#f59e0b' : '#fff' }}>
              • {i.message}
            </div>
          ))}
          {v2.issues.length > 8 && <div style={{ fontSize: 9, color: '#fff' }}>…и ещё {v2.issues.length - 8}</div>}
        </div>
      )}

      {/* Фиксы в конструкторы */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          data-q="fix-volume" disabled={!overMuscles.length}
          onClick={() => { sendQualityVolumeFix(overloadFix, `Качество V2: снизить до MAV (${overMuscles.join(', ')})`) ? say('✅ Объём отправлен в планировщик') : say('⚠ Не удалось отправить'); }}
          style={{ ...BTN, flex: 1, minWidth: 150, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', opacity: overMuscles.length ? 1 : 0.4 }}
        >
          ⬇ Снизить до MAV{overMuscles.length ? ` (${overMuscles.length})` : ''}
        </button>
        <button
          data-q="fix-deload" disabled={!needsDeload}
          onClick={() => { sendQualityDeloadFix('Качество V2: добавить делод ×0.6/RIR+2') ? say('✅ Делод отправлен в планировщик') : say('⚠ Не удалось отправить'); }}
          style={{ ...BTN, flex: 1, minWidth: 150, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', opacity: needsDeload ? 1 : 0.4 }}
        >
          🧘 Добавить делод
        </button>
        <button
          data-q="fix-weakpoints" disabled={!weakGroups.length}
          onClick={() => { sendQualityWeakpointsFix(weakGroups, `Качество V2: добить ${weakGroups.join(', ')}`) ? say('✅ Группы отправлены в планировщик') : say('⚠ Не удалось отправить'); }}
          style={{ ...BTN, flex: 1, minWidth: 150, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', color: '#60a5fa', opacity: weakGroups.length ? 1 : 0.4 }}
        >
          ➕ Добить слабые{weakGroups.length ? ` (${weakGroups.length})` : ''}
        </button>
      </div>

      {/* История и сравнение */}
      <div data-q="q-history" style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>📸 История ({history.length}/{QUALITY_HISTORY_CAP})</span>
          <button data-q="q-save" onClick={doSave} style={{ ...BTN, minHeight: 44, padding: '8px 12px' }}>💾 Сохранить снапшот</button>
        </div>
        {history.length === 0 && <div style={{ fontSize: 10, color: '#fff' }}>Снапшотов пока нет — сохраняйте оценку после каждой правки программы.</div>}
        {history.map(h => (
          <div key={h.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, color: '#fff', marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ ...NUM, fontWeight: 800 }}>{h.score}</span>
            <span style={{ flex: 1, minWidth: 120 }}>{h.title} · {h.division.toUpperCase()} · {new Date(h.ts).toLocaleDateString('ru-RU')}</span>
            <button data-q="q-del" onClick={() => setHistory(removeQualitySnapshot(h.id))} style={{ ...BTN, minHeight: 44, padding: '6px 10px' }} aria-label={`Удалить снапшот ${h.title}`}>✕</button>
          </div>
        ))}
        {history.length >= 2 && (
          <div data-q="q-compare" style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select data-q="q-cmp-a" value={cmpA} onChange={e => setCmpA(e.target.value)} style={{ minHeight: 44, flex: 1, borderRadius: 8, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} aria-label="Снапшот A">
              <option value="">A: выбрать…</option>
              {history.map(h => <option key={h.id} value={h.id}>{h.title} · {h.score}</option>)}
            </select>
            <select data-q="q-cmp-b" value={cmpB} onChange={e => setCmpB(e.target.value)} style={{ minHeight: 44, flex: 1, borderRadius: 8, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} aria-label="Снапшот B">
              <option value="">B: выбрать…</option>
              {history.map(h => <option key={h.id} value={h.id}>{h.title} · {h.score}</option>)}
            </select>
          </div>
        )}
        {cmp && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
            <div>Δ оценки B−A: <b style={{ ...NUM, color: cmp.scoreDelta >= 0 ? '#22c55e' : '#ef4444' }}>{cmp.scoreDelta >= 0 ? `+${cmp.scoreDelta}` : cmp.scoreDelta}</b></div>
            {cmp.muscleDelta.filter(m => m.delta !== 0).slice(0, 6).map(m => (
              <div key={m.muscle} style={NUM}>{m.muscle}: {m.a} → {m.b} ({m.delta >= 0 ? `+${m.delta}` : m.delta})</div>
            ))}
          </div>
        )}
      </div>

      {/* Экспорт */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button data-q="export-csv" onClick={doExportCsv} style={{ ...BTN, flex: 1, minWidth: 120 }}>📥 CSV</button>
        <button data-q="export-html" onClick={() => doPrint(true)} style={{ ...BTN, flex: 1, minWidth: 120 }}>📄 HTML</button>
        <button data-q="export-print" onClick={() => doPrint(false)} style={{ ...BTN, flex: 1, minWidth: 120 }}>🖨 Печать</button>
      </div>

      {flash && <div role="status" style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>{flash}</div>}
    </div>
  );
};

export default QualityActions;
