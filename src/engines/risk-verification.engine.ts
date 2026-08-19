// risk-verification.engine.ts — перечень анализов для верификации рисков
// по механизм-ориентированной модели (6 систем, 28 механизмов).
// Каталог маркеров повторяет таблицу T4 движка risk-engine-tz-spec (пороги m_i=1/2/3)
// и якорные пороги clinicalFloorsForLabs — единый источник для UI-списка «Анализы».
import { TZ_MECH_LABELS, TZ_SYSTEM_LABELS, TZ_SYSTEM_ICONS } from '../data/support-db';

export type VerifDirection = 'high' | 'low';

export interface VerifMarker {
  code: string;
  name: string;
  unit: string;
  direction: VerifDirection;
  thresholds: [number, number, number];
}

export interface VerifFloor {
  code: string;
  op: '>=' | '<=';
  value: number;
  label: string;
  risk: number;
}

export interface VerifMechanism {
  id: string;
  weight: number;
  markers: VerifMarker[];
  note?: string;
}

export interface VerifSystem {
  id: string;
  name: string;
  icon: string;
  color: string;
  mechanisms: VerifMechanism[];
  floors: VerifFloor[];
}

// ── Каталог маркеров (T4) — пороги m_i: 1/2/3 ──
const M = (code: string, name: string, unit: string, direction: VerifDirection, thresholds: [number, number, number]): VerifMarker =>
  ({ code, name, unit, direction, thresholds });

