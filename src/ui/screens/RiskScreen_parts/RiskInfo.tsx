import React, { useState } from 'react';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS, DRUG_THRESHOLDS, GENETIC_MULTIPLIERS, MRR_FACTORS, HGI_FACTORS, RIR_FACTORS, SUPPORT_BASE_COVERAGE, BASE_RISK } from '../../../core/constants';
import { MECHANISM_INFO, SYSTEM_INFO, SYSTEM_INFO_ALL, SYSTEM_ORGANS } from '../../../core/risk-info';
import { SYSTEM_MECHANISMS } from '../../../core/system-mechanisms';
import { PHARMA_DB } from '../../../core/pharma-database';

function getThresholdName(id: string): string {
  const direct = PHARMA_DB[id];
  if (direct) return direct.name;
  const normId = id.replace(/[_\-\s]/g, '').toLowerCase();
  for (const [key, val] of Object.entries(PHARMA_DB)) {
    const normKey = key.replace(/[_\-\s]/g, '').toLowerCase();
    if (normKey === normId) return val.name;
    if (normKey.includes(normId) || normId.includes(normKey)) return val.name;
  }
  return id.replace(/_/g, ' ');
}

export const RiskInfo: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [methodTab, setMethodTab] = useState<'v7' | 'classic'>('classic');

  const toggle = (id: string) => setExpanded(expanded === id ? null : id);

  return (
    <div className="risk-info">
      {/* РћР±С‰РµРµ РѕРїРёСЃР°РЅРёРµ */}
      <div className="card" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>рџ“ќ Р¤РѕСЂРјСѓР»С‹ СЂР°СЃС‡С‘С‚Р° СЂРёСЃРєРѕРІ</h3>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, margin: '0 0 8px' }}>
          Health Engine v9 РёСЃРїРѕР»СЊР·СѓРµС‚ <strong>4 РЅРµР·Р°РІРёСЃРёРјС‹С… РјРµС‚РѕРґР°</strong> СЂР°СЃС‡С‘С‚Р° СЂРёСЃРєРѕРІ:
        </p>
        <div style={{ background: 'rgba(0,230,138,0.08)', padding: 8, borderRadius: 8, fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          <strong>1. V7 Р‘Р°Р·РѕРІС‹Р№</strong> вЂ” 14 СЃРёСЃС‚РµРј Г— 7-9 РјРµС…Р°РЅРёР·РјРѕРІ (105). baseRisk Г— doseRatio Г— G Г— N Г— T Г— MRR Г— HGI Г— RIR + PD<br/>
          <strong>2. V7 + РњРѕРЅС‚Рµ-РљР°СЂР»Рѕ</strong> вЂ” PK-РЅР°РєРѕРїР»РµРЅРёРµ в†’ Hill в†’ MC-СЃРёРјСѓР»СЏС†РёСЏ (10K, Пѓ=15%) в†’ 95-Р№ РїРµСЂС†РµРЅС‚РёР»СЊ<br/>
          <strong>3. MDSS v2.0</strong> вЂ” Hill(XВІ/(EC50ВІ+XВІ)) в†’ MC(all markers) в†’ Sigmoid(100/(1+e^(-kВ·(Z-Z_crit)))) СЃ overflow guard<br/>
          <strong>4. РљР»РёРЅРёС‡РµСЃРєРёРµ РїР°С‚РѕР»РѕРіРёРё</strong> вЂ” 28 РїР°С‚РѕР»РѕРіРёР№, 70+ РјР°СЂРєРµСЂРѕРІ, СЃРІСЏР·СЊ РїСЂРµРїР°СЂР°С‚в†’РїР°С‚РѕР»РѕРіРёСЏ. Hill в†’ MC в†’ Sigmoid<br/>
          <br/>
          <strong>Raw</strong> вЂ” СЂРёСЃРє Р±РµР· СѓС‡С‘С‚Р° РїРѕРґРґРµСЂР¶РєРё. <strong>Net</strong> вЂ” СЃ СѓС‡С‘С‚РѕРј Р‘РђР”РѕРІ Рё РѕР±СЂР°Р·Р° Р¶РёР·РЅРё.
        </div>
      </div>

      {/* в”Ђв”Ђ MDSS Pipeline description в”Ђв”Ђ */}
      <div className="card risk-section" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('mdss-pipeline')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>рџ§¬ MDSS v2.0 вЂ” РўСЂРё РјРѕРґРµР»Рё СЂР°СЃС‡С‘С‚Р°</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'mdss-pipeline' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'mdss-pipeline' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px', color: 'var(--accent)' }}>
              РЎРёСЃС‚РµРјР° РёСЃРїРѕР»СЊР·СѓРµС‚ 3 РЅРµР·Р°РІРёСЃРёРјС‹С… РјРµС‚РѕРґР° СЂР°СЃС‡С‘С‚Р° РґР»СЏ РїРѕРІС‹С€РµРЅРёСЏ С‚РѕС‡РЅРѕСЃС‚Рё РїСЂРѕРіРЅРѕР·Р°:
            </p>

            <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 8, marginBottom: 8 }}>
              <strong style={{ color: '#60a5fa' }}>1. V7 Р‘Р°Р·РѕРІС‹Р№ СЂР°СЃС‡С‘С‚</strong>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                РљР»Р°СЃСЃРёС‡РµСЃРєРёР№ РґРІРёР¶РѕРє: baseRisk Г— doseRatio Г— G Г— N Г— T Г— MRR Г— HGI Г— RIR + PD
                <br/>14 СЃРёСЃС‚РµРј Г— 7-9 РјРµС…Р°РЅРёР·РјРѕРІ = 105 РїР°СЂР°РјРµС‚СЂРѕРІ. РђРіСЂРµРіР°С†РёСЏ: РіРµРѕРјРµС‚СЂРёС‡РµСЃРєРѕРµ СЃСЂРµРґРЅРµРµ.
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 8, marginBottom: 8 }}>
              <strong style={{ color: '#f59e0b' }}>2. РњРѕРЅС‚Рµ-РљР°СЂР»Рѕ (V7 + MC)</strong>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                PK-РјРѕРґРµР»СЊ (РЅР°РєРѕРїР»РµРЅРёРµ) в†’ Hill (РґРѕР·Р°-РѕС‚РІРµС‚) в†’ 7 РјРµС…Р°РЅРёР·РјРѕРІ в†’ MC-СЃРёРјСѓР»СЏС†РёСЏ (10K РёС‚РµСЂР°С†РёР№, Пѓ=15%)
                <br/>Р’РѕР·РІСЂР°С‰Р°РµС‚ 95-Р№ РїРµСЂС†РµРЅС‚РёР»СЊ СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ СЂРёСЃРєР°.
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 8, marginBottom: 8 }}>
              <strong style={{ color: '#8b5cf6' }}>3. MDSS v2.0 (Hill + MC + Sigmoid)</strong>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                <strong>Hill:</strong> XВІ/(EC50ВІ+XВІ) РґР»СЏ РєР°Р¶РґРѕРіРѕ Р±РёРѕРјР°СЂРєРµСЂР° (n=2.0)<br/>
                <strong>MC:</strong> Р“РµРѕРјРµС‚СЂРёС‡РµСЃРєРѕРµ СЃСЂРµРґРЅРµРµ РІСЃРµС… Hill-РѕС†РµРЅРѕРє РѕСЂРіР°РЅР° + Box-Muller С€СѓРј в†’ 95-Р№ РїРµСЂС†РµРЅС‚РёР»СЊ<br/>
                <strong>Sigmoid:</strong> 100/(1+exp(-kВ·(Z-Z_crit))) СЃ overflow guard (В±50)<br/>
                <strong>Z_total:</strong> sev95 Г— t_weeks Г— genFactor Г— compliancePenalty<br/>
                <strong>14 СЃРёСЃС‚РµРј РѕСЂРіР°РЅРѕРІ:</strong> РїРѕС‡РєРё, РїРµС‡РµРЅСЊ, СЃРµСЂРґС†Рµ, СЃРѕСЃСѓРґС‹, Р¦РќРЎ, СЌРЅРґРѕРєСЂРёРЅРЅР°СЏ, РєСЂРѕРІРµС‚РІРѕСЂРЅР°СЏ, РёРјРјСѓРЅРЅР°СЏ, РјРµС‚Р°Р±РѕР»РёР·Рј, GH/IGF, РћР”Рђ, С‰РёС‚РѕРІРёРґРЅР°СЏ, РїСЂРѕСЃС‚Р°С‚Р°, РєРѕР¶Р°<br/>
                <strong>Compliance:</strong> РµСЃР»Рё Р°РЅР°Р»РёР·С‹ {'>'} 4 РЅРµРґ вЂ” С€С‚СЂР°С„ Г—(1.0 + (РЅРµРґРµР»Рё-4)В·0.15)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* в”Ђв”Ђ Clinical Pathology section в”Ђв”Ђ */}
      <div className="card risk-section" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('clinical')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>рџЏҐ РљР»РёРЅРёС‡РµСЃРєРёРµ РїР°С‚РѕР»РѕРіРёРё (4-СЏ РјРѕРґРµР»СЊ)</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'clinical' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'clinical' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px' }}>
              Р§РµС‚РІС‘СЂС‚Р°СЏ РјРѕРґРµР»СЊ РЅР°РїСЂСЏРјСѓСЋ СЃРІСЏР·С‹РІР°РµС‚ РїСЂРµРїР°СЂР°С‚С‹ СЃ РєРѕРЅРєСЂРµС‚РЅС‹РјРё РјРµРґРёС†РёРЅСЃРєРёРјРё РїР°С‚РѕР»РѕРіРёСЏРјРё С‡РµСЂРµР· РєР»РёРЅРёС‡РµСЃРєСѓСЋ Р±Р°Р·Сѓ РґР°РЅРЅС‹С….
            </p>
            <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 8, marginBottom: 6 }}>
              <strong style={{ color: '#ec4899' }}>Р‘Р°Р·Р° РґР°РЅРЅС‹С…:</strong>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                вЂў 28 РїР°С‚РѕР»РѕРіРёР№ РІ 8 СЃРёСЃС‚РµРјР°С… РѕСЂРіР°РЅРѕРІ<br/>
                вЂў 70+ РєР»РёРЅРёС‡РµСЃРєРёС… Р±РёРѕРјР°СЂРєРµСЂРѕРІ СЃ СЌРјРїРёСЂРёС‡РµСЃРєРёРјРё EC50<br/>
                вЂў 13 РїСЂРµРїР°СЂР°С‚РѕРІ (РІСЃРµ РєР»Р°СЃСЃС‹ РђРђРЎ + Р“Р  + РёРЅСЃСѓР»РёРЅ + РїРµРїС‚РёРґС‹)<br/>
                вЂў РљР°Р¶РґС‹Р№ РїСЂРµРїР°СЂР°С‚ в†’ СЃРїРёСЃРѕРє СЂРёСЃРєРѕРІ в†’ Р»Р°Р±РѕСЂР°С‚РѕСЂРЅР°СЏ РїР°РЅРµР»СЊ в†’ РёРЅСЃС‚СЂСѓРјРµРЅС‚Р°Р»СЊРЅР°СЏ РІРµСЂРёС„РёРєР°С†РёСЏ
              </div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 8, marginBottom: 6 }}>
              <strong style={{ color: '#8b5cf6' }}>Pipeline:</strong>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                1. <strong>Hill function:</strong> XВІ/(EC50ВІ+XВІ) вЂ” РґР»СЏ РєР°Р¶РґРѕРіРѕ РјР°СЂРєРµСЂР° СЃ СѓС‡С‘С‚РѕРј inverted (NO, HDL, LH, FSH, eGFR, Glucose, Testosterone)<br/>
                2. <strong>Monte Carlo:</strong> 10K РёС‚РµСЂР°С†РёР№, Пѓ=15%, 95-Р№ РїРµСЂС†РµРЅС‚РёР»СЊ<br/>
                3. <strong>Sigmoid:</strong> 100/(1+exp(-kВ·(Z_total-Z_crit))) вЂ” РїРµСЂСЃРѕРЅР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Рµ k Рё Z_crit РґР»СЏ РєР°Р¶РґРѕР№ РїР°С‚РѕР»РѕРіРёРё<br/>
                4. <strong>Compliance penalty:</strong> Г—(1.0 + (weeks_since_lab - 4) Г— 0.15) РїСЂРё РїСЂРѕСЃСЂРѕС‡РєРµ Р°РЅР°Р»РёР·РѕРІ {'>'} 4 РЅРµРґ
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              <strong>8 СЃРёСЃС‚РµРј:</strong> РЎРµСЂРґРµС‡РЅРѕ-СЃРѕСЃСѓРґРёСЃС‚Р°СЏ (7 РїР°С‚.) В· Р“РµРїР°С‚РѕР±РёР»РёР°СЂРЅР°СЏ (4) В· РќРµС„СЂРѕР»РѕРіРёС‡РµСЃРєР°СЏ (3) В· Р­РЅРґРѕРєСЂРёРЅРЅР°СЏ (4) В· Р РµРїСЂРѕРґСѓРєС‚РёРІРЅР°СЏ/HPTA (3) В· Р¦РќРЎ (2) В· РРјРјСѓРЅРЅР°СЏ/РєРѕР¶Р° (2) В· РћРїРѕСЂРЅРѕ-РґРІРёРіР°С‚РµР»СЊРЅР°СЏ (2)
            </div>
          </div>
        )}
      </div>

      {/* Р‘Р°Р·РѕРІР°СЏ С„РѕСЂРјСѓР»Р° */}
      <div className="card risk-section" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('base')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>рџ“Љ Р‘Р°Р·РѕРІР°СЏ С„РѕСЂРјСѓР»Р° СЂРёСЃРєР°</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'base' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'base' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', marginBottom: 8 }}>
{`Raw(system, mech) = max(7, min(100,
  (1 - в€Џ(1 - baseRisk Г— doseRatio Г— G Г— N Г— T Г— MRR Г— HGI Г— RIR)) Г— 100
  + pdFactor Г— 15
))

Net(system, mech) = Raw Г— (1 - coverage)

OverallRaw = geom(allSystems) Г— overallMRR Г— overallHGI Г— (2 - overallRIR)
OverallNet  = geom(allSystems) Г— overallMRR Г— overallHGI Г— (2 - overallRIR)`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>baseRisk</strong> = {BASE_RISK} вЂ” РєРѕРЅСЃС‚Р°РЅС‚Р° Р±Р°Р·РѕРІРѕРіРѕ СЂРёСЃРєР°</p>
            <p style={{ margin: '0 0 4px' }}><strong>в€Џ drugs</strong> вЂ” РїСЂРѕРёР·РІРµРґРµРЅРёРµ РїРѕ РІСЃРµРј Р°РєС‚РёРІРЅС‹Рј РїСЂРµРїР°СЂР°С‚Р°Рј (РјРѕРґРµР»СЊ В«РЅРµР·Р°РІРёСЃРёРјРѕРіРѕ СЂРёСЃРєР°В»)</p>
            <p style={{ margin: '0 0 4px' }}><strong>pdFactor</strong> вЂ” РІРєР»Р°Рґ С„Р°СЂРјР°РєРѕРґРёРЅР°РјРёРєРё РїСЂРµРїР°СЂР°С‚Р° РІ РєРѕРЅРєСЂРµС‚РЅСѓСЋ СЃРёСЃС‚РµРјСѓ</p>
            <p style={{ margin: '0 0 4px' }}><strong>coverage</strong> вЂ” РєРѕСЌС„С„РёС†РёРµРЅС‚ Р·Р°С‰РёС‚С‹ (Р‘РђР”С‹, РїСЂРµРїР°СЂР°С‚С‹ РїРѕРґРґРµСЂР¶РєРё)</p>
            <p style={{ margin: '0 0 4px' }}><strong>geom()</strong> вЂ” РіРµРѕРјРµС‚СЂРёС‡РµСЃРєРѕРµ СЃСЂРµРґРЅРµРµ РїРѕ РІСЃРµРј СЃРёСЃС‚РµРјР°Рј/РјРµС…Р°РЅРёР·РјР°Рј</p>
          </div>
        )}
      </div>

      {/* РњРµС‚РѕРґ СЂР°СЃС‡С‘С‚Р° (С‚Р°Р±-РїРµСЂРµРєР»СЋС‡Р°С‚РµР»СЊ) */}
      <div className="card risk-section" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('method')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>рџ”¬ РњРµС‚РѕРґ СЂР°СЃС‡С‘С‚Р° СЂРёСЃРєРѕРІ</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'method' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'method' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <button
                onClick={() => setMethodTab('v7')}
                style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid var(--border)', background: methodTab === 'v7' ? 'var(--accent)' : 'transparent', color: methodTab === 'v7' ? '#000' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer', fontWeight: methodTab === 'v7' ? 700 : 400 }}
              >V7 РЎРёРјСѓР»СЏС†РёСЏ</button>
              <button
                onClick={() => setMethodTab('classic')}
                style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid var(--border)', background: methodTab === 'classic' ? 'var(--accent)' : 'transparent', color: methodTab === 'classic' ? '#000' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer', fontWeight: methodTab === 'classic' ? 700 : 400 }}
              >РћР±Р·РѕСЂ (РєР»Р°СЃСЃРёС‡РµСЃРєРёР№)</button>
            </div>

            {methodTab === 'v7' && (
              <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                <div style={{ background: 'rgba(0,230,138,0.08)', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                  <strong>V7 вЂ” РјРЅРѕРіРѕСѓСЂРѕРІРЅРµРІР°СЏ СЃРёРјСѓР»СЏС†РёСЏ В«РІРµС‰РµСЃС‚РІРѕ в†’ PK в†’ Hill в†’ СЃРёРіРЅР°Р»РёРЅРі в†’ 7 РјРµС…Р°РЅРёР·РјРѕРІ в†’ MC в†’ СЃРёСЃС‚РµРјР° в†’ СЂРёСЃРєВ»</strong>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 10, marginBottom: 8, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
{`1. PK-РјРѕРґРµР»СЊ (2-РєР°РјРµСЂРЅР°СЏ):
   C(t) = (D/Vd) Г— (ka/(ka-k10)) Г— (e^(-k10В·t) - e^(-kaВ·t))
   СЃ РЅР°РєРѕРїР»РµРЅРёРµРј РїСЂРё РїРѕРІС‚РѕСЂРЅС‹С… РґРѕР·Р°С…

2. Hill-С„СѓРЅРєС†РёСЏ (СЃРёРіРЅР°Р»РёРЅРі):
   Effect = Emax Г— C^n / (C^n + EC50^n)
   n = РєРѕСЌС„С„РёС†РёРµРЅС‚ РҐРёР»Р»Р° (РєСЂСѓС‚РёР·РЅР° РґРѕР·Рѕ-РѕС‚РІРµС‚Р°)

3. РЎРёРіРЅР°Р»РёРЅРі в†’ 7 РјРµС…Р°РЅРёР·РјРѕРІ:
   вЂў AR-Р°РєС‚РёРІР°С†РёСЏ      вЂў РђСЂРѕРјР°С‚РёР·Р°С†РёСЏ
   вЂў 5О±-СЂРµРґСѓРєС†РёСЏ       вЂў РџСЂРѕРіРµСЃС‚РѕРіРµРЅРЅРѕСЃС‚СЊ
   вЂў Р“РµРїР°С‚РѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ вЂў Р›РёРїРёРґРЅС‹Р№ РїСЂРѕС„РёР»СЊ
   вЂў HCT-РЅР°РіСЂСѓР·РєР°      вЂў РќРµР№СЂРѕС‚РѕРєСЃРёС‡РЅРѕСЃС‚СЊ

4. 7 РѕР±С‰РёС… РјРµС…Р°РЅРёР·РјРѕРІ (MC):
   mechContribution = baseRisk Г— mechWeight Г— 
     doseRatio Г— G Г— N Г— T Г— MRR Г— HGI Г— (2 - RIR)

5. РЎРёСЃС‚РµРјРЅР°СЏ Р°РіСЂРµРіР°С†РёСЏ:
   systemRisk = max(7, min(100, geom(allMechs) + pdFactor Г— 15))

6. РС‚РѕРіРѕРІС‹Р№ СЂРёСЃРє:
   OverallNet = geom(allSystems) Г— overallMRR Г—
     overallHGI Г— (2 - overallRIR) Г— (1 - coverage)`}
                </div>
                <div style={{ display: 'grid', gap: 4, fontSize: 10 }}>
                  <div style={{ background: 'rgba(59,130,246,0.08)', padding: 6, borderRadius: 6 }}>
                    <strong>PK в†’ Hill</strong>: РљРѕРЅС†РµРЅС‚СЂР°С†РёСЏ РїСЂРµРїР°СЂР°С‚Р° РІРѕ РІСЂРµРјРµРЅРё РїСЂРµРѕР±СЂР°Р·СѓРµС‚СЃСЏ РІ С„Р°СЂРјР°РєРѕРґРёРЅР°РјРёС‡РµСЃРєРёР№ СЌС„С„РµРєС‚ С‡РµСЂРµР· СЃРёРіРјРѕРёРґР°Р»СЊРЅСѓСЋ Hill-С„СѓРЅРєС†РёСЋ
                  </div>
                  <div style={{ background: 'rgba(139,92,246,0.08)', padding: 6, borderRadius: 6 }}>
                    <strong>Hill в†’ 7 РјРµС…Р°РЅРёР·РјРѕРІ</strong>: Р­С„С„РµРєС‚ СЂР°СЃРїСЂРµРґРµР»СЏРµС‚СЃСЏ РїРѕ РјРµС…Р°РЅРёР·РјР°Рј РїРѕРІСЂРµР¶РґРµРЅРёСЏ РїСЂРѕРїРѕСЂС†РёРѕРЅР°Р»СЊРЅРѕ PD-РїР°СЂР°РјРµС‚СЂР°Рј РїСЂРµРїР°СЂР°С‚Р°
                  </div>
                  <div style={{ background: 'rgba(234,179,8,0.08)', padding: 6, borderRadius: 6 }}>
                    <strong>7 РјРµС…Р°РЅРёР·РјРѕРІ в†’ MC</strong>: РљР°Р¶РґС‹Р№ РјРµС…Р°РЅРёР·Рј СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ СЃ СѓС‡С‘С‚РѕРј РґРѕР·С‹, РіРµРЅРµС‚РёРєРё, РїРёС‚Р°РЅРёСЏ, С‚СЂРµРЅРёСЂРѕРІРѕРє, Р°РЅР°Р»РёР·РѕРІ
                  </div>
                  <div style={{ background: 'rgba(0,230,138,0.08)', padding: 6, borderRadius: 6 }}>
                    <strong>MC в†’ СЃРёСЃС‚РµРјР° в†’ СЂРёСЃРє</strong>: РњРµС…Р°РЅРёР·РјС‹ Р°РіСЂРµРіРёСЂСѓСЋС‚СЃСЏ РіРµРѕРјРµС‚СЂРёС‡РµСЃРєРёРј СЃСЂРµРґРЅРёРј РІ СЃРёСЃС‚РµРјРЅС‹Р№ СЂРёСЃРє, Р·Р°С‚РµРј СѓС‡РёС‚С‹РІР°РµС‚СЃСЏ Р·Р°С‰РёС‚Р° (coverage)
                  </div>
                </div>
              </div>
            )}

            {methodTab === 'classic' && (
              <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                <div style={{ background: 'rgba(0,230,138,0.08)', padding: 10, borderRadius: 8, marginBottom: 8 }}>
                  <strong>Health Engine v9 вЂ” РєР»Р°СЃСЃРёС‡РµСЃРєР°СЏ С„РѕСЂРјСѓР»Р° Р°РіСЂРµРіР°С†РёРё СЂРёСЃРєРѕРІ</strong>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 10, marginBottom: 8, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
{`РС‚РѕРіРѕРІР°СЏ С„РѕСЂРјСѓР»Р°:
OverallNet = geom(allSystems) Г— 
  overallMRR Г— overallHGI Г— (2 - overallRIR)

Р“РґРµ:
вЂў geom(allSystems) вЂ” РіРµРѕРјРµС‚СЂРёС‡РµСЃРєРѕРµ СЃСЂРµРґРЅРµРµ СЂРёСЃРєРѕРІ РїРѕ 
  18 СЃРёСЃС‚РµРјР°Рј РѕСЂРіР°РЅРѕРІ (РєР°СЂРґРёРѕ, РїРµС‡РµРЅСЊ, РїРѕС‡РєРё Рё С‚.Рґ.)

вЂў overallMRR вЂ” СЃСЂРµРґРЅРµРµ РѕС‚РєР»РѕРЅРµРЅРёРµ Р»Р°Р±РѕСЂР°С‚РѕСЂРЅС‹С… 
  РїРѕРєР°Р·Р°С‚РµР»РµР№ РѕС‚ РЅРѕСЂРјС‹ РїРѕ РІСЃРµРј СЃРёСЃС‚РµРјР°Рј

вЂў overallHGI вЂ” Р°РіСЂРµРіРёСЂРѕРІР°РЅРЅС‹Р№ РІРѕСЃРїР°Р»РёС‚РµР»СЊРЅС‹Р№ РёРЅРґРµРєСЃ 
  (CRP, IL-6, TNF-О±, С„РёР±СЂРёРЅРѕРіРµРЅ, РЎРћР­)

вЂў (2 - overallRIR) вЂ” С„Р°РєС‚РѕСЂ РІРјРµС€Р°С‚РµР»СЊСЃС‚РІ:
  RIR=0.5 в†’ РјРЅРѕР¶РёС‚РµР»СЊ 1.5 (РїРѕРІС‹С€РµРЅРёРµ)
  RIR=1.0 в†’ РјРЅРѕР¶РёС‚РµР»СЊ 1.0 (Р±РµР· РёР·РјРµРЅРµРЅРёР№)

Р’РєР»Р°РґС‹ РёСЃС‚РѕС‡РЅРёРєРѕРІ:
  Р¤Р°СЂРјР°: 35%   РђРЅР°Р»РёР·С‹: 25%   РўСЂРµРЅРёСЂРѕРІРєРё: 20%
  РџРёС‚Р°РЅРёРµ: 15%   Р”РёР°РіРЅРѕСЃС‚РёРєР°: 5%

Net = Raw Г— (1 - coverage) вЂ” Р·Р°С‰РёС‚Р° РІС‹С‡РёС‚Р°РµС‚СЃСЏ
  РёР· Р±Р°Р·РѕРІРѕРіРѕ СЂРёСЃРєР°`}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 6 }}>
                    <strong>Raw</strong> вЂ” СЂРёСЃРє Р±РµР· РїРѕРґРґРµСЂР¶РєРё
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 6 }}>
                    <strong>Net</strong> вЂ” СЃ СѓС‡С‘С‚РѕРј Р‘РђР”РѕРІ Рё С‚РµСЂР°РїРёРё
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 6 }}>
                    <strong>РњРёРЅРёРјСѓРј 7%</strong> вЂ” Р±Р°Р·РѕРІС‹Р№ РЅРµСѓСЃС‚СЂР°РЅРёРјС‹Р№ СЂРёСЃРє
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: 6, borderRadius: 6 }}>
                    <strong>РњР°РєСЃРёРјСѓРј 100%</strong> вЂ” РєСЂРёС‚РёС‡РµСЃРєРёР№ СЂРёСЃРє
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Р”РѕР·Рѕ-Р·Р°РІРёСЃРёРјС‹Р№ СЂР°СЃС‡С‘С‚ */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('dose')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>рџ“€ Р”РѕР·Рѕ-Р·Р°РІРёСЃРёРјС‹Р№ СЂР°СЃС‡С‘С‚</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'dose' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'dose' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`doseRatio = min(2, (dosePerWeek / thresholdDose)^1.2)

if drug has threshold:
  doseRatio = min(2, (dosePerWeek / threshold) ^ 1.2)
if drug has no threshold but has mechWeight:
  doseRatio = min(1.5, dosePerWeek / 300)

mechContribution = max(0, baseRisk Г— doseRatio Г— G Г— N Г— T Г— MRR Г— HGI Г— RIR Г— (1 + mechWeight Г— 3))

if mechContribution > 0.005:
  prod *= (1 - min(0.99, baseRisk Г— doseRatio Г— G Г— N Г— T Г— MRR Г— HGI Г— RIR))`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>thresholdDose</strong> вЂ” РїРѕСЂРѕРіРѕРІР°СЏ РґРѕР·Р° РёР· DRUG_THRESHOLDS (РјРі/РЅРµРґ)</p>
            <p style={{ margin: '0 0 4px' }}><strong>РЎС‚РµРїРµРЅСЊ 1.2</strong> вЂ” РЅРµР»РёРЅРµР№РЅР°СЏ Р·Р°РІРёСЃРёРјРѕСЃС‚СЊ В«РґРѕР·Р°-СЂРёСЃРєВ» (СЃСѓРїРµСЂР»РёРЅРµР№РЅР°СЏ)</p>
            <p style={{ margin: '0 0 4px' }}><strong>mechWeight</strong> вЂ” РІРµСЃ РјРµС…Р°РЅРёР·РјР° (0-1) РґР»СЏ РїСЂРµРїР°СЂР°С‚Р° Рё РјРµС…Р°РЅРёР·РјР° РїРѕРІСЂРµР¶РґРµРЅРёСЏ</p>
            <p style={{ margin: '0 0 4px' }}><strong>РњРЅРѕР¶РёС‚РµР»СЊ (1 + mechWeight Г— 3)</strong> вЂ” СѓСЃРёР»РµРЅРёРµ РґР»СЏ Р·РЅР°С‡РёРјС‹С… РјРµС…Р°РЅРёР·РјРѕРІ (РјР°РєСЃ Г—4)</p>
          </div>
        )}
      </div>

      {/* РњРЅРѕР¶РёС‚РµР»Рё РєРѕСЂСЂРµРєС‚РёСЂРѕРІРєРё */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('multipliers')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>вљ™пёЏ РњРЅРѕР¶РёС‚РµР»Рё РєРѕСЂСЂРµРєС‚РёСЂРѕРІРєРё</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'multipliers' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'multipliers' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: 'var(--accent)' }}>G вЂ” Р“РµРЅРµС‚РёС‡РµСЃРєРёР№ РјРЅРѕР¶РёС‚РµР»СЊ</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4, fontFamily: 'monospace', fontSize: 10 }}>
                G = GENETIC_MULTIPLIERS[system][genotype]<br/>
                COMT: Met/Met=2.0, Val/Met=1.5, Val/Val=1.0<br/>
                MTHFR: TT=1.7, CT=1.3, CC=1.0<br/>
                AGTR1: CC=1.4, AC=1.2, AA=1.0<br/>
                CYP3A4: *22/*22=1.35, *1/*22=1.15, *1/*1=1.0<br/>
                NOS3: TT=1.3, GT=1.15, GG=1.0
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: '#eab308' }}>N вЂ” Р¤Р°РєС‚РѕСЂ РїРёС‚Р°РЅРёСЏ</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                N = clamp(nutritionFactor, 0.5, 1.5)<br/>
                РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ: 0.8 (СЃСЂРµРґРЅРµРµ РїРёС‚Р°РЅРёРµ)<br/>
                0.5 = РїР»РѕС…РѕРµ РїРёС‚Р°РЅРёРµ, 1.0 = С…РѕСЂРѕС€РµРµ, 1.5 = РёРґРµР°Р»СЊРЅРѕРµ
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: '#f97316' }}>T вЂ” Р¤Р°РєС‚РѕСЂ С‚СЂРµРЅРёСЂРѕРІРѕРє</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                T = clamp(trainingFactor, 1.0, 1.5)<br/>
                РџРѕ СѓРјРѕР»С‡Р°РЅРёСЋ: 0.7 (СѓРјРµСЂРµРЅРЅС‹Рµ С‚СЂРµРЅРёСЂРѕРІРєРё)<br/>
                РЈРІРµР»РёС‡РёРІР°РµС‚ СЂРёСЃРє РїСЂРё С‡СЂРµР·РјРµСЂРЅС‹С… РЅР°РіСЂСѓР·РєР°С…
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
                <strong style={{ color: '#3b82f6' }}>MRR вЂ” Medical Risk Ratio</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4, fontFamily: 'monospace', fontSize: 10 }}>
                MRR(system) = 1 + deviation Г— 2<br/>
                deviation = |value - optimal| / optimal<br/>
                Р•СЃР»Рё Р·РЅР°С‡РµРЅРёРµ РІ РЅРѕСЂРјРµ: MRR = 1.0<br/>
                Р•СЃР»Рё РѕС‚РєР»РѕРЅРµРЅРёРµ 50%: MRR = 2.0<br/><br/>
                РќРѕСЂРјС‹ РїРѕ СЃРёСЃС‚РµРјР°Рј:<br/>
                cardio: 0.8вЂ“1.2, hepatic: 0.7вЂ“1.3, renal: 0.8вЂ“1.2<br/>
                neuro: 0.85вЂ“1.15, endocrine: 0.75вЂ“1.25, reproductive: 0.7вЂ“1.3<br/>
                hematologic: 0.75вЂ“1.25, musculoskeletal: 0.8вЂ“1.2, metabolic: 0.8вЂ“1.2<br/>
                ghigf: 0.85вЂ“1.15, ins_axis: 0.8вЂ“1.2, neuro_toxicity: 0.85вЂ“1.15<br/>
                blood: 0.75вЂ“1.25, vessels: 0.8вЂ“1.2, immunity: 0.8вЂ“1.2<br/>
                thyroid: 0.8вЂ“1.2, prostate: 0.75вЂ“1.25, skin: 0.85вЂ“1.15
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: '#8b5cf6' }}>HGI вЂ” Hemostasis/GI Index</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                HGI = clamp(average(hgiMarkers), 0.5, 1.5)<br/>
                Р’РµСЃР°: CRP=0.30, IL-6=0.25, TNF-О±=0.20, Р¤РёР±СЂРёРЅРѕРіРµРЅ=0.15, РЎРћР­=0.10
              </div>
            </div>

            <div>
              <strong style={{ color: '#22c55e' }}>RIR вЂ” Risk Intervention Response</strong>
              <div style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, marginTop: 4 }}>
                RIR = 0.5 + (interventionResponse ? 0.5)<br/>
                0.5 = РЅРµС‚ РІРјРµС€Р°С‚РµР»СЊСЃС‚РІ, 1.0 = РјР°РєСЃРёРјР°Р»СЊРЅР°СЏ СЌС„С„РµРєС‚РёРІРЅРѕСЃС‚СЊ<br/>
                Р’Р»РёСЏРЅРёРµ РЅР° РёС‚РѕРі: Overall Г— HGI Г— (2 - RIR)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Р¤Р°СЂРјР°РєРѕРґРёРЅР°РјРёРєР° (PD) */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('pd')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>рџ“€ Р¤Р°СЂРјР°РєРѕРґРёРЅР°РјРёРєР° (PD)</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'pd' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'pd' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`pdFactor = \u03a3 |PD_value| \u00d7 weight \u00d7 (dose / EC50)`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>PD_value</strong> вЂ” Р·РЅР°С‡РµРЅРёРµ С„Р°СЂРјР°РєРѕРґРёРЅР°РјРёС‡РµСЃРєРѕРіРѕ РїР°СЂР°РјРµС‚СЂР° РїСЂРµРїР°СЂР°С‚Р° (РѕС‚ -1 РґРѕ +4)</p>
            <p style={{ margin: '0 0 4px' }}><strong>weight</strong> вЂ” РІРµСЃ СЃРІСЏР·Рё PD-РїР°СЂР°РјРµС‚СЂР° СЃ СЃРёСЃС‚РµРјРѕР№ (0вЂ“1)</p>
            <p style={{ margin: '0 0 4px' }}><strong>EC50</strong> вЂ” РїРѕР»СѓРјР°РєСЃРёРјР°Р»СЊРЅР°СЏ СЌС„С„РµРєС‚РёРІРЅР°СЏ РєРѕРЅС†РµРЅС‚СЂР°С†РёСЏ (РјРі/Р»)</p>
            <p style={{ margin: '0 0 4px' }}><strong>Г— 15</strong> вЂ” РјР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅРёРµ PD-РІРєР»Р°РґР° РІ РёС‚РѕРіРѕРІС‹Р№ СЂРёСЃРє</p>

            <div style={{ marginTop: 8 }}>
              <strong>{''}</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginTop: 4 }}>
                  {Object.entries({
                    cardio: 'lipid_impact (0.6)',
                    hepatic: 'hepatotoxicity (1.0)',
                    renal: 'hct_impact (0.15)',
                    neuro: 'neuro_toxicity (1.0)',
                    endocrine: 'aromatization (0.5)',
                    hematologic: 'hct_impact (0.5)',
                    reproductive: 'progestogenic (0.4)',
                    musculoskeletal: 'lipid_impact (0.1)',
                    metabolic: 'lipid_impact (0.3)',
                    ghigf: 'aromatization (0.1)',
                    ins_axis: 'aromatization (0.2)',
                    neuro_toxicity: 'neuro_toxicity (0.3)',
                    blood: 'hct_impact (0.3)',
                    vessels: 'lipid_impact (0.4)',
                    immunity: 'immunosuppression (0.3)',
                    thyroid: 'aromatization (0.1)',
                    prostate: 'progestogenic (0.3)',
                    skin: 'progestogenic (0.2)',
                  }).map(([sys, pd]) => (
                    <div key={sys} style={{ fontSize: 10, padding: '2px 4px' }}>
                      <span style={{ fontWeight: 600 }}>{(SYSTEM_INFO_ALL[sys] || SYSTEM_INFO[sys])?.label || sys}</span>: {pd}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7 РјРµС…Р°РЅРёР·РјРѕРІ РїРѕРІСЂРµР¶РґРµРЅРёСЏ */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('mechs')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>вљ пёЏ 7 РѕР±С‰РёС… РјРµС…Р°РЅРёР·РјРѕРІ РїРѕРІСЂРµР¶РґРµРЅРёСЏ</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'mechs' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'mechs' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 6px', color: 'var(--text-dim)' }}>РљР°Р¶РґС‹Р№ РїСЂРµРїР°СЂР°С‚ РґРµР№СЃС‚РІСѓРµС‚ С‡РµСЂРµР· 1-5 РјРµС…Р°РЅРёР·РјРѕРІ СЃ СЂР°Р·РЅС‹Рј РІРµСЃРѕРј (0-1):</p>
            {Object.entries(MECHANISM_INFO).map(([num, info]) => (
              <div key={num} style={{ background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>
                <div style={{ fontWeight: 600 }}>{info.id}. {num}. {info.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{info.description.substring(0, 100)}...</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Р—Р°С‰РёС‚Р° (coverage) */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('coverage')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>рџ›ЎпёЏ Р—Р°С‰РёС‚Р° (Coverage)</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'coverage' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'coverage' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`Net = Raw \u00d7 (1 - coverage)

coverage(cell) = \u03a3 supportSubstances(cellCov)

РџСЂРёРјРµСЂ: telmisartan РїРѕРєСЂС‹РІР°РµС‚:
  cardio_2 (РђР“): 55%
  cardio_3 (Р“РёРїРµСЂС‚СЂРѕС„РёСЏ Р›Р–): 45%
  renal_1 (Р“РёРїРµСЂС‚РµРЅР·РёСЏ): 50%`}
            </div>
            <p style={{ margin: '0 0 4px' }}>РљР°Р¶РґС‹Р№ Р‘РђР”/РїСЂРµРїР°СЂР°С‚ РїРѕРґРґРµСЂР¶РєРё РёРјРµРµС‚ РєРѕСЌС„С„РёС†РёРµРЅС‚ РїРѕРєСЂС‹С‚РёСЏ (0-1) РґР»СЏ РєРѕРЅРєСЂРµС‚РЅС‹С… СЏС‡РµРµРє В«СЃРёСЃС‚РµРјР°_РјРµС…Р°РЅРёР·РјВ».</p>
            <p style={{ margin: '0 0 4px' }}>РЎСѓРјРјР° РІСЃРµС… РїРѕРєСЂС‹С‚РёР№ РІС‹С‡РёС‚Р°РµС‚СЃСЏ РёР· Raw РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ Net.</p>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {Object.entries(SUPPORT_BASE_COVERAGE).slice(0, 10).map(([sub, effects]) => (
                <div key={sub} style={{ background: 'var(--bg-secondary)', padding: 4, borderRadius: 4, fontSize: 10 }}>
                  <strong>{sub}</strong>
                  <div style={{ color: 'var(--text-dim)' }}>
                    {Object.entries(effects).slice(0, 2).map(([k, v]) => `${k}: ${Math.round((v as number) * 100)}%`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* РЁС‚СЂР°С„ Р·Р° РѕС‚СЃСѓС‚СЃС‚РІРёРµ Р°РЅР°Р»РёР·РѕРІ */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('penalty')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>вљ пёЏ РЁС‚СЂР°С„ Р·Р° РѕС‚СЃСѓС‚СЃС‚РІРёРµ Р°РЅР°Р»РёР·РѕРІ</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'penalty' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'penalty' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`labPenalty = labRatio Г— 0.40 (РёР»Рё 0.50 РїСЂРё в‰Ґ90% РїСЂРѕРїСѓС‰РµРЅРѕ)
diagPenalty = diagRatio Г— 0.25 (РёР»Рё 0.35 РїСЂРё в‰Ґ90% РїСЂРѕРїСѓС‰РµРЅРѕ)
totalMultiplier = 1.0 + labPenalty + diagPenalty (РјР°РєСЃ 2.0)

Р”Р»СЏ РєР°Р¶РґРѕР№ СЃРёСЃС‚РµРјС‹:
  if systemHasPenalty:
    systemNet = min(100, systemNet ? totalMultiplier)
  else:
    systemNet = systemNet (Р±РµР· С€С‚СЂР°С„Р°)

OverallNet = min(100, overallNet ? totalMultiplier)`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>labRatio</strong> вЂ” РґРѕР»СЏ РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёС… Р°РЅР°Р»РёР·РѕРІ РёР· РѕР±СЏР·Р°С‚РµР»СЊРЅС‹С… РґР»СЏ С‚РµРєСѓС‰РµР№ С„Р°Р·С‹</p>
            <p style={{ margin: '0 0 4px' }}><strong>diagRatio</strong> вЂ” РґРѕР»СЏ РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёС… РѕР±СЃР»РµРґРѕРІР°РЅРёР№</p>
            <p style={{ margin: '0 0 4px' }}><strong>РљРЅРѕРїРєР° В«Р‘РµР· Р°РЅР°Р»РёР·РѕРІВ»</strong> вЂ” РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ РЅР°Р·РЅР°С‡Р°РµС‚ С€С‚СЂР°С„РЅРѕР№ РєРѕСЌС„С„РёС†РёРµРЅС‚</p>
          </div>
        )}
      </div>

      {/* РџРѕРЅРµРґРµР»СЊРЅР°СЏ РґРёРЅР°РјРёРєР° */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('dynamics')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>вљ пёЏ РџРѕРЅРµРґРµР»СЊРЅР°СЏ РґРёРЅР°РјРёРєР° (PK)</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'dynamics' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'dynamics' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`k = ln(2) / TВЅ_hours   (РєРѕРЅСЃС‚Р°РЅС‚Р° РІС‹РІРµРґРµРЅРёСЏ)

РќР°РєРѕРїР»РµРЅРёРµ (РІРѕ РІСЂРµРјСЏ РїСЂРёС‘РјР°):
  factor = 1 - e^(-k ? weeks ? 168)
  > РґРѕСЃС‚РёРіР°РµС‚ ~99% Р·Р° 5 Г— TВЅ

Р’С‹РІРµРґРµРЅРёРµ (РїРѕСЃР»Рµ РѕС‚РјРµРЅС‹):
  peakConc = 1 - e^(-k ? usedWeeks ? 168)
  factor = peakConc ? e^(-k ? weeksSinceEnd ? 168)

Р­С„С„РµРєС‚РёРІРЅР°СЏ РґРѕР·Р° = dosePerWeek Г— max(factor, 0.05)`}
            </div>
            <p style={{ margin: '0 0 6px' }}>Р”Р»СЏ РєР°Р¶РґРѕРіРѕ РїСЂРµРїР°СЂР°С‚Р° СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ С„Р°СЂРјР°РєРѕРєРёРЅРµС‚РёС‡РµСЃРєРёР№ РїСЂРѕС„РёР»СЊ:</p>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ background: 'rgba(234,179,8,0.1)', padding: 6, borderRadius: 6 }}>
                <strong>вљ пёЏ РќР°РєРѕРїР»РµРЅРёРµ</strong> вЂ” РєРѕРЅС†РµРЅС‚СЂР°С†РёСЏ СЂР°СЃС‚С‘С‚ РѕС‚ 0 РґРѕ СЃС‚Р°С†РёРѕРЅР°СЂРЅРѕР№
              </div>
              <div style={{ background: 'rgba(0,230,138,0.1)', padding: 6, borderRadius: 6 }}>
                <strong>вљ пёЏ РЎС‚Р°С†РёРѕРЅР°СЂ</strong> вЂ” РєРѕРЅС†РµРЅС‚СЂР°С†РёСЏ в‰€ 85% РѕС‚ РјР°РєСЃРёРјСѓРјР°
              </div>
              <div style={{ background: 'rgba(59,130,246,0.1)', padding: 6, borderRadius: 6 }}>
                <strong>вљ пёЏ Р’С‹РІРµРґРµРЅРёРµ</strong> вЂ” РєРѕРЅС†РµРЅС‚СЂР°С†РёСЏ РїР°РґР°РµС‚ РїРѕСЃР»Рµ РѕС‚РјРµРЅС‹
              </div>
            </div>
            <p style={{ margin: '8px 0 0', color: 'var(--text-dim)', fontSize: 10 }}>
              РџСЂРёРјРµСЂС‹: РўРµСЃС‚РѕСЃС‚РµСЂРѕРЅ СЌРЅР°РЅС‚Р°С‚ (TВЅ 14 РґРЅРµР№) {'>'} СЃС‚Р°С†РёРѕРЅР°СЂ С‡РµСЂРµР· ~10 РЅРµРґ, РІС‹РІРµРґРµРЅРёРµ ~10 РЅРµРґ. РўСЂРµРЅР±РѕР»РѕРЅ Р°С†РµС‚Р°С‚ (TВЅ 3 РґРЅСЏ) {'>'} СЃС‚Р°С†РёРѕРЅР°СЂ С‡РµСЂРµР· ~2 РЅРµРґ, РІС‹РІРµРґРµРЅРёРµ ~2 РЅРµРґ.
            </p>
          </div>
        )}
      </div>

      {/* РђРіСЂРµРіР°С†РёСЏ */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('agg')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>вљ пёЏ РђРіСЂРµРіР°С†РёСЏ СЂРёСЃРєРѕРІ</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'agg' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'agg' && (
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, marginBottom: 8 }}>
{`systemRisk = geom(allMechanisms) // Р“РµРѕРјРµС‚СЂРёС‡РµСЃРєРѕРµ СЃСЂРµРґРЅРµРµ РїРѕ 7-9 СЃРїРµС†РёС„РёС‡РЅС‹Рј РјРµС…Р°РЅРёР·РјР°Рј

overallRisk = geom(allSystems) \u00d7 overallMRR \u00d7 overallHGI \u00d7 (2 - overallRIR)

geom(arr) = exp(avg(ln(arr))) \u00d7 100

Р’Р·РІРµС€РµРЅРЅР°СЏ Р°РіСЂРµРіР°С†РёСЏ (РёР· РІСЃРµС… РёСЃС‚РѕС‡РЅРёРєРѕРІ):
  pharma: 35%  labs: 25%
  training: 20%  nutrition: 15%
  diagnostics: 5%

net = \u03a3(sourceRaw \u00d7 weight / totalWeight)`}
            </div>
            <p style={{ margin: '0 0 4px' }}><strong>Р“РµРѕРјРµС‚СЂРёС‡РµСЃРєРѕРµ СЃСЂРµРґРЅРµРµ</strong> вЂ” С‡СѓРІСЃС‚РІРёС‚РµР»СЊРЅРѕ Рє РІС‹СЃРѕРєРёРј Р·РЅР°С‡РµРЅРёСЏРј: РµСЃР»Рё С…РѕС‚СЊ РѕРґРёРЅ РјРµС…Р°РЅРёР·Рј РґР°С‘С‚ 80%, РѕР±С‰РёР№ РЅРµ Р±СѓРґРµС‚ РЅРёР¶Рµ ~60%</p>
            <p style={{ margin: '0 0 4px' }}><strong>РњРЅРѕР¶РёС‚РµР»СЊ (2 - RIR)</strong> вЂ” РїСЂРё РјР°РєСЃРёРјР°Р»СЊРЅРѕР№ Р·Р°С‰РёС‚Рµ RIR=1.0, РјРЅРѕР¶РёС‚РµР»СЊ = 1.0 (Р±РµР· РёР·РјРµРЅРµРЅРёСЏ). РџСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё Р·Р°С‰РёС‚С‹ RIR=0.5, РјРЅРѕР¶РёС‚РµР»СЊ = 1.5 (РїРѕРІС‹С€РµРЅРёРµ СЂРёСЃРєР°)</p>
          </div>
        )}
      </div>

      {/* РџРѕСЂРѕРіРё РїСЂРµРїР°СЂР°С‚РѕРІ */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('thresholds')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>вљ пёЏ РџРѕСЂРѕРіРѕРІС‹Рµ РґРѕР·С‹ РїСЂРµРїР°СЂР°С‚РѕРІ</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'thresholds' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'thresholds' && (
          <div style={{ marginTop: 8, fontSize: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {Object.entries(DRUG_THRESHOLDS).slice(0, 18).map(([id, t]) => {
                const name = getThresholdName(id);
                return (
                <div key={id} style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>
                  <div style={{ fontWeight: 500, fontSize: 11 }}>{name}</div>
                  <div style={{ color: 'var(--text-dim)' }}>{t.dosePerWeek} РјРі/РЅРµРґ</div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 14 СЃРёСЃС‚РµРј */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('systems')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>рџ«Ђ 14 СЃРёСЃС‚РµРј РѕСЂРіР°РЅРѕРІ</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'systems' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'systems' && (
          <div style={{ marginTop: 8, fontSize: 11 }}>
            {ALL_RISK_SYSTEMS.map(sys => {
              const info = SYSTEM_INFO_ALL[sys] || SYSTEM_INFO[sys];
              return (
                <div key={sys} style={{ background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{info?.icon || 'вљ пёЏ'}</span>
                  <span style={{ fontWeight: 600, marginLeft: 6 }}>{info?.label || sys}</span>
                  {info?.keyMarkers && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>РљР»СЋС‡РµРІС‹Рµ РјР°СЂРєРµСЂС‹: {info.keyMarkers.join(', ')}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

            {/* РЎРїРµС†РёС„РёС‡РЅС‹Рµ РјРµС…Р°РЅРёР·РјС‹ РїРѕ СЃРёСЃС‚РµРјР°Рј */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="risk-card-header" style={{ cursor: 'pointer' }} onClick={() => toggle('sysmechs')}>
          <h4 style={{ margin: 0, fontSize: 13 }}>рџ”¬ РЎРїРµС†РёС„РёС‡РЅС‹Рµ РјРµС…Р°РЅРёР·РјС‹ РїРѕ СЃРёСЃС‚РµРјР°Рј</h4>
          <span style={{ fontSize: 12 }}>{expanded === 'sysmechs' ? 'в–ё' : 'в–ѕ'}</span>
        </div>
        {expanded === 'sysmechs' && (
          <div style={{ marginTop: 8, fontSize: 11 }}>
            <p style={{ margin: '0 0 8px', color: 'var(--text-dim)' }}>РљР°Р¶РґР°СЏ СЃРёСЃС‚РµРјР° РѕСЂРіР°РЅРѕРІ РёРјРµРµС‚ 7вЂ“8 СЃРїРµС†РёС„РёС‡РЅС‹С… РјРµС…Р°РЅРёР·РјРѕРІ РїРѕРІСЂРµР¶РґРµРЅРёСЏ, РєРѕС‚РѕСЂС‹Рµ СЂР°СЃСЃС‡РёС‚С‹РІР°СЋС‚СЃСЏ РЅРµР·Р°РІРёСЃРёРјРѕ Рё Р·Р°С‚РµРј Р°РіСЂРµРіРёСЂСѓСЋС‚СЃСЏ.</p>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 10, marginBottom: 8, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
{`specificRisk(sys, mech) = max(0, baseRisk \u00d7 doseRatio \u00d7 G \u00d7 N \u00d7 T \u00d7 (1 + mechWeight \u00d7 3))

systemRisk(sys) = geom(allSpecificMechs(sys))

overallRisk = geom(allSystems) \u00d7 overallMRR \u00d7 overallHGI \u00d7 (2 - overallRIR)`}
            </div>
            <p style={{ margin: '0 0 6px', color: 'var(--text-dim)', fontSize: 10 }}>РњРµС…Р°РЅРёР·РјС‹ РїСЂРёРІСЏР·Р°РЅС‹ Рє РїСЂРµРїР°СЂР°С‚Р°Рј Рё РјР°СЂРєРµСЂР°Рј Р°РЅР°Р»РёР·РѕРІ:</p>
            {ALL_RISK_SYSTEMS.map(sys => {
              const info = SYSTEM_INFO_ALL[sys] || SYSTEM_INFO[sys];
              const mechs = SYSTEM_MECHANISMS[sys] || [];
              if (mechs.length === 0) return null;
              return (
                <div key={sys} style={{ background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{info?.icon || '?'} {info?.label || sys}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{mechs.length} РјРµС….</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
                    {mechs.map(m => (
                      <span key={m.id} style={{ background: 'rgba(0,230,138,0.08)', padding: '1px 5px', borderRadius: 3, fontSize: 9 }}>
                        {m.num}. {m.label}
                      </span>
                    ))}
                  </div>
                  {SYSTEM_ORGANS[sys] && (
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                      РћСЂРіР°РЅС‹: {SYSTEM_ORGANS[sys].slice(0, 3).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

{/* Disclaimer */}
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
        Р”Р°РЅРЅС‹Рµ СЂР°СЃС‡С‘С‚С‹ РЅРѕСЃСЏС‚ РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅС‹Р№ С…Р°СЂР°РєС‚РµСЂ Рё РЅРµ Р·Р°РјРµРЅСЏСЋС‚ РєРѕРЅСЃСѓР»СЊС‚Р°С†РёСЋ РІСЂР°С‡Р°.<br/>
        РњРѕРґРµР»СЊ Health Engine v9 вЂ” РјР°С‚РµРјР°С‚РёС‡РµСЃРєР°СЏ Р°РїРїСЂРѕРєСЃРёРјР°С†РёСЏ РЅР° РѕСЃРЅРѕРІРµ РѕРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹С… РґР°РЅРЅС‹С….
      </div>
    </div>
  );
};
