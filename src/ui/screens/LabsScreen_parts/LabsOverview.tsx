import React from 'react';
import type { LabPoint } from '../../../core/types';
import { UCUM_MAP } from '../../../core/constants';

const LAB_RANGES: Record<string, { min: number; max: number; name: string; unit: string }> = {};
// Build from UCUM_MAP
Object.entries(UCUM_MAP).forEach(([code, info]) => {
  LAB_RANGES[code] = { min: info.lln, max: info.uln, name: info.name, unit: info.prefUnit };
});

function getLabStatus(lab: LabPoint): 'normal' | 'high' | 'low' | 'unknown' {
  const range = LAB_RANGES[lab.code.toUpperCase()];
  if (!range) return 'unknown';
  if (lab.value > range.max) return 'high';
  if (lab.value < range.min) return 'low';
  return 'normal';
}

function getLabRefInfo(lab: LabPoint): string {
  const range = LAB_RANGES[lab.code.toUpperCase()];
  if (!range) return '';
  return `${range.min}вЂ“${range.max} ${range.unit}`;
}

export const LabsOverview: React.FC<{
  labs: LabPoint[];
  hasLabs: boolean;
  forceNoLabs: boolean;
  setForceNoLabs: (v: boolean) => void;
}> = ({ labs, hasLabs, forceNoLabs, setForceNoLabs }) => {
  const normalCount = labs.filter(l => getLabStatus(l) === 'normal').length;
  const highCount = labs.filter(l => getLabStatus(l) === 'high').length;
  const lowCount = labs.filter(l => getLabStatus(l) === 'low').length;
  const abnormalCount = highCount + lowCount;

  // Group labs by system
  const systemGroups: Record<string, LabPoint[]> = {};
  const labSystemMap: Record<string, string> = {
    // Cardiovascular
    'LDL': '', 'HDL': '', 'TG': '',
    'GLU': '', 'HBA1C': '', 'HOMOCYSTEINE': '',
    // Hepatic
    'ALT': '', 'AST': '', 'GGT': '', 'ALP': '',
    'BILIRUBIN_TOTAL': '', 'BIL_T': '', 'BIL': '', 'ALB': '',
    // Renal
    'CREATININE': '', 'BUN': '', 'EGFR': '', 'PROTEIN_TOTAL': '', 'TP': '', 'UA': '',
    // Endocrine
    'TSH': '', 'FT3': '', 'FT4': '',
    'TESTOSTERONE': '', 'TT': '', 'E2': '', 'ESTRADIOL': '',
    'PRL': '', 'PROLACTIN': '', 'CORTISOL': '',
    'INSULIN': '', 'INS': '', 'HOMA': '',
    'LH': '', 'FSH': '', 'SHBG': '',
    // Hematologic
    'HGB': '', 'HCT': '', 'PLT': '', 'WBC': '',
    'RBC': '', 'MCV': '', 'MCH': '',
    // Other
    'CRP': '', 'FERRITIN': '', 'VITD': '', 'CALCIDIOL': '',
    'IGF1': '', 'DHEA_S': '', 'PSA': '',
    'PROGESTERONE': '', 'AMH': '', 'INHB': '',
  };

  labs.forEach(lab => {
    const system = labSystemMap[lab.code.toUpperCase()] || '';
    if (!systemGroups[system]) systemGroups[system] = [];
    systemGroups[system].push(lab);
  });

  return (
    <div className="labs-overview">
      {!hasLabs && !forceNoLabs && (
        <div style={{ background: 'rgba(239,68,68,0.15)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>вљ пёЏ Р’РЅРёРјР°РЅРёРµ!</strong> РќРµС‚ РґР°РЅРЅС‹С… Р°РЅР°Р»РёР·РѕРІ. РќРµРєРѕС‚РѕСЂС‹Рµ С„СѓРЅРєС†РёРё РјРѕРіСѓС‚ Р±С‹С‚СЊ РѕРіСЂР°РЅРёС‡РµРЅС‹.
          РџРµСЂРµР№РґРёС‚Рµ РЅР° РІРєР»Р°РґРєСѓ В«Р РµР·СѓР»СЊС‚Р°С‚С‹В» РґР»СЏ РІРІРѕРґР° РґР°РЅРЅС‹С….
        </div>
      )}

      {forceNoLabs && (
        <div style={{ background: 'rgba(239,68,68,0.2)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>рџљ« РџСЂРёРјРµРЅРµРЅ С€С‚СЂР°С„ Р·Р° РѕС‚СЃСѓС‚СЃС‚РІРёРµ Р°РЅР°Р»РёР·РѕРІ</strong>
        </div>
      )}

      {/* Stats Summary */}
      <div className="card">
        <h3>рџ“‹ РЎС‚Р°С‚РёСЃС‚РёРєР° Р°РЅР°Р»РёР·РѕРІ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Р’СЃРµРіРѕ</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{labs.length}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#22c55e' }}>вњ“ РќРѕСЂРјР°</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{normalCount}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#ef4444' }}>в†‘ Р’С‹С€Рµ РЅРѕСЂРјС‹</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{highCount}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#f97316' }}>в†“ РќРёР¶Рµ РЅРѕСЂРјС‹</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f97316' }}>{lowCount}</div>
          </div>
        </div>
        {abnormalCount > 0 && (
          <div style={{ marginTop: 8, padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 6, fontSize: 12 }}>
            вљ пёЏ <strong>{abnormalCount}</strong> РёР· {labs.length} РїРѕРєР°Р·Р°С‚РµР»РµР№ РІРЅРµ РЅРѕСЂРјС‹ ({highCount} в†‘, {lowCount} в†“)
          </div>
        )}
      </div>

      {/* Lab Values by System */}
      {labs.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>рџ”¬ РџРѕРєР°Р·Р°С‚РµР»Рё РїРѕ СЃРёСЃС‚РµРјР°Рј</h3>
          {Object.entries(systemGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([system, systemLabs]) => (
              <div key={system} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--accent)' }}>{system}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {systemLabs.sort((a, b) => {
                    const sa = getLabStatus(a);
                    const sb = getLabStatus(b);
                    const priority: Record<string, number> = { high: 0, low: 1, unknown: 2, normal: 3 };
                    return (priority[sa] ?? 2) - (priority[sb] ?? 2);
                  }).map(lab => {
                    const status = getLabStatus(lab);
                    const refInfo = getLabRefInfo(lab);
                    const statusColor = status === 'high' ? '#ef4444' : status === 'low' ? '#f97316' : '#22c55e';
                    const statusIcon = status === 'high' ? 'в†‘' : status === 'low' ? 'в†“' : 'вњ“';
                    return (
                      <div key={lab.code + '-' + lab.date} style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 500 }}>{lab.name || lab.code}</span>
                          {refInfo && <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 4 }}>({refInfo})</span>}
                        </div>
                        <div>
                          <span style={{ fontWeight: 700, color: statusColor }}>{lab.value}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 2 }}>{lab.unit || ''}</span>
                          <span style={{ marginLeft: 4, color: statusColor }}>{statusIcon}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