export const VERIFICATION_SYSTEMS: VerifSystem[] = [
  {
    id: 'cardio', name: TZ_SYSTEM_LABELS.cardio, icon: TZ_SYSTEM_ICONS.cardio, color: '#ef4444',
    mechanisms: [
      { id: 'cv1', weight: 0.8, markers: [
        M('BNP', 'NT-proBNP', 'пг/мл', 'high', [125, 300, 900]),
        M('CK', 'КФК (креатинкиназа)', 'Ед/л', 'high', [200, 500, 1000]),
      ] },
      { id: 'cv2', weight: 1.0, markers: [
        M('LDL', 'ЛПНП', 'ммоль/л', 'high', [2.6, 3.4, 4.9]),
        M('HDL', 'ЛПВП', 'ммоль/л', 'low', [1.5, 1.0, 0.8]),
        M('TG', 'Триглицериды', 'ммоль/л', 'high', [1.7, 2.3, 5.6]),
        M('TC', 'Холестерин общий', 'ммоль/л', 'high', [5.0, 6.2, 7.5]),
      ] },
      { id: 'cv3', weight: 0.7, markers: [
        M('NA', 'Натрий', 'ммоль/л', 'high', [145, 148, 155]),
      ] },
      { id: 'cv4', weight: 1.0, markers: [
        M('HCT', 'Гематокрит', '%', 'high', [48, 51, 54]),
        M('D_DIMER', 'D-димер', 'мг/л', 'high', [0.5, 1.0, 2.0]),
        M('FIBRINOGEN', 'Фибриноген', 'г/л', 'high', [4.0, 5.0, 6.0]),
        M('PLT', 'Тромбоциты', '10⁹/л', 'high', [400, 500, 600]),
      ] },
      { id: 'cv5', weight: 0.7, markers: [
        M('K', 'Калий', 'ммоль/л', 'low', [3.5, 3.0, 2.5]),
        M('HCT', 'Гематокрит', '%', 'high', [50, 54, 58]),
      ] },
    ],
    floors: [
      { code: 'LDL', op: '>=', value: 4.9, label: 'ЛПНП ≥ 4.9 ммоль/л — дислипидемия (порог статинов)', risk: 50 },
      { code: 'K', op: '<=', value: 3.0, label: 'Калий < 3.0 ммоль/л — гипокалиемия', risk: 50 },
    ],
  },
  {
    id: 'hepatic', name: TZ_SYSTEM_LABELS.hepatic, icon: TZ_SYSTEM_ICONS.hepatic, color: '#f59e0b',
    mechanisms: [
      { id: 'liv1', weight: 1.0, markers: [
        M('ALT', 'АЛТ', 'Ед/л', 'high', [40, 80, 200]),
        M('AST', 'АСТ', 'Ед/л', 'high', [40, 80, 200]),
      ] },
      { id: 'liv2', weight: 0.7, markers: [
        M('GGT', 'ГГТ', 'Ед/л', 'high', [55, 110, 220]),
        M('BIL', 'Билирубин общий', 'мкмоль/л', 'high', [21, 50, 100]),
        M('ALP', 'Щелочная фосфатаза', 'Ед/л', 'high', [150, 200, 300]),
      ] },
      { id: 'liv3', weight: 1.0, markers: [
        M('AST', 'АСТ', 'Ед/л', 'high', [40, 80, 200]),
        M('ALT', 'АЛТ', 'Ед/л', 'high', [40, 80, 200]),
      ], note: 'соотношение АСТ/АЛТ > 1.5 (расчёт из значений)' },
    ],
    floors: [
      { code: 'ALT', op: '>=', value: 200, label: 'АЛТ > 200 Ед/л — гепатотоксичность', risk: 50 },
      { code: 'AST', op: '>=', value: 200, label: 'АСТ > 200 Ед/л — гепатотоксичность', risk: 50 },
    ],
  },
  {
    id: 'renal', name: TZ_SYSTEM_LABELS.renal, icon: TZ_SYSTEM_ICONS.renal, color: '#3b82f6',
    mechanisms: [
      { id: 'ren1', weight: 1.0, markers: [
        M('eGFR', 'СКФ (eGFR)', 'мл/мин', 'low', [90, 60, 30]),
        M('CREAT', 'Креатинин', 'мкмоль/л', 'high', [90, 130, 200]),
        M('UREA', 'Мочевина', 'ммоль/л', 'high', [8, 12, 20]),
        M('URIC', 'Мочевая кислота', 'мкмоль/л', 'high', [420, 480, 540]),
      ] },
      { id: 'ren2', weight: 0.6, markers: [
        M('eGFR', 'СКФ (eGFR)', 'мл/мин', 'high', [120, 140, 160]),
      ], note: 'гиперфильтрация — ранний признак перегрузки' },
      { id: 'ren3', weight: 0.8, markers: [
        M('UACR', 'Альбумин/креатинин мочи', 'мг/г', 'high', [30, 300, 1000]),
      ] },
      { id: 'ren4', weight: 0.7, markers: [
        M('K', 'Калий', 'ммоль/л', 'low', [3.5, 3.0, 2.5]),
        M('NA', 'Натрий', 'ммоль/л', 'low', [135, 130, 125]),
        M('MG', 'Магний', 'ммоль/л', 'low', [0.75, 0.65, 0.5]),
        M('CA', 'Кальций', 'ммоль/л', 'low', [2.2, 2.0, 1.75]),
      ] },
    ],
    floors: [
      { code: 'eGFR', op: '<=', value: 60, label: 'СКФ < 60 мл/мин — ХБП', risk: 50 },
      { code: 'eGFR', op: '<=', value: 30, label: 'СКФ < 30 мл/мин — тяжёлая ХБП', risk: 75 },
      { code: 'UACR', op: '>=', value: 300, label: 'Альбуминурия > 300 мг/г', risk: 50 },
    ],
  },
  {
    id: 'cns', name: TZ_SYSTEM_LABELS.cns, icon: TZ_SYSTEM_ICONS.cns, color: '#a855f7',
    mechanisms: [
      { id: 'cns1', weight: 0.6, markers: [
        M('PRL', 'Пролактин', 'нг/мл', 'high', [15, 25, 50]),
      ] },
      { id: 'cns2', weight: 0.5, markers: [
        M('CRP', 'СРБ', 'мг/л', 'high', [5, 10, 20]),
        M('HOMOCYSTEINE', 'Гомоцистеин', 'мкмоль/л', 'high', [15, 20, 30]),
        M('IL6', 'IL-6', 'пг/мл', 'high', [2, 5, 10]),
        M('TNFA', 'TNF-α', 'пг/мл', 'high', [3, 5, 10]),
        M('FERRITIN', 'Ферритин', 'мкг/л', 'high', [300, 400, 500]),
      ] },
      { id: 'cns3', weight: 0.5, markers: [
        M('HOMOCYSTEINE', 'Гомоцистеин', 'мкмоль/л', 'high', [15, 20, 30]),
      ] },
      { id: 'cns4', weight: 0.7, markers: [
        M('TSH', 'ТТГ', 'мМЕ/л', 'high', [4.0, 6.0, 10.0]),
        M('CORTISOL', 'Кортизол', 'нмоль/л', 'high', [690, 900, 1380]),
        M('T3', 'Т3 свободный', 'пмоль/л', 'low', [4.5, 3.5, 2.5]),
        M('T4', 'Т4 свободный', 'пмоль/л', 'low', [12, 9, 6]),
        M('DHEAS', 'DHEA-S', 'мкг/дл', 'low', [100, 50, 20]),
      ] },
      { id: 'cns5', weight: 0.8, markers: [
        M('GLU', 'Глюкоза', 'ммоль/л', 'low', [3.9, 3.3, 2.8]),
      ] },
      { id: 'cns6', weight: 0.4, markers: [], note: 'нет прямого лабораторного маркера — оценка по фармакологии' },
    ],
    floors: [
      { code: 'PRL', op: '>=', value: 50, label: 'Пролактин > 50 нг/мл — пролактинома-риск', risk: 50 },
      { code: 'GLU', op: '<=', value: 2.8, label: 'Глюкоза < 2.8 ммоль/л — гипогликемия', risk: 50 },
    ],
  },
  {
    id: 'reproductive', name: TZ_SYSTEM_LABELS.reproductive, icon: TZ_SYSTEM_ICONS.reproductive, color: '#ec4899',
    mechanisms: [
      { id: 'rep1', weight: 1.0, markers: [
        M('LH', 'ЛГ', 'МЕ/л', 'low', [2.0, 1.0, 0.5]),
        M('FSH', 'ФСГ', 'МЕ/л', 'low', [2.0, 1.0, 0.5]),
      ] },
      { id: 'rep2', weight: 0.8, markers: [
        M('TT', 'Тестостерон общий', 'нмоль/л', 'low', [12, 8, 4]),
        M('FT', 'Тестостерон свободный', 'пмоль/л', 'low', [250, 150, 50]),
        M('SHBG', 'ГСПГ', 'нмоль/л', 'high', [60, 80, 100]),
      ] },
      { id: 'rep3', weight: 0.8, markers: [
        M('FSH', 'ФСГ', 'МЕ/л', 'low', [2.0, 1.0, 0.5]),
      ], note: 'олигозооспермия при супрессии ФСГ' },
      { id: 'rep4', weight: 0.5, markers: [
        M('E2', 'Эстрадиол', 'пмоль/л', 'high', [40, 55, 80]),
      ] },
      { id: 'rep5', weight: 0.6, markers: [
        M('LH', 'ЛГ', 'МЕ/л', 'low', [2.0, 1.0, 0.5]),
        M('TT', 'Тестостерон общий', 'нмоль/л', 'low', [12, 8, 4]),
      ], note: 'восстановление после цикла (PCT)' },
    ],
    floors: [
      { code: 'LH', op: '<=', value: 0.5, label: 'ЛГ < 0.5 МЕ/л — глубокая супрессия HPG-оси', risk: 50 },
    ],
  },
  {
    id: 'hematologic', name: TZ_SYSTEM_LABELS.hematologic, icon: TZ_SYSTEM_ICONS.hematologic, color: '#14b8a6',
    mechanisms: [
      { id: 'hem1', weight: 1.0, markers: [
        M('HCT', 'Гематокрит', '%', 'high', [48, 51, 54]),
        M('HGB', 'Гемоглобин', 'г/л', 'high', [170, 180, 190]),
        M('RBC', 'Эритроциты', '10¹²/л', 'high', [5.5, 6.0, 6.5]),
        M('WBC', 'Лейкоциты', '10⁹/л', 'high', [11, 13, 15]),
      ] },
      { id: 'hem2', weight: 0.7, markers: [
        M('GLU', 'Глюкоза', 'ммоль/л', 'high', [5.6, 6.1, 7.0]),
        M('HOMA', 'HOMA-IR', '—', 'high', [2.0, 3.0, 5.0]),
        M('HBA1C', 'Гликированный гемоглобин', '%', 'high', [5.7, 6.5, 7.5]),
      ] },
      { id: 'hem3', weight: 0.6, markers: [
        M('GLU', 'Глюкоза', 'ммоль/л', 'low', [3.9, 3.3, 2.8]),
      ] },
      { id: 'hem4', weight: 0.5, markers: [
        M('K', 'Калий', 'ммоль/л', 'low', [3.5, 3.0, 2.5]),
      ] },
      { id: 'hem5', weight: 0.4, markers: [
        M('K', 'Калий', 'ммоль/л', 'low', [3.5, 3.0, 2.5]),
        M('NA', 'Натрий', 'ммоль/л', 'low', [135, 130, 125]),
        M('MG', 'Магний', 'ммоль/л', 'low', [0.75, 0.65, 0.5]),
        M('CA', 'Кальций', 'ммоль/л', 'low', [2.2, 2.0, 1.75]),
      ] },
    ],
    floors: [
      { code: 'HCT', op: '>=', value: 54, label: 'Гематокрит ≥ 54% — порог флеботомии', risk: 50 },
      { code: 'HOMA', op: '>=', value: 5, label: 'HOMA-IR > 5 — выраженная инсулинорезистентность', risk: 25 },
    ],
  },
];

