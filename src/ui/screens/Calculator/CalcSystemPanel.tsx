import React from 'react';
import type { TzSpecOrganResult } from '../../../engines/risk-engine-tz-spec';
import { rssPct } from '../../../engines/risk-engine-tz-spec';

// ════════════════════════════════════════════════════════════════════
//  CalcSystemPanel — панель «Риск системы + под-риски + мониторинг»
//  для попапов калькулятора. Единый источник: механизм-модель
//  (TzSpecOrganResult из tzFinalRisk) + системные панели мониторинга.
//  Модель рисков (органы/механизмы) не меняется.
// ════════════════════════════════════════════════════════════════════

export interface SystemPanelDef {
  id: string;
  icon: string;
  name: string;
  color: string;
  markers: string;
  freq: string;
  targets: string;
  alert: string;
}

/** Системные панели мониторинга (единый источник для мониторинга и попапов). */
export const SYSTEM_PANELS: SystemPanelDef[] = [
  { id: 'hep', icon: '🫁', name: 'Печёночная панель', color: '#f59e0b', markers: 'АЛТ, АСТ, ГГТ, ЩФ, билирубин общий/прямой, альбумин, ПТИ', freq: 'Каждые 4 нед', targets: 'АЛТ/АСТ <40 Ед/л, ГГТ <55, билирубин <21 мкмоль/л', alert: 'АЛТ >80 → снижение доз · >200 → СТОП' },
  { id: 'cardio', icon: '❤️', name: 'Кардио-липидная панель', color: '#f87171', markers: 'ЛПНП, ЛПВП, ТГ, АпоВ, Лп(а), hs-СРБ, Д-димер, тропонин I (при боли)', freq: 'Каждые 4 нед', targets: 'ЛПНП <2.6, ЛПВП >1.0, ТГ <1.7, hs-СРБ <1.0', alert: 'ЛПНП >4.0 → статины · Д-димер >0.5 → УЗДГ вен' },
  { id: 'renal', icon: '💧', name: 'Почечная панель', color: '#38bdf8', markers: 'Креатинин, рСКФ (CKD-EPI), цистатин C, мочевина, мочевая кислота, электролиты (Na⁺, K⁺, Cl⁻), общий белок мочи, микроальбуминурия, ОАМ (удельный вес, белок, глюкоза, эритроциты, лейкоциты)', freq: 'Каждые 4 нед', targets: 'Креатинин <115, рСКФ >90, K⁺ 3.5–5.0, микроальбумин <30 мг/сут', alert: 'Креатинин >130 → УЗИ почек · K⁺ <3.5/>5.5 → ЭКГ' },
  { id: 'hema', icon: '🩸', name: 'Гематологическая панель', color: '#ef4444', markers: 'ОАК: HCT, Hgb, RBC, PLT, WBC, СОЭ/ESR, ретикулоциты, ферритин, сыв. железо, коагулограмма (МНО, АЧТВ, фибриноген, D-димер), JAK2 V617F (при Hct>52%)', freq: 'Каждые 2-4 нед (при ↑Hct — каждые 2 нед)', targets: 'HCT 40–50% (♂), Hgb 140–170 г/л, PLT 150–400×10⁹/л, фибриноген 2-4 г/л, D-димер <0.5', alert: 'HCT >52% → эритроцитаферез (первая линия) / флеботомия · >54% → СТОП AAS + эритроцитаферез · >60% → госпитализация' },
  { id: 'horm', icon: '🧬', name: 'Гормональная панель', color: '#a78bfa', markers: 'Тестостерон общ./своб., эстрадиол (чувств.), пролактин, ЛГ, ФСГ, SHBG, кортизол (утро), ДГТ, прогестерон', freq: 'Каждые 4 нед (на курсе), каждые 2 нед (ПКТ)', targets: 'E2 20–50 пг/мл (♂ на курсе), пролактин <15 нг/мл, кортизол 140–690 нмоль/л', alert: 'E2 >60 → ↑ИА · пролактин >25 → каберголин · ЛГ<1.0 → ХГЧ' },
  { id: 'cns', icon: '🧠', name: 'Нейро-панель', color: '#a855f7', markers: 'PRL, кортизол, гомоцистеин, BDNF, сон/тревога (дневник), ЧСС', freq: 'PRL/E2/кортизол каждые 4 нед; сон/тревога ежедневно', targets: 'PRL <25, кортизол 140–690 нмоль/л, гомоцистеин <10', alert: 'Бессонница/агрессия >2 нед → пересмотр стимуляторов · PRL>25 → каберголин (врач)' },
  { id: 'meta', icon: '🍬', name: 'Метаболическая панель', color: '#f97316', markers: 'Глюкоза натощак, HbA1c, инсулин, HOMA-IR, ИФР-1 (при GH), гомоцистеин, СРБ', freq: 'Каждые 4–8 нед', targets: 'Глюкоза <5.6, HbA1c <5.7%, HOMA-IR <2.5, гомоцистеин <10', alert: 'HbA1c >6.0 → метформин · глюкоза >11 → ER · HOMA-IR >3 → берберин' },
  { id: 'thy', icon: '🦋', name: 'Тиреоидная панель', color: '#22d3ee', markers: 'ТТГ, Т3 своб., Т4 своб., АТ-ТПО', freq: 'Каждые 8 нед (при приёме T3/T4 — каждые 4 нед)', targets: 'ТТГ 0.4–4.0, Т3 св. 3.5–6.5, Т4 св. 11.5–22.7', alert: 'ТТГ >4.5 → гипотиреоз · ТТГ <0.1 → гипертиреоз · ↑T3 → ↓дозу' },
  { id: 'vit', icon: '💊', name: 'Витамины и минералы', color: '#4ade80', markers: 'Витамин D (25-OH), B12, фолат, ферритин, Mg²⁺, Zn²⁺, Se, Ca²⁺ общ., фосфор', freq: 'Каждые 8 нед', targets: 'D3 50–80 нг/мл, B12 200–900, фолат >4, ферритин 50–200, Mg²⁺ 0.8–1.0, Zn²⁺ 70–140', alert: 'D3 <30 → нагрузка 50K МЕ/нед · ферритин <30 → Fe²⁺ + vitC' },
  { id: 'oda', icon: '🦴', name: 'ОДА (суставы/связки)', color: '#4ade80', markers: 'CRP, CK, кальций, витамин D, УЗИ суставов (при симптомах)', freq: 'CRP/CK каждые 4-8 нед; УЗИ суставов при боли', targets: 'CRP <3, CK <200 (учитывать нагрузку), D3 50–80 нг/мл', alert: 'Боль в суставе + отёк → УЗИ · CK >500 → нагрузка/препараты' },
];

