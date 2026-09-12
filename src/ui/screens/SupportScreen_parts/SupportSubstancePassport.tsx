/**
 * SupportSubstancePassport.tsx — P7: паспорт вещества.
 * Один экран: био + доза/UL + вес/пол/возраст + тайминг + синергия/конфликты + аналоги-хинт + лабы + грейд.
 * Собирается из существующих движков, новых чисел нет.
 */
import React, { useMemo, useState } from 'react';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-database';
import { buildBioavailabilityCatalog, THERAPEUTIC_WINDOWS, LAB_MARKERS, detectFormBioKey } from './SupportBioavailabilityData';
import { DOSE_RANGES } from './SupportEffectiveDose';
import { buildSubstancePassport } from '../../../engines/support-hub-passport.engine';
import { getProfile } from '../../../core/profile-manager';
import { S } from './SupportShared';

export const SupportSubstancePassport: React.FC = () => {
  const [search, setSearch] = useState('');
  // P7: помним последнее вещество (как he_bio_selected в био-каталоге)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem('he_bio_passport') || null; } catch { return null; }
  });
  const selectId = (id: string | null, name?: string) => {
    setSelectedId(id);
    if (name !== undefined) setSearch(name);
    try {
      if (id) localStorage.setItem('he_bio_passport', id);
      else localStorage.removeItem('he_bio_passport');
    } catch { /* quota/private */ }
  };
  const catalog = useMemo(() => buildBioavailabilityCatalog(), []);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter(e => e.nameRu.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)).slice(0, 12);
  }, [search, catalog]);

  const passport = useMemo(() => {
    if (!selectedId) return null;
    const entry = catalog.find(e => e.id === selectedId);
    if (!entry) return null;
    const raw: any = (SUPPORT_CATALOG_DATA as any)[selectedId] || {};
    let person: any = {};
    try {
      const p: any = getProfile();
      person = { weightKg: Number(p?.personal?.weight) || undefined, sex: p?.personal?.sex, age: Number(p?.personal?.age) || undefined };
    } catch { /* без профиля */ }
    const labKey = entry.windowKey;
    const labs = labKey && (LAB_MARKERS as any)[labKey] ? (LAB_MARKERS as any)[labKey].map((l: any) => ({ marker: l.marker, target: l.target })) : [];
    // P1: formKey — через канон detectFormBioKey (id форм каталога вроде magtein_2000
    // не совпадают с ключами био-таблицы; без маппинга всё падало в claim)
    const best = entry.bestForm || entry.forms[0];
    const formKey = best ? detectFormBioKey(best.name || '', best.nameRu || '', (best as any).notes) : 'standard';
    return buildSubstancePassport({
      id: entry.id,
      nameRu: entry.nameRu,
      maxBio: entry.maxBio,
      formKey,
      therapeutic: THERAPEUTIC_WINDOWS as any,
      ranges: DOSE_RANGES as any,
      category: entry.category,
      synergies: (raw.synergies || []).map((x: any) => ({ with: x.with, effect: x.effect })),
      conflicts: (raw.conflicts || []).map((x: any) => ({ with: x.with, effect: x.effect })),
      labMarkers: labs,
      person,
    });
  }, [selectedId, catalog]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
        Паспорт вещества: всё из хаба в одном месте. Новых чисел нет — сборка из био/дозы/тайминга/синергии/лабов.
      </div>
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa', marginBottom: 6 }}>📄 Паспорт вещества</div>
        <input value={search} onChange={e => { selectId(null); setSearch(e.target.value); }} placeholder="Введите название (магний, креатин, NAC...)"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(24,24,27,0.6)', color: '#fff', fontSize: 13, outline: 'none' }} />
        {filtered.length > 0 && !selectedId && (
          <div style={{ marginTop: 6, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            {filtered.map(e => (
              <div key={e.id} onClick={() => selectId(e.id, e.nameRu)}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {e.nameRu} <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>({e.id})</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {passport && (
        <div style={{ ...S.card, border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{passport.nameRu}</div>
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{passport.gradeLabel}</span>
          </div>
          {passport.bio && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>Био: {passport.bio.label} ({passport.bio.evidence}){passport.bio.marketing ? ' · ⚠ маркетинг' : ''}</div>}
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3 }}>
            Доза: {passport.dose.hasData ? `${passport.dose.min}–${passport.dose.max} ${passport.dose.unit} (опт. ${passport.dose.opt}) · UL ${passport.dose.ul} · ${passport.dose.note}` : passport.dose.note}
          </div>
          {passport.personHints.slice(0, 3).map((h, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.4 }}>• {h}</div>)}
          {passport.timing.slice(0, 3).map((t, i) => <div key={i} style={{ fontSize: 8, color: '#00e68a', lineHeight: 1.4 }}>⏰ {t}</div>)}
          {passport.conflictTop.slice(0, 3).map((t, i) => <div key={i} style={{ fontSize: 8, color: '#f59e0b', lineHeight: 1.4 }}>⚠ {t}</div>)}
          {passport.labs.slice(0, 3).map((t, i) => <div key={i} style={{ fontSize: 8, color: 'var(--text-dim)', lineHeight: 1.4 }}>🩸 {t}</div>)}
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{passport.analogHint}</div>
        </div>
      )}
    </div>
  );
};

export default SupportSubstancePassport;