const FLOOR_CODES = new Set<string>(['LDL', 'K', 'ALT', 'AST', 'eGFR', 'UACR', 'PRL', 'GLU', 'LH', 'HCT', 'HOMA']);
const COMPUTED_CODES = new Set<string>(['AST', 'ALT']);

export const VERIFICATION_TOTAL_MECHANISMS = VERIFICATION_SYSTEMS.reduce((s, x) => s + x.mechanisms.length, 0);

// ── Статус маркера по порогам m_i (1/2/3) ──
export function markerStatus(m: VerifMarker, value: number): 0 | 1 | 2 | 3 {
  if (!isFinite(value)) return 0;
  const [t1, t2, t3] = m.thresholds;
  if (m.direction === 'high') {
    if (value < t1) return 0;
    if (value < t2) return 1;
    if (value < t3) return 2;
    return 3;
  }
  if (value > t1) return 0;
  if (value > t2) return 1;
  if (value > t3) return 2;
  return 3;
}

export function statusColor(status: 0 | 1 | 2 | 3): string {
  if (status === 0) return '#22c55e';
  if (status === 1) return '#eab308';
  if (status === 2) return '#f97316';
  return '#ef4444';
}

export function statusLabel(status: 0 | 1 | 2 | 3): string {
  if (status === 0) return 'норма';
  if (status === 1) return 'пограничный';
  if (status === 2) return 'выраженный';
  return 'критический';
}