/** Маппинг системных id механизм-модели → панель мониторинга. */
export const SYSTEM_TO_PANEL: Record<string, string> = {
  cardio: 'cardio', hepatic: 'hep', renal: 'renal', cns: 'cns',
  reproductive: 'horm', hematologic: 'hema', metabolic: 'meta', musculoskeletal: 'oda',
};

export interface SubRiskGroup {
  label: string;
  icon: string;
  color: string;
  mechs: string[];
}

/**
 * Панель для попапа: риск системы (механизм-модель) → под-риски по механизмам
 * → мониторинг (маркеры/периодичность/цели/тревога). Орган и панель — опциональны.
 */
export const CalcSystemPanel: React.FC<{
  risk?: TzSpecOrganResult | null;
  panel?: SystemPanelDef | null;
  groups?: SubRiskGroup[];
  note?: string;
  contra?: Array<{ substanceId?: string; label?: string; severity?: string; message?: string }>;
}> = ({ risk, panel, groups, note, contra }) => {
  const riskColor = (p: number) => (p >= 75 ? '#f87171' : p >= 50 ? '#f97316' : p >= 25 ? '#f59e0b' : '#22c55e');
  const sumPct = (mechs: string[]) => (risk ? rssPct(mechs.map(m => risk.mechanisms.find(x => x.id === m)?.rawPercent ?? 0)) : 0);
  const sumAfter = (mechs: string[]) => (risk ? rssPct(mechs.map(m => risk.mechanisms.find(x => x.id === m)?.afterPercent ?? 0)) : 0);
  const showSub = groups && groups.length > 0 && !!risk;
  const contraList = (contra || []).filter(c => c?.label || c?.message);
  return (
    <div style={{ marginBottom: 8 }}>
      {risk && (
        <div style={{ padding: '6px 8px', borderRadius: 7, marginBottom: 6, background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.18)' }}>
          <div style={{ fontSize: 7, fontWeight: 700, color: '#5eead4', marginBottom: 2 }}>
            ⚖️ Риск системы (механизм-модель): <b style={{ color: riskColor(risk.rawPercent) }}>{risk.rawPercent}%</b> → <b style={{ color: '#4ade80' }}>{risk.afterPercent}%</b> после поддержки
            {risk.k_protect > 0 && <span style={{ color: '#4ade80' }}> · защита {risk.k_protect}%</span>}
          </div>
          {risk.floors && risk.floors.length > 0 && (
            <div style={{ marginBottom: 3 }}>
              {risk.floors.map((f, i) => (
                <div key={i} style={{ fontSize: 6, color: '#fca5a5', lineHeight: 1.5 }}>⚓ {f.label}</div>
              ))}
            </div>
          )}
          {risk.verification !== undefined && risk.verification < 0.5 && (
            <div style={{ fontSize: 6, color: '#fbbf24', marginBottom: 3 }}>⚠ Система не верифицирована анализами — оценка по фармакологии</div>
          )}
          {showSub && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
              {groups!.map(g => {
                const raw = sumPct(g.mechs);
                const after = sumAfter(g.mechs);
                return (
                  <span key={g.label} style={{ padding: '1px 5px', borderRadius: 3, background: `${g.color}15`, border: `1px solid ${g.color}25`, fontSize: 6, color: 'rgba(255,255,255,0.8)' }}>
                    {g.icon} {g.label} {raw}% → {after}%
                  </span>
                );
              })}
            </div>
          )}
          {!showSub && risk.mechanisms.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
              {risk.mechanisms.map(m => (
                <span key={m.id} style={{ padding: '1px 5px', borderRadius: 3, background: `${riskColor(m.rawPercent)}12`, border: `1px solid ${riskColor(m.rawPercent)}25`, fontSize: 6, color: 'rgba(255,255,255,0.8)' }}>
                  {m.name.slice(0, 28)} {m.rawPercent}% → {m.afterPercent}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {panel && (
        <div style={{ padding: '6px 8px', borderRadius: 7, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.16)' }}>
          <div style={{ fontSize: 7, fontWeight: 700, color: '#93c5fd', marginBottom: 2 }}>🔬 Мониторинг — {panel.icon} {panel.name}</div>
          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            <div><span style={{ color: 'rgba(255,255,255,0.45)' }}>Маркеры: </span>{panel.markers}</div>
            <div><span style={{ color: 'rgba(255,255,255,0.45)' }}>Частота: </span>{panel.freq}</div>
            <div><span style={{ color: 'rgba(255,255,255,0.45)' }}>Цели: </span>{panel.targets}</div>
            <div style={{ color: panel.color }}>⚠ {panel.alert}</div>
          </div>
        </div>
      )}
      {contraList.length > 0 && (
        <div style={{ padding: '6px 8px', borderRadius: 7, marginBottom: 6, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: 7, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>🚫 Противопоказания и осторожности</div>
          {contraList.slice(0, 6).map((c, i) => (
            <div key={i} style={{ fontSize: 6, color: c.severity === 'absolute' ? '#fca5a5' : '#fbbf24', lineHeight: 1.5 }}>
              {c.severity === 'absolute' ? '⛔ ' : '⚠ '}{c.substanceId ? `${c.substanceId}: ` : ''}{c.label || c.message}
            </div>
          ))}
          {contraList.length > 6 && <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.45)' }}>+ ещё {contraList.length - 6}</div>}
        </div>
      )}
      {note && <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
};
