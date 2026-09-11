import React, { useMemo, useState, useEffect } from 'react';
import { estimate1RMFormula, estimate1RMByMethod, rmAccuracyNote, type RMFormula, type ConsensusMethod } from '../../../engines/pro/estimate1rm.engine';
import { rpeFromLoad } from '../../../engines/pro/autoregulation-pro.engine';
import { rpePctBrzycki } from '../../../engines/pro/rpe-table.engine';
import { calculatePlates } from '../../../engines/gym-competition.engine';
import { applyToPlanner } from './planner-bridge';
import { PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';
import type { HubSnapshot } from './StrengthAnalysisHub';

const HIST_KEY = 'he_onerm_history_v1';
const HIST_CAP = 30;
interface HistEntry { date: string; lift: string; e1RM: number; weight: number; reps: number }
function loadHist(): HistEntry[] {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    const j = JSON.parse(raw || '[]');
    return Array.isArray(j) ? j.filter(e => e && typeof e.e1RM === 'number') : [];
  } catch { return []; }
}

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 12, lineHeight: 1.5 };
const FORMULAS: RMFormula[] = ['epley', 'brzycki', 'lander', 'lombardi', 'mayhew', 'oconner', 'wathen'];
const RU: Record<string, string> = { epley: 'Epley', brzycki: 'Brzycki', lander: 'Lander', lombardi: 'Lombardi', mayhew: 'Mayhew', oconner: "O'Conner", wathen: 'Wathen' };

interface Props {
  snapshot?: HubSnapshot;
  onHubPatch?: (patch: Partial<HubSnapshot>) => void;
}

const LS_KEY = 'he_onerm_tab_v1';

