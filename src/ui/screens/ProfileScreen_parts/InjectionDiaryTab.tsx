import React, { useState } from 'react';

const DIARY_KEY = 'he_injection_diary';
const ZONES = [
  { id:'glute_dorsal', label:'Ягодица (дорсальная)' }, { id:'glute_ventral', label:'Вентро-ягодичная' },
  { id:'quadriceps', label:'Квадрицепс' }, { id:'deltoid', label:'Дельтовидная' },
  { id:'pectoral', label:'Грудная' }, { id:'triceps', label:'Трицепс' },
  { id:'biceps', label:'Бицепс' }, { id:'calves', label:'Икры' },
  { id:'abdominal', label:'Живот (п/к)' }, { id:'gluteal', label:'Ягодицы (произв.)' },
];
const TECHNIQUES = [
  { id:'im', label:'В/м (масло)' }, { id:'subq', label:'П/к (водный)' },
  { id:'im_water', label:'В/м (водный)' }, { id:'subq_oil', label:'П/к (масло, редко)' },
];
const NEEDLE_GAUGES = ['21G', '22G', '23G', '25G', '27G', '29G', '30G', '31G'];

interface InjectionEntry {
  id: string;
  date: string;
  zone: string;
  side: 'left' | 'right';
  substance: string;
  volumeMl: number;
  needleGauge: string;
  technique: string;
  painLevel: number;
  pipLevel: number;
  swelling: number;
  redness: boolean;
  lump: boolean;
  bruise: boolean;
  notes: string;
}

function loadDiary(): InjectionEntry[] {
  try { return JSON.parse(localStorage.getItem(DIARY_KEY) || '[]'); } catch { return []; }
}
function saveDiary(entries: InjectionEntry[]) {
  localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
}

const emptyForm = (date: string): InjectionEntry => ({
  id: Date.now().toString(), date,
  zone: 'glute_dorsal', side: 'left', substance: '', volumeMl: 1,
  needleGauge: '23G', technique: 'im', painLevel: 0, pipLevel: 0,
  swelling: 0, redness: false, lump: false, bruise: false, notes: '',
});

