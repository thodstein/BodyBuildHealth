import React, { useMemo, useState } from 'react';
import { EXERCISE_CATALOG, getExerciseById } from '../../../core/exercise-catalog';
import { PopupSelect, PopupNumber, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = {
  padding: 12, borderRadius: 14,
  background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)',
  marginBottom: 10,
};
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 11, lineHeight: 1.4 };

interface Row { id: string; exerciseId: string; weight: number; reps: number; sets: number; oneRM?: number; }

export const TonnageCalcTab: React.FC = () => {
  const [oneRMGlobal, setOneRMGlobal] = useState<number>(100);
  const [rows, setRows] = useState<Row[]>([
    { id: 'r1', exerciseId: 'bench_bar', weight: 80, reps: 5, sets: 4 },
    { id: 'r2', exerciseId: 'row_bar', weight: 60, reps: 8, sets: 3 },
  ]);
  const [saved, setSaved] = useState(false);

  const upd = (id: string, field: keyof Row, val: any) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addRow = () => setRows(prev => prev.concat([{ id: 'r' + Date.now(), exerciseId: 'bench_bar', weight: 60, reps: 6, sets: 3 }]));
  const delRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const memo = useMemo(() => {
    let totalTonnage = 0, totalReps = 0, totalSets = 0, totalKpSh = 0;
    const byMuscle: Record<string, number> = {}, kpshByMuscle: Record<string, number> = {};
    const byZone = { light: 0, medium: 0, heavy: 0 };

    rows.forEach(r => {
      const ex = getExerciseById(r.exerciseId);
      if (!ex) return;
      const rm = r.oneRM ?? oneRMGlobal;
      const sv = r.weight * r.reps * r.sets;
      totalTonnage += sv; totalReps += r.sets * r.reps; totalSets += r.sets;

      const muscle = ex.group;
      byMuscle[muscle] = (byMuscle[muscle] || 0) + sv;

      const intensity = rm > 0 ? r.weight / rm : 0;
      totalKpSh += sv * intensity;
      kpshByMuscle[muscle] = (kpshByMuscle[muscle] || 0) + sv * intensity;

      const pct = rm > 0 ? (r.weight / rm) * 100 : 0;
      if (pct < 60) byZone.light += sv;
      else if (pct <= 80) byZone.medium += sv;
      else byZone.heavy += sv;
    });

    const avgWeight = totalReps > 0 ? totalTonnage / totalReps : 0;
    const relInt = oneRMGlobal > 0 ? (avgWeight / oneRMGlobal) * 100 : 0;

    return { totalTonnage, totalReps, totalSets, totalKpSh, avgWeight, relInt, byMuscle, kpshByMuscle, byZone };
  }, [rows, oneRMGlobal]);

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
      if (d.rows) setRows(d.rows);
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
        {rows.map(row => (
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
          </div>
        ))}
        <div style={{ marginTop: 6, maxWidth: 200 }}>
          <PopupNumber label="Глобальный 1ПМ (кг)" value={oneRMGlobal} min={0} suffix=" кг" hint="если не задан индивидуально" onChange={v => setOneRMGlobal(v)} />
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
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📊 Зоны интенсивности (%1ПМ)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[['light', 'Легкая (<60%)', '#22c55e'], ['medium', 'Средняя (60-80%)', '#f59e0b'], ['heavy', 'Тяжёлая (>80%)', '#ef4444']].map(([key, label, color]) => (
            <div key={key} style={{ background: `${color}0f`, border: `1px solid ${color}33`, borderRadius: 8, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#fff' }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color }}>{(memo.byZone[key as keyof typeof memo.byZone] ?? 0).toLocaleString()}</div>
              <div style={{ fontSize: 10, color: '#fff' }}>кг·повт</div>
            </div>
          ))}
        </div>
      </div>

      <div style={CARD}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 12, opacity: saved ? 0.4 : 1, transition: 'all 0.2s' }}>
            {saved ? '✓ Сохранено' : '💾 Сохранить'}
          </button>
          <button onClick={handleLoad} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', fontWeight: 800, fontSize: 12 }}>📂 Загрузить</button>
          <button onClick={() => { const sets: Record<string, number> = {}; Object.entries(memo.byMuscle).forEach(([m, t]) => { sets[m] = Math.max(1, Math.round((t as number) / (oneRMGlobal * 8))); }); applyToPlanner({ kind: 'volume', label: 'Тоннаж → объём', data: { sets } }); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 12 }}>🛠 В план</button>
        </div>
      </div>
    </div>
  );
};

export default TonnageCalcTab;