export function thresholdText(m: VerifMarker): string {
  const [t1, t2, t3] = m.thresholds;
  const op = m.direction === 'high' ? '≥' : '≤';
  return `${op}${t1} · ${op}${t2} · ${op}${t3}`;
}

// ── Отчёт верификации ──
export interface VerifMarkerRow extends VerifMarker {
  value: number | undefined;
  status: 0 | 1 | 2 | 3;
  present: boolean;
}

export interface VerifMechanismRow extends VerifMechanism {
  markers: VerifMarkerRow[];
  present: boolean;
}

export interface VerifSystemRow extends VerifSystem {
  mechanisms: VerifMechanismRow[];
  presentCount: number;
  total: number;
  verification: number;
  floorHits: VerifFloor[];
}

export interface VerifReport {
  systems: VerifSystemRow[];
  totalMarkers: number;
  presentMarkers: number;
  overall: number;
  floorsCount: number;
}

export function labAliasMap(labMap: Record<string, number>): Record<string, number> {
  const m: Record<string, number> = { ...labMap };
  if (m['EGFR'] !== undefined && m['eGFR'] === undefined) m['eGFR'] = m['EGFR'];
  if (m['CREATININE'] !== undefined && m['CREAT'] === undefined) m['CREAT'] = m['CREATININE'];
  if (m['BILIRUBIN'] !== undefined && m['BIL'] === undefined) m['BIL'] = m['BILIRUBIN'];
  if (m['POTASSIUM'] !== undefined && m['K'] === undefined) m['K'] = m['POTASSIUM'];
  if (m['SODIUM'] !== undefined && m['NA'] === undefined) m['NA'] = m['SODIUM'];
  if (m['GLUCOSE'] !== undefined && m['GLU'] === undefined) m['GLU'] = m['GLUCOSE'];
  if (m['HB'] !== undefined && m['HGB'] === undefined) m['HGB'] = m['HB'];
  return m;
}

