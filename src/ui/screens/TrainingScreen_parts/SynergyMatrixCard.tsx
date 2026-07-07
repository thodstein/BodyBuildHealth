/** SynergyMatrixCard.tsx — парная синергия/конфликт веществ (ранее неиспользуемый synergy-score).
 * REUSE SynergyEngine.calculatePair. Источник: SUPPORT_CATALOG_DATA (substances + synergies/conflicts). */
import React, { useState, useMemo } from 'react';
import { SynergyEngine, type SynergyResult } from '../../../engines/synergy-score.engine';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';
import type { MasterDB, SubstanceEntry, InteractionEntry } from '../../../core/types';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const SEL: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

const LEVEL_COLOR: Record<string, string> = { STRONG_SYNERGY: '#22c55e', GOOD_SYNERGY: '#86efac', NEUTRAL: '#94a3b8', WEAK_CONFLICT: '#fbbf24', DANGEROUS_CONFLICT: '#ef4444' };
const LEVEL_RU: Record<string, string> = { STRONG_SYNERGY: 'Сильная синергия', GOOD_SYNERGY: 'Хорошая синергия', NEUTRAL: 'Нейтрально', WEAK_CONFLICT: 'Слабый конфликт', DANGEROUS_CONFLICT: 'Опасный конфликт' };

// построить минимальный MasterDB из каталога
const { db, substances, idList } = (() => {
  const subs: SubstanceEntry[] = [];
  const interactions: InteractionEntry[] = [];
  const ids: { id: string; name: string }[] = [];
  for (const k of Object.keys(SUPPORT_CATALOG_DATA)) {
    const e: any = (SUPPORT_CATALOG_DATA as any)[k];
    if (!e || !e.id) continue;
    subs.push({ id: e.id, name: e.nameRu || e.name || e.id, category: Array.isArray(e.category) ? e.category.join('/') : (e.category || ''), mechanisms: e.mechanisms || [], risks: [] });
    ids.push({ id: e.id, name: e.nameRu || e.name || e.id });
    const sevN = (s: string) => s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1;
    for (const s of (e.synergies || [])) interactions.push({ substanceA: e.id, substanceB: s.with, type: 'synergy', severity: sevN(s.severity), mechanisms: (s.mechanism || '').split(/[,;]/).map((x:string)=>x.trim()).filter(Boolean), description: s.effect || '' });
    for (const c of (e.conflicts || [])) interactions.push({ substanceA: e.id, substanceB: c.with, type: s_conflictType(c.severity), severity: sevN(c.severity), mechanisms: (c.mechanism || '').split(/[,;]/).map((x:string)=>x.trim()).filter(Boolean), description: c.effect || '' });
  }
  function s_conflictType(sev: string): any { return sev === 'HIGH' ? 'danger' : 'conflict'; }
  const masterDB: MasterDB = { effects: [], substances: subs, interactions, goals: [], stackTemplates: [], stacks: [], analyses: [], organs: [], systems: [], mechanisms: [], axes: [], risks: [], recommendations: [], tags: [], bands: [], brands: [], aliases: {}, substanceGroups: {}, effectGroups: {}, synergyMatrix: {}, conflictMatrix: {} };
  return { db: masterDB, substances: subs, idList: ids.sort((a,b)=>a.name.localeCompare(b.name)) };
})();

export const SynergyMatrixCard: React.FC = () => {
  const [aId, setAId] = useState(idList[0]?.id || '');
  const [bId, setBId] = useState(idList[1]?.id || '');

  const subById = useMemo(() => { const m: Record<string, SubstanceEntry> = {}; substances.forEach(s => m[s.id] = s); return m; }, []);
  const result: SynergyResult | null = useMemo(() => {
    const a = subById[aId], b = subById[bId];
    if (!a || !b || aId === bId) return null;
    try { return SynergyEngine.calculatePair(a, b, db); } catch { return null; }
  }, [aId, bId, subById]);

  // top partners for A
  const topPartners = useMemo(() => {
    const a = subById[aId]; if (!a) return [];
    const rows: { id: string; name: string; res: SynergyResult }[] = [];
    for (const s of substances) {
      if (s.id === aId) continue;
      try { const r = SynergyEngine.calculatePair(a, s, db); rows.push({ id: s.id, name: s.name, res: r }); } catch {}
    }
    return rows.sort((x, y) => y.res.score - x.res.score).slice(0, 8);
  }, [aId, subById]);

  const sharedMechs = useMemo(() => { const a = subById[aId], b = subById[bId]; if (!a || !b) return []; return (a.mechanisms || []).filter(m => (b.mechanisms || []).includes(m)); }, [aId, bId, subById]);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🧬 Парная синергия веществ</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Анализ пары БАД/препаратов: общие механизмы, синергия/конфликт, уровень. Источник — каталог (SUPPORT_CATALOG_DATA: mechanisms + synergies/conflicts). Ранее SynergyEngine не использовался в UI.
      </div>

      <div style={CARD}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Вещество A</div>
            <select style={SEL} value={aId} onChange={e => setAId(e.target.value)}>
              {idList.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div><div style={LABEL}>Вещество B</div>
            <select style={SEL} value={bId} onChange={e => setBId(e.target.value)}>
              {idList.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
        </div>
        {result ? (
          <div style={{ background: (LEVEL_COLOR[result.level] || ACCENT) + '14', border: '1px solid ' + (LEVEL_COLOR[result.level] || ACCENT) + '40', borderRadius: 8, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: LEVEL_COLOR[result.level] || ACCENT }}>{LEVEL_RU[result.level] || result.level}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: LEVEL_COLOR[result.level] || ACCENT }}>{result.score}</span>
            </div>
            <div style={{ fontSize: 10, color: DIM }}>Общих механизмов: <b style={{ color: '#fff' }}>{sharedMechs.length}</b>{sharedMechs.length > 0 && <span> — {sharedMechs.slice(0,4).join(', ')}</span>}</div>
          </div>
        ) : <div style={{ fontSize: 10, color: DIM }}>Выберите два разных вещества.</div>}
      </div>

      <div style={CARD}>
        <div style={H}>🏆 Топ-партнёры для {subById[aId]?.name || 'A'}</div>
        {topPartners.length === 0
          ? <div style={{ fontSize: 10, color: DIM }}>Нет данных.</div>
          : topPartners.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={() => setBId(p.id)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', textAlign: 'left', flex: 1 }}>{p.name}</button>
              <span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_COLOR[p.res.level] || DIM, minWidth: 28, textAlign: 'right' }}>{p.res.score}</span>
              <span style={{ fontSize: 8, color: DIM, marginLeft: 6, minWidth: 90, textAlign: 'right' }}>{LEVEL_RU[p.res.level] || p.res.level}</span>
            </div>
          ))}
      </div>
    </div>
  );
};
