import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, getExerciseById } from '../../../core/exercise-catalog';
import { PopupSelect, PopupNumber, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { PRILEPIN_TABLE, tonnageRowResult, inolScopeVerdict, estimatedMpv } from '../../../engines/tonnage-prilepin.engine';
import type { ProExerciseRow } from '../../../engines/volume-optimizer-pro.engine';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = {
  padding: 12, borderRadius: 14,
  background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)',
  marginBottom: 10,
};
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 11, lineHeight: 1.4 };

interface Row { id: string; exerciseId: string; weight: number; reps: number; sets: number; oneRM?: number; week?: number }

export interface TonnageCalcTabProps {
  /** Д3: общие строки хаба (VolumeInput). Без пропсов — автономный режим как раньше. */
  sharedRows?: ProExerciseRow[];
  onSharedRowsChange?: (rows: ProExerciseRow[]) => void;
}

function toTonRow(s: ProExerciseRow): Row {
  return { id: s.id, exerciseId: s.exerciseId, weight: s.weight, reps: s.reps, sets: s.sets, oneRM: s.oneRM, week: s.week };
}

export const TonnageCalcTab: React.FC<TonnageCalcTabProps> = ({ sharedRows, onSharedRowsChange }) => {
  const [oneRMGlobal, setOneRMGlobal] = useState<number>(100);
  const [bodyweight, setBodyweight] = useState<number>(80);
  const [internalRows, setInternalRows] = useState<Row[]>([
    { id: 'r1', exerciseId: 'bench_bar', weight: 80, reps: 5, sets: 4 },
    { id: 'r2', exerciseId: 'row_bar', weight: 60, reps: 8, sets: 3 },
  ]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  // Е4: фильтр недель — общие строки многонедельные, тоннаж считается на выбранную неделю
  const [activeWeek, setActiveWeek] = useState<'all' | number>('all');

  // Д3: в контролируемом режиме правим общие строки, сохраняя week/day/rpe
  const rows: Row[] = sharedRows ? sharedRows.map(toTonRow) : internalRows;
  const maxWeek = rows.reduce((m, r) => Math.max(m, r.week ?? 1), 1);
  const upd = (id: string, field: keyof Row, val: any) => {
    if (sharedRows && onSharedRowsChange) {
      onSharedRowsChange(sharedRows.map(r => r.id === id ? { ...r, [field]: val } : r));
    } else {
      setInternalRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
    }
  };
  const addRow = () => {
    const w = activeWeek === 'all' ? 1 : activeWeek;
    if (sharedRows && onSharedRowsChange) {
      onSharedRowsChange(sharedRows.concat([{ id: 'r' + Date.now(), exerciseId: 'bench_bar', week: w, day: 1, weight: 60, reps: 6, sets: 3 }]));
    } else {
      setInternalRows(prev => prev.concat([{ id: 'r' + Date.now(), exerciseId: 'bench_bar', weight: 60, reps: 6, sets: 3, week: w }]));
    }
  };
  const delRow = (id: string) => {
    if (sharedRows && onSharedRowsChange) {
      onSharedRowsChange(sharedRows.filter(r => r.id !== id));
    } else {
      setInternalRows(prev => prev.filter(r => r.id !== id));
    }
  };

  // P3: расчёт через tonnage-prilepin.engine (Прилепин + INOL вместо crude КПШ).
  // Легаси-КПШ (tonnage×intensity) оставлен как «нагрузочный индекс» для совместимости сводки.
  // Е4: считаем только выбранную неделю (иначе многонедельный план раздувает INOL сессии).
  const memo = useMemo(() => {
    let totalTonnage = 0, totalReps = 0, totalSets = 0, totalKpSh = 0, totalInol = 0, patternTonnage = 0;
    const byMuscle: Record<string, number> = {}, kpshByMuscle: Record<string, number> = {};
    const byZone: Record<string, number> = { tech: 0, hypertrophy: 0, strength: 0, max: 0, unknown: 0 };
    const rowResults: Record<string, ReturnType<typeof tonnageRowResult>> = {};
    const effRows = activeWeek === 'all' ? rows : rows.filter(r => (r.week ?? 1) === activeWeek);

    effRows.forEach(r => {
      const ex = getExerciseById(r.exerciseId);
      if (!ex) return;
      const rm = r.oneRM ?? oneRMGlobal;
      const res = tonnageRowResult({
        exerciseId: r.exerciseId, name: ex.name, type: ex.type,
        weight: r.weight, reps: r.reps, sets: r.sets, oneRM: rm, bodyweightKg: bodyweight,
      });
      rowResults[r.id] = res;
      totalTonnage += res.tonnage; totalReps += res.totalReps; totalSets += r.sets;
      patternTonnage += res.patternTonnage;

      const muscle = ex.group;
      byMuscle[muscle] = (byMuscle[muscle] || 0) + res.tonnage;

      const intensity = rm > 0 ? res.loadPerRep / rm : 0;
      totalKpSh += res.tonnage * intensity;
      kpshByMuscle[muscle] = (kpshByMuscle[muscle] || 0) + res.tonnage * intensity;

      if (res.zone && res.inol !== null) {
        byZone[res.zone.id] += res.tonnage;
        totalInol += res.inol;
      } else {
        byZone.unknown += res.tonnage;
      }
    });

    const avgWeight = totalReps > 0 ? totalTonnage / totalReps : 0;
    const relInt = oneRMGlobal > 0 ? (avgWeight / oneRMGlobal) * 100 : 0;

    return { totalTonnage, totalReps, totalSets, totalKpSh, totalInol, patternTonnage, avgWeight, relInt, byMuscle, kpshByMuscle, byZone, rowResults };
  }, [rows, oneRMGlobal, bodyweight, activeWeek]);

  const handleSave = () => {
    localStorage.setItem('he_saved_tonnage_calc', JSON.stringify({ timestamp: Date.now(), oneRMGlobal, rows }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const handleLoad = () => {
    const raw = localStorage.getItem('he_saved_tonnage_calc');
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.oneRMGlobal !== undefined) setOneRMGlobal(d.oneRMGlobal);
      if (Array.isArray(d.rows)) {
        if (sharedRows && onSharedRowsChange) {
          // Д3: загруженное маппим на общие строки (week/day/rpe живых сохраняем по id)
          const liveById = new Map(sharedRows.map(r => [r.id, r]));
          onSharedRowsChange(d.rows.map((r: Row) => {
            const live = liveById.get(r.id);
            return { id: r.id, exerciseId: r.exerciseId, week: live?.week ?? 1, day: live?.day ?? 1, weight: r.weight, reps: r.reps, sets: r.sets, oneRM: r.oneRM, rpe: live?.rpe };
          }));
        } else {
          setInternalRows(d.rows);
        }
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="train-tonnage" style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>📦 Тоннаж калькулятор</div>
      <div style={{ fontSize: 11, color: '#fff', marginBottom: 10 }}>Ввод упражнений → тоннаж, КПШ, средний вес, УОИ, разбивка по мышцам и зонам интенсивности.</div>

      <div style={CARD}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button onClick={addRow} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>＋ Добавить упражнение</button>
        </div>
        {maxWeek > 1 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            {(['all', ...Array.from({ length: maxWeek }, (_, i) => i + 1)] as Array<'all' | number>).map(w => (
              <button key={String(w)} onClick={() => setActiveWeek(w)}
                style={{ padding: '6px 10px', borderRadius: 6, border: activeWeek === w ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.10)', background: activeWeek === w ? 'rgba(0,230,138,0.10)' : 'transparent', color: activeWeek === w ? ACCENT : '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', minHeight: 36 }}>
                {w === 'all' ? 'Все' : `Н${w}`}
              </button>
            ))}
          </div>
        )}
        {(activeWeek === 'all' ? rows : rows.filter(r => (r.week ?? 1) === activeWeek)).map(row => (
          <div key={row.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ flex: '1 1 100%', minWidth: 0 }}>
              <PopupSelect label="Упражнение" value={row.exerciseId}
                options={EXERCISE_CATALOG.map(e => ({ id: e.id, label: e.name, desc: `${e.group} · ${e.type === 'compound' ? 'Базовое' : 'Изолированное'}` }))}
                hint="Поиск" onChange={v => upd(row.id, 'exerciseId', v)} />
            </div>
            <div style={{ flex: '1 1 72px', minWidth: 72 }}>
              <PopupNumber label="Вес" value={row.weight} min={0} suffix=" кг" onChange={v => upd(row.id, 'weight', v)} />
            </div>
            <div style={{ flex: '1 1 72px', minWidth: 72 }}>
              <PopupNumber label="Повт" value={row.reps} min={0} onChange={v => upd(row.id, 'reps', v)} />
            </div>
            <div style={{ flex: '1 1 72px', minWidth: 72 }}>
              <PopupNumber label="Сеты" value={row.sets} min={0} onChange={v => upd(row.id, 'sets', v)} />
            </div>
            <div style={{ flex: '1 1 72px', minWidth: 72 }}>
              <PopupNumber label="1ПМ" value={row.oneRM ?? 0} min={0} suffix=" кг" hint="0 = общий 1ПМ" onChange={v => upd(row.id, 'oneRM', v === 0 ? undefined : v)} />
            </div>
            <button onClick={() => delRow(row.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 12, padding: '9px 10px', minHeight: 38, alignSelf: 'flex-end' }}>✕</button>
            {(() => {
              const res = memo.rowResults[row.id];
              if (!res) return null;
              if (res.intensityPct === null) return <div style={{ flex: '1 1 100%', fontSize: 10, color: '#fff' }}>ℹ️ Укажите 1ПМ (свой или глобальный) — зона Прилепина и INOL появятся здесь</div>;
              const vc = res.verdict!.kind === 'optimal' ? '#22c55e' : res.verdict!.kind === 'below' ? '#60a5fa' : res.verdict!.kind === 'high' ? '#f59e0b' : '#ef4444';
              const ex = getExerciseById(row.exerciseId);
              const mpv = ex ? estimatedMpv(ex.name, res.intensityPct) : null;
              return (
                <div style={{ flex: '1 1 100%', fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
                  <span style={{ color: '#60a5fa' }}>{res.intensityPct.toFixed(0)}% · {res.zone!.label}</span>
                  {' · '}<span style={{ color: vc }}>INOL {res.inol!.toFixed(2)} — {res.verdict!.message.split('— ')[1] || res.verdict!.message}</span>
                  {mpv && <span style={{ color: '#a78bfa' }}> · ≈{mpv.velocity.toFixed(2)} м/с{mpv.isEstimate ? ' (оценка LVP, не замер)' : ' (LVP-ориентир)'}</span>}
                </div>
              );
            })()}
          </div>
        ))}
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 420 }}>
          <PopupNumber label="Глобальный 1ПМ (кг)" value={oneRMGlobal} min={0} suffix=" кг" hint="если не задан индивидуально" onChange={v => setOneRMGlobal(v)} />
          <PopupNumber label="Вес тела (кг)" value={bodyweight} min={30} max={200} suffix=" кг" hint="для подтягиваний/брусьев (+0.65×BW)" onChange={v => setBodyweight(v)} />
        </div>
      </div>

      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>📊 Итоговые показатели</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
          <MetricCard title="Тоннаж" icon="📦" accent={ACCENT}>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{memo.totalTonnage.toLocaleString()}</div>
            <div style={SMALL}>кг·повт</div>
          </MetricCard>
          <MetricCard title="КПШ" icon="🔢" accent="#60a5fa">
            <div style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>{memo.totalKpSh.toFixed(0)}</div>
            <div style={SMALL}>общий</div>
          </MetricCard>
          <MetricCard title="Средний вес" icon="🔸" accent="#f59e0b">
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{memo.avgWeight.toFixed(1)}</div>
            <div style={SMALL}>кг</div>
          </MetricCard>
          <MetricCard title="УОИ" icon="📈" accent="#a855f7">
            <div style={{ fontSize: 20, fontWeight: 800, color: '#a855f7' }}>{memo.relInt.toFixed(1)}%</div>
            <div style={SMALL}>к 1ПМ</div>
          </MetricCard>
        </div>
      </div>

      {Object.keys(memo.byMuscle).length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📊 Тоннаж по мышцам</div>
          {Object.entries(memo.byMuscle).map(([m, t]) => (
            <div key={m} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 3 }}>
              <span style={{ color: '#fff' }}>{m}</span>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{t.toLocaleString()} кг·повт</span>
            </div>
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginTop: 8, marginBottom: 6 }}>📊 КПШ по мышцам</div>
          {Object.entries(memo.kpshByMuscle).map(([m, k]) => (
            <div key={m} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 3 }}>
              <span style={{ color: '#fff' }}>{m}</span>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>{k.toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📊 Зоны Прилепина 1974 (тоннаж по зонам %1ПМ)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {PRILEPIN_TABLE.map(z => {
            const t = memo.byZone[z.id] ?? 0;
            const color = z.id === 'tech' ? '#22c55e' : z.id === 'hypertrophy' ? '#60a5fa' : z.id === 'strength' ? '#f59e0b' : '#ef4444';
            return (
              <div key={z.id} style={{ background: `${color}0f`, border: `1px solid ${color}33`, borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#fff' }}>{z.label}</div>
                <div style={{ fontSize: 10, color: '#fff' }}>опт {z.optimalTotal} повт · {z.rangeTotal[0]}–{z.rangeTotal[1]}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{t.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: '#fff' }}>кг·повт</div>
              </div>
            );
          })}
        </div>
        {(() => {
          const v = inolScopeVerdict(memo.totalInol, 'day', 'Сессия');
          const color = v.kind === 'optimal' ? '#22c55e' : v.kind === 'below' ? '#60a5fa' : v.kind === 'high' ? '#f59e0b' : '#ef4444';
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '8px 8px 0', gap: 8 }}>
              <span style={{ color: '#fff' }}>INOL сессии (Hristov: день 2.4, неделя 7.2)</span>
              <span style={{ color, fontWeight: 700, textAlign: 'right' }}>{v.message.split(': ')[1] || v.message}</span>
            </div>
          );
        })()}
        {memo.byZone.unknown > 0 && <div style={{ fontSize: 10, color: '#fff', padding: '4px 8px 0' }}>ℹ️ {(memo.byZone.unknown).toLocaleString()} кг·повт без 1ПМ — вне зон Прилепина</div>}
      </div>

      <div style={CARD}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, opacity: saved ? 0.4 : 1, transition: 'all 0.2s' }}>
            {saved ? '✓ Сохранено' : '💾 Сохранить'}
          </button>
          <button onClick={handleLoad} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', fontWeight: 800, fontSize: 12 }}>📂 Загрузить</button>
          <button onClick={() => {
            const lines = rows.map(r => {
              const res = memo.rowResults[r.id];
              const ex = getExerciseById(r.exerciseId);
              const base = `${ex?.name || r.exerciseId}: ${r.weight}×${r.reps}×${r.sets} = ${(res?.tonnage || 0).toLocaleString()} кг·повт`;
              return res?.inol !== null && res?.inol !== undefined ? `${base} · INOL ${res.inol.toFixed(2)} (${res.zone!.id})` : base;
            });
            lines.push(`Итого: ${memo.totalTonnage.toLocaleString()} кг·повт · INOL ${memo.totalInol.toFixed(2)}`);
            navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 12 }}>📋 {copied ? 'Скопировано' : 'Сводка INOL'}</button>
        </div>
        <div style={{ fontSize: 10, color: '#fff', marginTop: 6, lineHeight: 1.45 }}>
          Тоннаж в сеты не конвертируется (разные метрики): строки объёма ведутся во вкладке «Объём» — сюда попадает только сводка. Стан scores: становая судится со скидкой ×0.75, аксессуары — ориентиром.
        </div>
      </div>
    </div>
  );
};

export default TonnageCalcTab;