export const InjectionDiaryTab: React.FC = () => {
  const [entries, setEntries] = useState<InjectionEntry[]>(loadDiary);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<InjectionEntry>(emptyForm(new Date().toISOString().split('T')[0]));
  const [viewMode, setViewMode] = useState<'journal' | 'stats' | 'chart'>('journal');

  const today = new Date().toISOString().split('T')[0];

  const initForm = (date: string) => {
    setForm(emptyForm(date));
    setEditId(null);
    setShowForm(true);
  };

  const editEntry = (e: InjectionEntry) => {
    setForm(e);
    setEditId(e.id);
    setShowForm(true);
  };

  const saveEntry = () => {
    if (!form.substance.trim() || !form.date) return;
    const updated = editId
      ? entries.map(e => e.id === editId ? { ...form } : e)
      : [...entries, { ...form, id: Date.now().toString() }];
    setEntries(updated);
    saveDiary(updated);
    setShowForm(false);
    setEditId(null);
  };

  const deleteEntry = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    saveDiary(updated);
  };

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const zoneLabel = (id: string) => ZONES.find(z => z.id === id)?.label || id;
  const techLabel = (id: string) => TECHNIQUES.find(t => t.id === id)?.label || id;

  const zoneCounts: Record<string, number> = {};
  const zonePain: Record<string, number[]> = {};
  sorted.forEach(e => {
    zoneCounts[e.zone] = (zoneCounts[e.zone] || 0) + 1;
    if (!zonePain[e.zone]) zonePain[e.zone] = [];
    zonePain[e.zone].push(e.pipLevel);
  });
  const zoneStats = Object.entries(zoneCounts).map(([zone, count]) => ({
    zone, count, avgPain: zonePain[zone]?.length ? (zonePain[zone].reduce((a, b) => a + b, 0) / zonePain[zone].length).toFixed(1) : '—',
  })).sort((a, b) => b.count - a.count);

  const totalInjections = sorted.length;
  const avgPain = sorted.length ? (sorted.reduce((s, e) => s + e.painLevel, 0) / sorted.length).toFixed(1) : '—';
  const avgPip = sorted.length ? (sorted.reduce((s, e) => s + e.pipLevel, 0) / sorted.length).toFixed(1) : '—';
  const lumpCount = sorted.filter(e => e.lump).length;
  const bruiseCount = sorted.filter(e => e.bruise).length;
  const rednessCount = sorted.filter(e => e.redness).length;
  const last7 = sorted.filter(e => e.date >= new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);

  const chartData = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const chartDays = chartData.map(e => e.date.slice(5));
  const chartPain = chartData.map(e => e.painLevel);
  const chartPip = chartData.map(e => e.pipLevel);
  const maxY = Math.max(10, ...chartPain, ...chartPip);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize:15, fontWeight:800, color:'#fff', margin:'0 0 4px' }}>💉 Дневник инъекций</h3>
        <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:'0 0 8px' }}>
          Отмечайте зоны, боль, уплотнения и гематомы — отслеживайте реакцию тканей
        </p>

        <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
          {(['journal','stats','chart'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding:'5px 12px', borderRadius:14, fontSize:10, fontWeight:600, whiteSpace:'nowrap',
              cursor:'pointer', flexShrink:0, border:'none',
              background: viewMode === m ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: viewMode === m ? '#000' : 'rgba(255,255,255,0.7)',
            }}>{m === 'journal' ? '📋 Журнал' : m === 'stats' ? '📊 Статистика' : '📈 График'}</button>
          ))}
        </div>

        <button onClick={() => initForm(today)} style={{
          width:'100%', padding:'10px 16px', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:12,
          background:'var(--accent)', color:'#000', border:'none',
        }}>➕ Добавить инъекцию</button>
      </div>

      {showForm && (
        <div style={{ borderRadius:12, padding:14, marginBottom:12, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{editId ? '✏️ Редактировать' : '📝 Новая инъекция'}</span>
            <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:16, cursor:'pointer', padding:'2px 6px' }}>✕</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Дата</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                style={{ width:'100%', padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Зона</label>
              <select value={form.zone} onChange={e => setForm({...form, zone: e.target.value})}
                style={{ width:'100%', padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11 }}>
                {ZONES.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Сторона</label>
              <div style={{ display:'flex', gap:4 }}>
                {(['left','right'] as const).map(s => (
                  <button key={s} onClick={() => setForm({...form, side: s})} style={{
                    flex:1, padding:'5px 0', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
                    background: form.side === s ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                    color: form.side === s ? '#000' : 'rgba(255,255,255,0.7)',
                    border: 'none',
                  }}>{s === 'left' ? '← Левый' : 'Правый →'}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Препарат</label>
              <input type="text" value={form.substance} onChange={e => setForm({...form, substance: e.target.value})}
                placeholder="Тестостерон энантат"
                style={{ width:'100%', padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Объём (мл)</label>
              <input type="number" step="0.1" min="0" max="5" value={form.volumeMl || ''} onChange={e => setForm({...form, volumeMl: parseFloat(e.target.value) || 0})}
                style={{ width:'100%', padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Игла</label>
              <select value={form.needleGauge} onChange={e => setForm({...form, needleGauge: e.target.value})}
                style={{ width:'100%', padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11 }}>
                {NEEDLE_GAUGES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Техника</label>
              <select value={form.technique} onChange={e => setForm({...form, technique: e.target.value})}
                style={{ width:'100%', padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11 }}>
                {TECHNIQUES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Боль при введении (0-10)</label>
              <input type="range" min="0" max="10" value={form.painLevel} onChange={e => setForm({...form, painLevel: parseInt(e.target.value)})}
                style={{ width:'100%' }} />
              <div style={{ textAlign:'center', fontSize:18, fontWeight:800, color: form.painLevel >= 7 ? '#ef4444' : form.painLevel >= 4 ? '#f59e0b' : '#00e68a' }}>{form.painLevel}</div>
            </div>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>PIP (пост-инъекц., 0-10)</label>
              <input type="range" min="0" max="10" value={form.pipLevel} onChange={e => setForm({...form, pipLevel: parseInt(e.target.value)})}
                style={{ width:'100%' }} />
              <div style={{ textAlign:'center', fontSize:18, fontWeight:800, color: form.pipLevel >= 7 ? '#ef4444' : form.pipLevel >= 4 ? '#f59e0b' : '#00e68a' }}>{form.pipLevel}</div>
            </div>
            <div>
              <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Отёк (0-10)</label>
              <input type="range" min="0" max="10" value={form.swelling} onChange={e => setForm({...form, swelling: parseInt(e.target.value)})}
                style={{ width:'100%' }} />
              <div style={{ textAlign:'center', fontSize:18, fontWeight:800, color: form.swelling >= 7 ? '#ef4444' : form.swelling >= 4 ? '#f59e0b' : '#00e68a' }}>{form.swelling}</div>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
            {([
              { k:'redness' as const, label:'🔴 Покраснение' },
              { k:'lump' as const, label:'🟤 Уплотнение/шишка' },
              { k:'bruise' as const, label:'🟣 Гематома' },
            ]).map(c => (
              <label key={c.k} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'rgba(255,255,255,0.7)', cursor:'pointer' }}>
                <input type="checkbox" checked={form[c.k]} onChange={e => setForm({...form, [c.k]: e.target.checked})}
                  style={{ accentColor:'#00e68a' }} />
                {c.label}
              </label>
            ))}
          </div>

          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>Заметки</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Ощущения, реакция, ротация..."
              style={{ width:'100%', padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:11, resize:'vertical', minHeight:40, boxSizing:'border-box' }} />
          </div>

          <button onClick={saveEntry} disabled={!form.substance.trim()} style={{
            width:'100%', padding:'8px 0', borderRadius:8, border:'none', cursor: form.substance.trim() ? 'pointer' : 'not-allowed', marginTop:10,
            background: form.substance.trim() ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
            color: form.substance.trim() ? '#000' : 'rgba(255,255,255,0.3)', fontWeight:700, fontSize:12,
          }}>{editId ? '💾 Сохранить изменения' : '💾 Добавить запись'}</button>
        </div>
      )}

      {viewMode === 'journal' && (
        <div>
          {sorted.length === 0 && (
            <div style={{ textAlign:'center', padding:40, fontSize:11, color:'rgba(255,255,255,0.5)' }}>
              Нет записей об инъекциях. Нажмите «Добавить инъекцию», чтобы начать отслеживание.
            </div>
          )}
          {sorted.slice(0, 50).map(e => {
            const hasComplication = e.lump || e.bruise || e.redness || e.pipLevel >= 4;
            return (
              <div key={e.id} style={{
                borderRadius:10, padding:'8px 10px', marginBottom:4, cursor:'pointer',
                background: hasComplication ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${hasComplication ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)'}`,
              }} onClick={() => editEntry(e)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                  <span style={{ fontSize:11, fontWeight:700 }}>{e.date}</span>
                  <div style={{ display:'flex', gap:3, alignItems:'center' }}>
                    {e.lump && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(139,92,246,0.15)', color:'#a78bfa' }}>шишка</span>}
                    {e.bruise && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(168,85,247,0.15)', color:'#c084fc' }}>гематома</span>}
                    {e.redness && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(239,68,68,0.15)', color:'#ef4444' }}>покрасн.</span>}
                  </div>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, fontSize:9, color:'rgba(255,255,255,0.6)' }}>
                  <span>💉 {e.substance}</span>
                  <span>📍 {zoneLabel(e.zone)} {e.side === 'left' ? '←' : '→'}</span>
                  <span>📏 {e.volumeMl} мл</span>
                  <span>⚡ {e.painLevel}/10</span>
                  {e.pipLevel > 0 && <span style={{ color: e.pipLevel >= 4 ? '#f97316' : 'inherit' }}>🔥 {e.pipLevel}/10</span>}
                  {e.notes && <span style={{ color:'rgba(255,255,255,0.4)', fontStyle:'italic' }}>— {e.notes}</span>}
                </div>
              </div>
            );
          })}
          {sorted.length > 50 && (
            <div style={{ textAlign:'center', padding:8, fontSize:10, color:'rgba(255,255,255,0.4)' }}>
              Показаны последние 50 из {sorted.length} записей
            </div>
          )}
        </div>
      )}

      {viewMode === 'stats' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
            {[
              { label:'Всего инъекций', value: String(totalInjections), color:'#00e68a' },
              { label:'Средняя боль', value: avgPain, color: parseFloat(avgPain) >= 4 ? '#f59e0b' : '#00e68a' },
              { label:'Средний PIP', value: avgPip, color: parseFloat(avgPip) >= 4 ? '#f59e0b' : '#00e68a' },
            ].map((s, i) => (
              <div key={i} style={{ borderRadius:10, padding:'8px 6px', textAlign:'center', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
            {[
              { label:'Уплотнения', value: String(lumpCount), pct: totalInjections ? Math.round(lumpCount / totalInjections * 100) : 0, color:'#a78bfa' },
              { label:'Гематомы', value: String(bruiseCount), pct: totalInjections ? Math.round(bruiseCount / totalInjections * 100) : 0, color:'#c084fc' },
              { label:'Покраснения', value: String(rednessCount), pct: totalInjections ? Math.round(rednessCount / totalInjections * 100) : 0, color:'#ef4444' },
            ].map((s, i) => (
              <div key={i} style={{ borderRadius:10, padding:'8px 6px', textAlign:'center', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)' }}>{s.label}</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)' }}>{s.pct}%</div>
              </div>
            ))}
          </div>

          {last7.length > 0 && (
            <div style={{ borderRadius:10, padding:'8px 10px', marginBottom:8, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.1)' }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#60a5fa', marginBottom:4 }}>📊 За последние 7 дней</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>
                {last7.length} инъекций · ср.боль {last7.reduce((s, e) => s + e.painLevel, 0) / last7.length | 0}/10 · ср.PIP {last7.reduce((s, e) => s + e.pipLevel, 0) / last7.length | 0}/10
              </div>
            </div>
          )}

          {zoneStats.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.7)', marginBottom:6 }}>📍 Статистика по зонам</div>
              {zoneStats.map(z => {
                const pct = totalInjections ? Math.round(z.count / totalInjections * 100) : 0;
                return (
                  <div key={z.zone} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, fontSize:10 }}>
                    <span style={{ width:100, flexShrink:0, color:'rgba(255,255,255,0.6)', textOverflow:'ellipsis', overflow:'hidden', whiteSpace:'nowrap' }}>
                      {zoneLabel(z.zone)}
                    </span>
                    <div style={{ flex:1, height:12, borderRadius:6, background:'rgba(255,255,255,0.04)', overflow:'hidden', position:'relative' }}>
                      <div style={{ width:`${pct}%`, height:'100%', borderRadius:6, background:'#3b82f6', transition:'width 0.5s' }} />
                    </div>
                    <span style={{ width:30, textAlign:'right', fontWeight:600, color:'#60a5fa' }}>{z.count}</span>
                    <span style={{ width:24, textAlign:'right', color:'rgba(255,255,255,0.4)' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'chart' && chartData.length >= 2 && (
        <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.7)', marginBottom:8 }}>📈 Динамика боли и PIP</div>
          <div style={{ position:'relative', height:160 }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(100, chartDays.length * 20)} 100`} preserveAspectRatio="none">
              {/* Y-axis grid lines */}
              {[0, 25, 50, 75, 100].map(y => (
                <line key={y} x1="0" y1={y} x2={Math.max(100, chartDays.length * 20)} y2={y}
                  stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              ))}
              {[0, 25, 50, 75, 100].map(y => (
                <text key={'y'+y} x="-10" y={y+3} fill="rgba(255,255,255,0.2)" fontSize="6">{10 - y/10}</text>
              ))}
              {/* Pain line */}
              <polyline points={chartPain.map((v, i) => `${i * 20 + 10},${100 - v * 10}`).join(' ')}
                fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {/* PIP line */}
              <polyline points={chartPip.map((v, i) => `${i * 20 + 10},${100 - v * 10}`).join(' ')}
                fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
              {/* Labels */}
              {chartDays.filter((_, i) => i % Math.max(1, Math.floor(chartDays.length / 8)) === 0).map((d, i, arr) => {
                const idx = chartDays.indexOf(d);
                return (
                  <text key={d} x={idx * 20 + 10} y="108" fill="rgba(255,255,255,0.25)" fontSize="6" textAnchor="middle">{d}</text>
                );
              })}
            </svg>
          </div>
          <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:8, fontSize:9 }}>
            <span style={{ display:'flex', alignItems:'center', gap:4, color:'rgba(255,255,255,0.5)' }}>
              <span style={{ width:12, height:3, borderRadius:2, background:'#f97316', display:'inline-block' }} /> Боль при введ.
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:4, color:'rgba(255,255,255,0.5)' }}>
              <span style={{ width:12, height:3, borderRadius:2, background:'#ef4444', display:'inline-block', border:'none' }} /> PIP
            </span>
          </div>
        </div>
      )}

      {viewMode === 'chart' && chartData.length < 2 && (
        <div style={{ textAlign:'center', padding:40, fontSize:11, color:'rgba(255,255,255,0.5)' }}>
          Для построения графика нужно минимум 2 записи
        </div>
      )}
    </div>
  );
};
