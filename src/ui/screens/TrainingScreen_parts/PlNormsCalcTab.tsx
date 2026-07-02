import React, { useMemo, useState } from 'react';
import { PL_NORM_TABLES, classifyTotal, findCategory, type Federation, type Discipline, RANK_LABELS } from '../../../engines/pl-norms.engine';
import { calcAllPoints } from '../../../engines/pl-points.engine';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12, textAlign: 'center' as const };

const FEDS: { id: Federation; label: string }[] = [
  { id: 'fpr_ipf', label: 'ФПР / IPF (с ДК)' },
  { id: 'wrpf_untested', label: 'WRPF / СПР (без ДК)' },
  { id: 'wrpf_tested', label: 'WRPF / СПР (с ДК)' },
];
const DISC: { id: Discipline; label: string }[] = [
  { id: 'total', label: 'Троеборье (сумма)' },
  { id: 'bench', label: 'Жим лёжа' },
  { id: 'deadlift', label: 'Становая тяга' },
  { id: 'squat', label: 'Приседания' },
];
const rankColor: Record<string, string> = { 'КМС': '#60a5fa', 'МС': '#a855f7', 'МСМК': '#f59e0b', 'ЭЛИТА': '#ef4444', 'нет разряда': 'var(--text-dim)' };

export const PlNormsCalcTab: React.FC = () => {
  const [fed, setFed] = useState<Federation>('wrpf_untested');
  const [disc, setDisc] = useState<Discipline>('total');
  const [bw, setBw] = useState<number>(88);
  const [total, setTotal] = useState<number>(700);

  const table = useMemo(() => PL_NORM_TABLES.find(t => t.federation === fed && t.discipline === disc), [fed, disc]);
  const result = useMemo(() => table ? classifyTotal(table, bw, total) : null, [table, bw, total]);
  const cat = useMemo(() => table ? findCategory(table, bw) : null, [table, bw]);

  // для дисциплин bench/deadlift/squat только wrpf_untested; ограничим
  const availDisc = fed === 'fpr_ipf' ? DISC.filter(d => d.id === 'total') : DISC.filter(d => d.id === 'total' || fed === 'wrpf_untested');

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🏆 Калькулятор разрядных нормативов (ПЛ)</div>
      <div style={{ ...SMALL, marginBottom: 10 }}>Мужчины, RAW (без экипировки). Источник: спецификация 2026 (ФПР/IPF, WRPF/СПР). Выберите федерацию, дисциплину, вес и сумму — определю разряд и сколько кг до следующего.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Федерация</label>
          <select value={fed} onChange={e => { setFed(e.target.value as Federation); if (e.target.value === 'fpr_ipf') setDisc('total'); }} style={{ ...IN, textAlign: 'left' }}>
            {FEDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Дисциплина</label>
          <select value={disc} onChange={e => setDisc(e.target.value as Discipline)} style={{ ...IN, textAlign: 'left' }}>
            {availDisc.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Собственный вес, кг</label>
          <input type="number" value={bw} min={30} max={250} onChange={e => setBw(+e.target.value)} style={IN} />
        </div>
        <div>
          <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Сумма / результат, кг</label>
          <input type="number" value={total} min={0} max={1500} step={2.5} onChange={e => setTotal(+e.target.value)} style={IN} />
        </div>
      </div>

      {result && cat && (
        <>
          <div style={{ padding: 14, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.25)', marginBottom: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Категория: {cat.label} · {disc === 'total' ? 'сумма' : DISC.find(d => d.id === disc)?.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: rankColor[result.achievedLabel] || ACCENT }}>{result.achievedLabel}</div>
            {result.achievedRank ? (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{result.kgToNext > 0 ? `до ${result.nextLabel}: ${result.kgToNext} кг` : 'высший разряд норматива'}</div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>до {result.nextLabel}: {result.kgToNext} кг</div>
            )}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Нормативы категории {cat.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.allRanks.map(r => (
              <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: r.achieved ? 'rgba(0,230,138,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (r.achieved ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.05)') }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.achieved ? ACCENT : 'var(--text-dim)' }}>{r.achieved ? '✓ ' : ''}{r.label}</span>
                <span style={{ fontSize: 12, color: r.achieved ? ACCENT : '#fff' }}>{r.threshold} кг</span>
              </div>
            ))}
          </div>
          {(() => { const _pts = calcAllPoints(bw, total, disc === 'bench' ? 'bench' : 'total', 'raw'); return (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>🏆 Очки относительной силы (мужчины)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {_pts.map(p => (
                  <div key={p.formula} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{p.label}</div><div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{p.scale}</div></div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{p.points}</div>
                  </div>
                ))}
              </div>
            </div>
          ); })()}
          <div style={{ ...SMALL, marginTop: 8 }}>💡 Женские нормативы и очковые формулы (IPF GL/DOTS/Wilks) — в спецификации дана структура формул, но числовые коэффициенты не приведены. Добавлю, как только подтвердим коэффициенты.</div>
        </>
      )}
    </div>
  );
};

export default React.memo(PlNormsCalcTab);