export function buildVerificationReport(rawLabMap: Record<string, number>): VerifReport {
  const labMap = labAliasMap(rawLabMap);
  const systems: VerifSystemRow[] = VERIFICATION_SYSTEMS.map(sys => {
    const mechanisms: VerifMechanismRow[] = sys.mechanisms.map(mech => {
      const markers: VerifMarkerRow[] = mech.markers.map(mk => {
        const value = labMap[mk.code];
        return {
          ...mk,
          value,
          present: value !== undefined,
          status: value !== undefined ? markerStatus(mk, value) : 0,
        };
      });
      const present = markers.length > 0 && markers.some(x => x.present);
      return { ...mech, markers, present };
    });
    const presentCount = mechanisms.filter(m => m.present).length;
    const verification = mechanisms.length > 0 ? presentCount / mechanisms.length : 0;
    const floorHits = sys.floors.filter(f => {
      const v = labMap[f.code];
      if (v === undefined) return false;
      return f.op === '>=' ? v >= f.value : v <= f.value;
    });
    return { ...sys, mechanisms, presentCount, total: mechanisms.length, verification, floorHits };
  });
  const codeSet = new Set<string>();
  const presentCodeSet = new Set<string>();
  for (const sys of VERIFICATION_SYSTEMS) {
    for (const mech of sys.mechanisms) {
      for (const mk of mech.markers) {
        codeSet.add(mk.code);
        if (labMap[mk.code] !== undefined) presentCodeSet.add(mk.code);
      }
    }
  }
  const totalMarkers = codeSet.size;
  const presentMarkers = presentCodeSet.size;
  const overall = systems.length > 0 ? systems.reduce((s, x) => s + x.verification, 0) / systems.length : 0;
  const floorsCount = systems.reduce((s, x) => s + x.floorHits.length, 0);
  return { systems, totalMarkers, presentMarkers, overall, floorsCount };
}

// ── Экспорт: текст ──
export function buildVerificationText(rawLabMap: Record<string, number>): string {
  const rep = buildVerificationReport(rawLabMap);
  const lines: string[] = [];
  lines.push(`🔬 ВЕРИФИКАЦИЯ РИСКОВ АНАЛИЗАМИ · ${Math.round(rep.overall * 100)}% систем (${rep.presentMarkers}/${rep.totalMarkers} маркеров)`);
  for (const sys of rep.systems) {
    lines.push('');
    lines.push(`${sys.icon} ${sys.name} — верификация ${Math.round(sys.verification * 100)}% (${sys.presentCount}/${sys.total} механизмов)`);
    for (const mech of sys.mechanisms) {
      const label = TZ_MECH_LABELS[mech.id] || mech.id;
      lines.push(`  · ${label} (w=${mech.weight})${mech.note ? ` — ${mech.note}` : ''}`);
      if (mech.markers.length === 0) {
        lines.push(`      маркер: —`);
        continue;
      }
      for (const mk of mech.markers) {
        const val = mk.present ? `${mk.value} ${mk.unit}` : '—';
        lines.push(`      ${mk.name} (${mk.code}): ${val} · пороги ${thresholdText(mk)} ${mk.unit} → ${statusLabel(mk.status)}`);
      }
    }
    if (sys.floorHits.length > 0) {
      for (const f of sys.floorHits) lines.push(`  ⚓ ${f.label} — якорный риск ≥${f.risk}%`);
    }
  }
  return lines.join('\n');
}