export const OneRmCalcTab: React.FC<Props> = ({ snapshot, onHubPatch }) => {
  const [weight, setWeight] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        if (typeof j.weight === 'number') return j.weight;
      }
    } catch {}
    return 80;
  });
  const [reps, setReps] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        if (typeof j.reps === 'number') return Math.max(1, Math.min(15, j.reps));
      }
    } catch {}
    return 5;
  });
  const [targetLift, setTargetLift] = useState<'squat' | 'bench' | 'dead' | 'ohp'>('bench');
  const [method, setMethod] = useState<ConsensusMethod>('median');
  const [hist, setHist] = useState<HistEntry[]>(() => loadHist());

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ weight, reps })); } catch {}
  }, [weight, reps]);

  const pushHist = (lift: string, e1RM: number) => {
    setHist(prev => {
      const next = [{ date: new Date().toISOString().slice(0, 10), lift, e1RM, weight, reps: clampedReps }, ...prev].slice(0, HIST_CAP);
      try { localStorage.setItem(HIST_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clampedReps = Math.max(1, Math.min(15, reps));
  const repsClampedNote = reps !== clampedReps;

  const results = useMemo(() => {
    if (weight <= 0 || clampedReps <= 0) return null;
    const per: { f: RMFormula; v: number }[] = FORMULAS.map(f => ({ f, v: Math.round(estimate1RMFormula(weight, clampedReps, f) * 10) / 10 }));
    const cons = estimate1RMByMethod(weight, clampedReps, method);
    const med = method === 'median' ? cons.value : estimate1RMByMethod(weight, clampedReps, 'median').value;
    const trim = method === 'trimmed' ? cons.value : estimate1RMByMethod(weight, clampedReps, 'trimmed').value;
    return {
      per,
      cons: Math.round((cons.value ?? 0) * 10) / 10,
      median: Math.round(med * 10) / 10,
      trimmed: Math.round(trim * 10) / 10,
      mean: Math.round((cons.mean ?? 0) * 10) / 10,
      min: Math.round((cons.min ?? 0) * 10) / 10,
      max: Math.round((cons.max ?? 0) * 10) / 10,
      spread: Math.round((cons.spread ?? 0) * 10) / 10,
      n: cons.n,
      repsClamped: cons.repsClamped,
    };
  }, [weight, clampedReps, method]);

  const accuracyNote = useMemo(() => rmAccuracyNote(targetLift, clampedReps), [targetLift, clampedReps]);

  const pctTable = useMemo(() => {
    if (!results) return [];
    const one = results.cons || 0;
    return [100, 95, 90, 85, 80, 75, 70, 65, 60].map(p => {
      const raw = one * p / 100;
      const kg = Math.round(raw / 2.5) * 2.5;
      const pl = calculatePlates(kg, 20, 'kg');
      return { p, kg, actual: pl.actualWeight, dev: pl.deviation, plates: pl.platesPerSide };
    });
  }, [results]);

  // RPE/RIR таблица (сетка Brzycki от повторы+RIR — rpe-table.engine; Epley-версия осталась в авторегуляции)
  const rpeTable = useMemo(() => {
    if (!results || !results.cons) return null;
    const e1rm = results.cons;
    const repRange = [1, 2, 3, 4, 5, 6, 8, 10];
    const rpeRange: number[] = [7, 8, 9, 10];
    return {
      repRange,
      rpeRange,
      rows: repRange.map(r => ({
        reps: r,
        cols: rpeRange.map(rpe => Math.round(e1rm * rpePctBrzycki(r, rpe))),
      })),
    };
  }, [results]);

  const hubChip = snapshot ? `${snapshot.squat}/${snapshot.bench}/${snapshot.dead} кг (П/Ж/Т) · ${snapshot.bw} кг` : null;

  return (
    <div className="train-onerm" style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор 1ПМ (оценка максимума)</div>
      <div style={{ fontSize: 12, color: '#fff', marginBottom: 10, lineHeight: 1.5 }}>
        Введите вес и повторения в рабочем сете — оценка 1ПМ по 7 формулам + консенсус (медиана применимых, не среднее) и таблица %1ПМ. Один снапшот хаба показан для сверки.
      </div>

      {snapshot && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.14)', fontSize: 11 }}>
          <span style={{ color: '#fff' }}>Хаб:</span>
          <span style={{ color: ACCENT, fontWeight: 800 }}>{hubChip}</span>
          <span style={{ color: '#fff' }}>· {snapshot.sex === 'female' ? '♀' : '♂'}</span>
          <button
            onClick={() => {
              // быстрый ввод: вес из хаба на заданном % (85% ~ 5 повт)
              const hubVal = targetLift === 'squat' ? snapshot.squat : targetLift === 'bench' ? snapshot.bench : targetLift === 'dead' ? snapshot.dead : snapshot.ohp;
              const wt = Math.round(hubVal * 0.85);
              if (wt > 0) setWeight(wt);
              setReps(5);
            }}
            style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.10)', color: ACCENT, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}
          >
            Взять из хаба ({targetLift})
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <PopupNumber label="Вес, кг" value={weight} min={0} max={500} suffix=" кг" hint="Вес штанги в рабочем подходе" onChange={setWeight} />
        <PopupNumber label="Повторения" value={reps} min={1} max={15} hint="1–15 (выше 15 — точность падает, см. предупреждение)" onChange={v => setReps(Math.max(1, Math.min(15, v || 1)))} />
        <PopupSelect
          label="К движению хаба"
          value={targetLift}
          options={[
            { id: 'squat', label: 'Присед' },
            { id: 'bench', label: 'Жим' },
            { id: 'dead', label: 'Тяга' },
            { id: 'ohp', label: 'Жим стоя' },
          ]}
          onChange={v => setTargetLift(v as any)}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <PopupSelect
          label="Консенсус"
          value={method}
          options={[
            { id: 'median', label: 'Медиана (устойчива)', desc: 'Медиана применимых формул — устойчива к выбросам' },
            { id: 'trimmed', label: 'Trimmed-mean (индустрия)', desc: 'Отброс min/max → среднее — стандарт 1rmcalculator/HubFit' },
          ]}
          onChange={v => setMethod(v as ConsensusMethod)}
        />
        <div style={{ flex: '1 1 200px', fontSize: 10, color: '#fff', padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.14)', lineHeight: 1.4 }}>
          🎯 Точность: {accuracyNote}
        </div>
      </div>

      {reps !== clampedReps && (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', color: '#f59e0b', fontSize: 11, marginBottom: 10 }}>
          ⚠️ Повторений &gt;15 — оценка очень грубая. Использовано 15 (кламп движка). Для точности тестируйте 1–10 повт.
        </div>
      )}
      {reps >= 12 && reps <= 15 && (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.16)', color: '#f59e0b', fontSize: 11, marginBottom: 10 }}>
          ⚠️ 12–15 повт: разброс формул ±{(results?.spread ?? 0)} кг. Точнее — тест на 3–6 повт (Epley/Brzycki).
        </div>
      )}

      {!results ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Введите вес &gt; 0 и повторения 1–15.</div>
      ) : (
        <>
          <div style={{ padding: 14, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.25)', marginBottom: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#fff' }}>Консенсус 1RM ({method === 'median' ? 'медиана' : 'trimmed-mean'}, n={results.n}) — {weight}кг × {clampedReps}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: ACCENT }}>{results.cons} <span style={{ fontSize: 14 }}>кг</span></div>
            <div style={{ fontSize: 10, color: '#fff' }}>диапазон: {results.min}–{results.max} кг · медиана {results.median} · trimmed {results.trimmed} · разброс {results.spread}</div>
            {snapshot && (() => {
              const hubVal = targetLift === 'squat' ? snapshot.squat : targetLift === 'bench' ? snapshot.bench : targetLift === 'dead' ? snapshot.dead : snapshot.ohp;
              const diff = Math.round(results.cons - hubVal);
              const sign = diff > 0 ? '+' : '';
              return <div style={{ fontSize: 10, color: diff === 0 ? '#fff' : diff > 0 ? '#22c55e' : '#ef4444', marginTop: 4 }}>vs хаб ({targetLift} {hubVal} кг): {sign}{diff} кг</div>;
            })()}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>По формулам</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {results.per.map(r => (
              <div key={r.f} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
                <span style={{ color: '#fff' }}>{RU[r.f]}</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{r.v} кг</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Таблица %1RM (шаг 2.5 кг + раскладка блинов, гриф 20)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {pctTable.map(t => (
              <div key={t.p} style={{ padding: '6px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#fff' }}>{t.p}%</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{t.kg}{t.actual !== t.kg ? <span style={{ fontSize: 9, color: '#f59e0b' }}> → {t.actual}</span> : null}</div>
                <div style={{ fontSize: 9, color: '#fff', lineHeight: 1.3 }}>{t.plates.length ? t.plates.map(p => `${p.plate}×${p.count}`).join(' + ') + ' /стор' : 'пустой гриф'}</div>
              </div>
            ))}
          </div>

          {rpeTable && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>RPE / RIR таблица (вес для повторов @RPE, от этого 1RM)</div>
              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 380 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#fff' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Повт \ RPE</th>
                      {rpeTable.rpeRange.map(rpe => <th key={rpe} style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>RPE {rpe} <span style={{ fontWeight: 400 }}>(RIR {10 - rpe})</span></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rpeTable.rows.map(row => (
                      <tr key={row.reps} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '6px 8px', color: ACCENT, fontWeight: 700 }}>{row.reps}</td>
                        {row.cols.map((kg, i) => <td key={i} style={{ padding: '6px 8px', textAlign: 'center', color: '#fff' }}>{kg}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: '#fff', marginTop: 6, lineHeight: 1.4 }}>
                Сетка: Brzycki от (повт + RIR) — сверена с опубликованной сеткой Cornerstone 8×9 (±0.5 п.п.). Tuchscherer-ориентиры: 5@8≈80%, 8@7≈72% — расхождение ±3% индивидуально. Проверка: {weight}×{clampedReps} → RPE ≈ {rpeFromLoad(results.cons, weight, clampedReps)}.
              </div>
            </div>
          )}

          <div style={{ fontSize: 10, color: '#fff', marginTop: 8, lineHeight: 1.5 }}>💡 Консенсус — {method === 'median' ? 'медиана применимых формул (устойчива к выбросам)' : 'trimmed-mean: отброс min/max → среднее (стандарт индустрии)'}; второй метод: {method === 'median' ? results.trimmed : results.median} кг. Epley/Brzycki точнее для 1–10 повт; для 12–15 оценка грубее (разброс {results.spread} кг). Обновите хаб/профиль, если 1RM выше текущего.</div>
          {hist.length > 0 && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: '#fff' }}>
              <b>📈 История e1RM (последние {Math.min(5, hist.length)}):</b> {hist.slice(0, 5).map((h, i) => (
                <span key={i} style={{ marginRight: 8 }}>{h.date} {h.lift} <b style={{ color: ACCENT }}>{h.e1RM}</b></span>
              ))}
            </div>
          )}
        </>
      )}
      {results && (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>🔗 Применить 1RM (<b style={{ color: '#00e68a' }}>{results.cons} кг</b>) — хаб и планировщик:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['squat', 'Присед'], ['bench', 'Жим'], ['dead', 'Тяга'], ['ohp', 'Жим стоя']].map(([k, l]) => (
              <button
                key={k}
                onClick={() => {
                  if (onHubPatch) {
                    const patch: any = {};
                    patch[k === 'dead' ? 'dead' : k] = results.cons;
                    onHubPatch(patch);
                  }
                  pushHist(k, results.cons);
                  applyToPlanner({ kind: 'pm', label: 'ПМ ' + l + ' ' + results.cons + ' кг', data: { lift: k === 'ohp' ? 'ohp' : k, value: results.cons } as any });
                }}
                style={{ flex: '1 1 90px', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, minHeight: 40 }}
              >
                {l}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#fff', marginTop: 6 }}>Кнопка обновляет единый снапшот хаба и пишет ПМ в планировщик (ПЛ/ББ) через канал intellectual.</div>
        </div>
      )}
    </div>
  );
};

export default React.memo(OneRmCalcTab);
