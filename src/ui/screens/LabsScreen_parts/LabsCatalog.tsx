import React, { useState } from 'react';
import { UCUM_MAP } from '../../../core/constants';

interface LabCatalogEntry {
  code: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  system: string;
  description: string;
}

const LAB_SYSTEM_MAP: Record<string, string> = {
  'ALT': '', 'AST': '', 'GGT': '', 'ALP': '',
  'BILIRUBIN_TOTAL': '', 'BIL_T': '', 'BIL': '', 'ALB': '',
  'CREATININE': '', 'BUN': '', 'EGFR': '', 'PROTEIN_TOTAL': '',
  'TP': '', 'UA': '',
  'TSH': '', 'FT3': '', 'FT4': '',
  'TT': '', 'E2': '', 'PRL': '',
  'LH': '', 'FSH': '', 'SHBG': '',
  'CORTISOL': '', 'INS': '', 'HOMA': '',
  'IGF1': '', 'DHEA_S': '',
  'HGB': '', 'HCT': '', 'PLT': '', 'WBC': '',
  'LDL': '', 'HDL': '', 'TG': '', 'GLU': '', 'GLUCOSE': '',
  'HBA1C': '', 'HOMOCYSTEINE': '',
  'FERRITIN': '', 'VITD': '', 'CALCIDIOL': '',
  'CRP': '', 'PROGESTERONE': '', 'AMH': '', 'INHB': '',
  'PSA': '',
};

const LAB_DESCRIPTIONS: Record<string, string> = {
  'ALT': '',
  'AST': '',
  'GGT': 'О“-РіР»СѓС‚Р°РјРёР»С‚СЂР°РЅСЃС„РµСЂР°Р·Р°. Р§СѓРІСЃС‚РІРёС‚РµР»СЊРЅС‹Р№ РјР°СЂРєС‘СЂ С…РѕР»РµСЃС‚Р°Р·Р° Рё Р°Р»РєРѕРіРѕР»СЊРЅРѕРіРѕ РїРѕСЂР°Р¶РµРЅРёСЏ. РџРѕРІС‹С€Р°РµС‚СЃСЏ РїСЂРё РїСЂРёС‘РјРµ РѕСЂР°Р»СЊРЅС‹С… РђРђРЎ.',
  'HCT': '',
  'HGB': '',
  'PLT': '',
  'WBC': '',
  'TT': '',
  'E2': '',
  'PRL': '',
  'LH': '',
  'FSH': '',
  'SHBG': '',
  'CRP': '',
  'HBA1C': '',
  'LDL': '',
  'HDL': '',
  'TG': '',
  'GLU': '',
  'INS': '',
  'HOMA': 'HOMA-IR. РРЅСЃСѓР»РёРЅ Г— Р“Р»СЋРєРѕР·Р° / 22.5. >2.7 вЂ” РёРЅСЃСѓР»РёРЅРѕСЂРµР·РёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ.',
  'CREATININE': '',
  'CORTISOL': '',
  'IGF1': '',
  'TSH': '',
  'FT3': '',
  'FT4': '',
  'FERRITIN': '',
  'VITD': '',
  'ALP': '',
  'BILIRUBIN_TOTAL': '',
  'PROTEIN_TOTAL': '',
  'BUN': '',
  'EGFR': '',
  'HOMOCYSTEINE': '',
  'UA': '',
  'DHEA_S': '',
  'AMH': '',
  'INHB': '',
  'PSA': '',
};

// Build catalog entries from UCUM_MAP
const catalogEntries: LabCatalogEntry[] = Object.entries(UCUM_MAP).map(([code, info]) => ({
  code,
  name: info.name,
  unit: info.prefUnit,
  min: info.lln,
  max: info.uln,
  system: LAB_SYSTEM_MAP[code] || '',
  description: LAB_DESCRIPTIONS[code] || '',
}));

export const LabsCatalog: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterSystem, setFilterSystem] = useState<string>('all');

  const systems = [...new Set(catalogEntries.map(e => e.system))].sort();

  const filtered = catalogEntries.filter(e => {
    const matchSearch = !search ||
      e.code.toLowerCase().includes(search.toLowerCase()) ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    const matchSystem = filterSystem === 'all' || e.system === filterSystem;
    return matchSearch && matchSystem;
  });

  return (
    <div className="labs-catalog">
      <div className="card">
        <h3>рџ“– РљР°С‚Р°Р»РѕРі Р°РЅР°Р»РёР·РѕРІ</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          РЎРїСЂР°РІРѕС‡РЅРёРє Р»Р°Р±РѕСЂР°С‚РѕСЂРЅС‹С… РјР°СЂРєРµСЂРѕРІ СЃ СЂРµС„РµСЂРµРЅСЃРЅС‹РјРё Р·РЅР°С‡РµРЅРёСЏРјРё Рё РѕРїРёСЃР°РЅРёСЏРјРё. Р’СЃРµРіРѕ: {catalogEntries.length} РјР°СЂРєРµСЂРѕРІ.
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder=""
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', marginBottom: 8, fontSize: 13 }}
        />

        {/* System filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            onClick={() => setFilterSystem('all')}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: filterSystem === 'all' ? 'var(--accent)' : 'transparent', color: filterSystem === 'all' ? '#000' : 'var(--text)', fontSize: 11, cursor: 'pointer' }}
          >
            Р’СЃРµ ({catalogEntries.length})
          </button>
          {systems.map(sys => {
            const count = catalogEntries.filter(e => e.system === sys).length;
            return (
              <button
                key={sys}
                onClick={() => setFilterSystem(sys)}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: filterSystem === sys ? 'var(--accent)' : 'transparent', color: filterSystem === sys ? '#000' : 'var(--text)', fontSize: 11, cursor: 'pointer' }}
              >
                {sys} ({count})
              </button>
            );
          })}
        </div>

        {/* Entries */}
        <div style={{ display: 'grid', gap: 6 }}>
          {filtered.map(entry => (
            <div key={entry.code} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{entry.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>({entry.code})</span>
                </div>
                <div style={{ fontSize: 11, background: 'rgba(0,230,138,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                  {entry.min}вЂ“{entry.max} {entry.unit}
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>{entry.system}</div>
              {entry.description && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{entry.description}</div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
            РќРёС‡РµРіРѕ РЅРµ РЅР°Р№РґРµРЅРѕ РїРѕ Р·Р°РїСЂРѕСЃСѓ В«{search}В»
          </div>
        )}
      </div>
    </div>
  );
};