// ── Экспорт: CSV ──
export function buildVerificationCsv(rawLabMap: Record<string, number>): string {
  const rep = buildVerificationReport(rawLabMap);
  const esc = (s: string) => {
    const v = String(s);
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const rows: string[] = ['Система;Механизм;Маркер;Код;Единица;Значение;Порог 1;Порог 2;Порог 3;Направление;Статус'];
  for (const sys of rep.systems) {
    for (const mech of sys.mechanisms) {
      const mechName = TZ_MECH_LABELS[mech.id] || mech.id;
      for (const mk of mech.markers) {
        const [t1, t2, t3] = mk.thresholds;
        rows.push([
          esc(sys.name), esc(mechName), esc(mk.name), esc(mk.code), esc(mk.unit),
          mk.present ? esc(String(mk.value)) : '',
          String(t1), String(t2), String(t3), mk.direction === 'high' ? 'выше нормы' : 'ниже нормы',
          mk.present ? statusLabel(mk.status) : 'нет данных',
        ].join(';'));
      }
      if (mech.markers.length === 0) {
        rows.push([esc(sys.name), esc(mechName), '—', '', '', '', '', '', '', '', 'нет маркера'].join(';'));
      }
    }
  }
  return '\uFEFF' + rows.join('\r\n');
}

// ── Экспорт: печать (HTML, XSS-экранированный) ──
export function buildVerificationHtml(rawLabMap: Record<string, number>): string {
  const rep = buildVerificationReport(rawLabMap);
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cards = rep.systems.map(sys => {
    const mechs = sys.mechanisms.map(mech => {
      const label = esc(TZ_MECH_LABELS[mech.id] || mech.id);
      const note = mech.note ? `<div style="color:#888;font-size:10px;margin:2px 0">— ${esc(mech.note)}</div>` : '';
      const rows = mech.markers.length === 0
        ? '<tr><td colspan="3" style="color:#888">маркер отсутствует</td></tr>'
        : mech.markers.map(mk => {
          const val = mk.present ? esc(String(mk.value)) : '—';
          const color = mk.present ? statusColor(mk.status) : '#888';
          return `<tr><td>${esc(mk.name)} <span style="color:#888;font-size:9px">${esc(mk.code)}</span></td>` +
            `<td style="text-align:center">${val} <span style="color:#888;font-size:9px">${esc(mk.unit)}</span></td>` +
            `<td style="text-align:center">${esc(thresholdText(mk))} <span style="color:#888;font-size:9px">${esc(mk.unit)}</span></td>` +
            `<td style="text-align:center;color:${color};font-weight:600">${mk.present ? esc(statusLabel(mk.status)) : 'нет данных'}</td></tr>`;
        }).join('');
      const floorLine = sys.floorHits.length > 0
        ? `<div style="font-size:10px;color:#b91c1c;margin:2px 0">⚓ ${sys.floorHits.map(f => esc(f.label)).join(' · ')}</div>`
        : '';
      return `<div style="border:1px solid #ddd;border-radius:8px;padding:8px;margin:6px 0">
        <div style="font-weight:600;font-size:11px">${label} <span style="color:#888">(w=${mech.weight})</span></div>
        ${note}
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:4px">
          <tr style="background:#f5f5f5"><th style="padding:3px;text-align:left">Маркер</th><th style="padding:3px">Значение</th><th style="padding:3px">Пороги m_i=1/2/3</th><th style="padding:3px">Статус</th></tr>
          ${rows}
        </table>
        ${floorLine}
      </div>`;
    }).join('');
    const bar = `<div style="background:#eee;border-radius:3px;height:6px;margin:4px 0"><div style="background:${sys.color};height:6px;border-radius:3px;width:${Math.round(sys.verification * 100)}%"></div></div>`;
    return `<div style="border:1px solid #ddd;border-radius:10px;padding:10px;margin:8px 0">
      <div style="font-weight:700;font-size:13px">${sys.icon} ${esc(sys.name)}
        <span style="float:right;color:${sys.color}">${Math.round(sys.verification * 100)}% · ${sys.presentCount}/${sys.total}</span>
      </div>
      ${bar}
      ${mechs}
    </div>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Верификация рисков анализами</title></head>
<body style="font-family:system-ui,Arial,sans-serif;padding:24px;max-width:860px;margin:0 auto">
  <h1 style="font-size:18px">🔬 Верификация рисков анализами</h1>
  <div style="font-size:12px;color:#555;margin-bottom:8px">
    Систем верифицировано: <b>${Math.round(rep.overall * 100)}%</b> (${rep.systems.filter(s => s.verification >= 0.5).length}/${rep.systems.length}) ·
    маркеров: ${rep.presentMarkers}/${rep.totalMarkers} · якорных попаданий: ${rep.floorsCount}
  </div>
  <div style="font-size:10px;color:#888;margin-bottom:16px">Пороги — таблица T4 механизм-ориентированной модели (m_i = 1/2/3). Якорные floors поднимают риск системы независимо от препаратов.</div>
  ${cards}
</body></html>`;
}

export const VERIF_COLORS = {
  cv1: '#ef4444', cv2: '#ef4444', cv3: '#ef4444', cv4: '#ef4444', cv5: '#ef4444',
  liv1: '#f59e0b', liv2: '#f59e0b', liv3: '#f59e0b',
  ren1: '#3b82f6', ren2: '#3b82f6', ren3: '#3b82f6', ren4: '#3b82f6',
  cns1: '#a855f7', cns2: '#a855f7', cns3: '#a855f7', cns4: '#a855f7', cns5: '#a855f7', cns6: '#a855f7',
  rep1: '#ec4899', rep2: '#ec4899', rep3: '#ec4899', rep4: '#ec4899', rep5: '#ec4899',
  hem1: '#14b8a6', hem2: '#14b8a6', hem3: '#14b8a6', hem4: '#14b8a6', hem5: '#14b8a6',
};

export { FLOOR_CODES, COMPUTED_CODES };