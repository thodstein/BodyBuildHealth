import { PHARMA_DB } from '../core/pharma-database';
import { REQUIRED_LABS_PER_PHASE, REQUIRED_DIAGNOSTICS_PER_PHASE } from '../core/constants';
import type { CourseEntry } from '../core/types';

export interface LabScheduleItem {
  week: number;
  label: string;
  labs: string[];
  diagnostics: string[];
  urgency: 'critical' | 'important' | 'optional';
  reason: string;
  phaseSegment: string;
}

export interface DrugLabTrigger {
  substanceClass: string;
  substanceIds: string[];
  triggerPD: string;
  pdThreshold: number;
  extraLabs: string[];
  extraDiagnostics: string[];
  frequencyWeeks: number;
  reason: string;
}

export const DRUG_LAB_TRIGGERS: DrugLabTrigger[] = [
  {
    substanceClass: 'oral_17aa',
    substanceIds: ['methand', 'oxan', 'stan', 'trena', 'halo'],
    triggerPD: 'hepatotoxicity',
    pdThreshold: 1.5,
    extraLabs: ['ALT', 'AST', 'GGT', 'ALB', 'TP', 'BIL', 'DBIL', 'ALP'],
    extraDiagnostics: ['usg_obp'],
    frequencyWeeks: 2,
    reason: '17-α-алкилированные ААС — гепатотоксичность. Печёночные пробы каждые 2 нед.'
  },
  {
    substanceClass: 'trenbolone',
    substanceIds: ['tren_acet', 'tren_enan', 'tren_hex'],
    triggerPD: 'neuro_toxicity',
    pdThreshold: 0.4,
    extraLabs: ['PRL', 'CORTISOL', 'TSH', 'FT4'],
    extraDiagnostics: [],
    frequencyWeeks: 4,
    reason: 'Тренболон — нейротоксичность + прогестогенная активность → пролактин, кортизол, щитовидная.'
  },
  {
    substanceClass: 'trenbolone',
    substanceIds: ['tren_acet', 'tren_enan', 'tren_hex'],
    triggerPD: 'hepatotoxicity',
    pdThreshold: 1.0,
    extraLabs: ['ALT', 'AST', 'GGT', 'BIL', 'ALP', 'ALB'],
    extraDiagnostics: ['usg_obp'],
    frequencyWeeks: 4,
    reason: 'Тренболон — гепатотоксичность (инъекционная форма). Печёночный мониторинг каждые 4 нед.'
  },
  {
    substanceClass: 'nandrolone',
    substanceIds: ['npp', 'deca'],
    triggerPD: 'progestogenic',
    pdThreshold: 0.3,
    extraLabs: ['PRL', 'E2', 'SHBG'],
    extraDiagnostics: [],
    frequencyWeeks: 4,
    reason: 'Нандролон — прогестогенная активность → риск гиперпролактинемии. Пролактин каждые 4 нед.'
  },
  {
    substanceClass: 'testosterone',
    substanceIds: ['test_prop', 'test_enan', 'test_cyp', 'test_undec'],
    triggerPD: 'hct_impact',
    pdThreshold: 3.0,
    extraLabs: ['HCT', 'HGB', 'RBC', 'PLT', 'WBC'],
    extraDiagnostics: [],
    frequencyWeeks: 4,
    reason: 'Тестостерон — эритропоэз → полицитемия. Гематокрит каждые 4 нед.'
  },
  {
    substanceClass: 'testosterone',
    substanceIds: ['test_prop', 'test_enan', 'test_cyp', 'test_undec'],
    triggerPD: 'aromatization',
    pdThreshold: 0.8,
    extraLabs: ['E2', 'SHBG', 'PRL'],
    extraDiagnostics: [],
    frequencyWeeks: 4,
    reason: 'Тестостерон — ароматизация → эстрадиол. Мониторинг E2 каждые 4 нед.'
  },
  {
    substanceClass: 'testosterone',
    substanceIds: ['test_prop', 'test_enan', 'test_cyp', 'test_undec'],
    triggerPD: 'lipid_impact',
    pdThreshold: -0.2,
    extraLabs: ['LDL', 'HDL', 'TG'],
    extraDiagnostics: [],
    frequencyWeeks: 6,
    reason: 'Тестостерон — дислипидемия (ЛПВП↓). Липидный профиль каждые 6 нед.'
  },
  {
    substanceClass: 'boldenone',
    substanceIds: ['bold_undec'],
    triggerPD: 'hct_impact',
    pdThreshold: 3.5,
    extraLabs: ['HCT', 'HGB', 'RBC'],
    extraDiagnostics: [],
    frequencyWeeks: 4,
    reason: 'Болденон — высокий HCT-эффект. Полицитемия каждые 4 нед.'
  },
  {
    substanceClass: 'sarm',
    substanceIds: ['ostarine', 'lgd', 'rad140', 's23'],
    triggerPD: 'hepatotoxicity',
    pdThreshold: 0.4,
    extraLabs: ['ALT', 'AST', 'GGT'],
    extraDiagnostics: [],
    frequencyWeeks: 4,
    reason: 'SARMs — гепатотоксичность при высоких дозах. АЛТ/АСТ каждые 4 нед.'
  },
  {
    substanceClass: 'sarm',
    substanceIds: ['s23'],
    triggerPD: 'hct_impact',
    pdThreshold: 1.5,
    extraLabs: ['HCT', 'HGB'],
    extraDiagnostics: [],
    frequencyWeeks: 4,
    reason: 'S-23 — выраженный HCT-эффект + подавление оси.'
  },
  {
    substanceClass: 'peptide_ghrh',
    substanceIds: ['cjc1295', 'mk677'],
    triggerPD: 'hepatotoxicity',
    pdThreshold: 0,
    extraLabs: ['IGF1', 'GLU', 'INS', 'HOMA', 'TSH', 'FT4', 'CORTISOL'],
    extraDiagnostics: [],
    frequencyWeeks: 6,
    reason: 'Пептиды ГР → ИФР-1, инсулинорезистентность, щитовидная. Мониторинг каждые 6 нед.'
  },
  {
    substanceClass: 'pct_aromatase',
    substanceIds: ['anastro', 'letrozole'],
    triggerPD: 'aromatization',
    pdThreshold: -0.9,
    extraLabs: ['E2', 'TT', 'SHBG', 'B12', 'FOL', 'CA', 'ALP'],
    extraDiagnostics: ['dexa'],
    frequencyWeeks: 8,
    reason: 'ИА — подавление E2 → риск остеопороза, дислипидемия. DEXA + кость каждые 8 нед.'
  },
  {
    substanceClass: 'pct_serm',
    substanceIds: ['clomi', 'tamox'],
    triggerPD: 'hepatotoxicity',
    pdThreshold: 0,
    extraLabs: ['ALT', 'AST', 'GGT', 'LH', 'FSH', 'TT', 'E2'],
    extraDiagnostics: [],
    frequencyWeeks: 4,
    reason: 'Кломид/Тамоксифен — мониторинг печени + оси ГГЯ каждые 4 нед.'
  },
  {
    substanceClass: 'insulin',
    substanceIds: ['ins_short', 'ins_long', 'ins_aspart', 'ins_detemir'],
    triggerPD: 'hepatotoxicity',
    pdThreshold: 0,
    extraLabs: ['GLU', 'INS', 'HOMA', 'HbA1c', 'ALT', 'TG', 'K'],
    extraDiagnostics: [],
    frequencyWeeks: 2,
    reason: 'Инсулин — гликемия, инсулинорезистентность, калий. Каждые 2 нед.'
  },
  {
    substanceClass: 'pct_dopamine',
    substanceIds: ['caberg', 'bromocriptine'],
    triggerPD: 'neuro_toxicity',
    pdThreshold: 0.1,
    extraLabs: ['PRL', 'TSH', 'FT4'],
    extraDiagnostics: ['echocg'],
    frequencyWeeks: 8,
    reason: 'Каберголин/Бромокриптин — риск вальвулопатии. ЭхоКГ + пролактин каждые 8 нед.'
  }
];

export interface PhaseLabScheduleInput {
  phase: string;
  courseStartDate: string;
  courseEntries: CourseEntry[];
  currentWeek?: number;
}

export function getActiveDrugTriggers(courseEntries: CourseEntry[]): DrugLabTrigger[] {
  const activeIds = new Set(courseEntries.map(c => c.substanceId));
  const triggered: DrugLabTrigger[] = [];

  for (const trigger of DRUG_LAB_TRIGGERS) {
    const match = trigger.substanceIds.some(id => activeIds.has(id));
    if (!match) continue;
    const substance = PHARMA_DB[trigger.substanceIds.find(id => activeIds.has(id)) ?? ''];
    if (!substance) {
      triggered.push(trigger);
      continue;
    }
    const pdValue = (substance.pd as any)[trigger.triggerPD] as number;
    if (trigger.triggerPD.startsWith('-') || trigger.pdThreshold <= 0) {
      if (Math.abs(pdValue) >= Math.abs(trigger.pdThreshold)) triggered.push(trigger);
    } else {
      if (pdValue >= trigger.pdThreshold || (pdValue < 0 && trigger.pdThreshold < 0 && pdValue <= trigger.pdThreshold)) {
        triggered.push(trigger);
      }
    }
  }

  return triggered;
}

export function generateLabSchedule(input: PhaseLabScheduleInput): LabScheduleItem[] {
  const { phase, courseStartDate, courseEntries, currentWeek = 0 } = input;
  const schedule: LabScheduleItem[] = [];
  const phaseKey = resolveSchedulePhaseKey(phase);
  const baseLabs = [...(REQUIRED_LABS_PER_PHASE[phaseKey] ?? [])];
  const baseDiags = [...(REQUIRED_DIAGNOSTICS_PER_PHASE[phaseKey] ?? [])];
  const triggers = getActiveDrugTriggers(courseEntries);
  const drugExtraLabs = new Set<string>();
  const drugExtraDiags = new Set<string>();
  triggers.forEach(t => {
    t.extraLabs.forEach(l => drugExtraLabs.add(l));
    t.extraDiagnostics.forEach(d => drugExtraDiags.add(d));
  });

  const startDate = new Date(courseStartDate);
  const weeksSinceStart = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (7 * 86400000)));

  if (phaseKey === 'on_cycle' || phaseKey === 'course_bridge_course') {
    schedule.push({
      week: 0,
      label: 'Базовые анализы (до курса)',
      labs: [...baseLabs],
      diagnostics: [...baseDiags],
      urgency: 'critical',
      reason: 'Полный базовый профиль ДО начала курса — обязательная точка отсчёта.',
      phaseSegment: 'baseline'
    });

    const week4Labs = baseLabs.filter(l => ['ALT', 'AST', 'GGT', 'HCT', 'HGB', 'PLT', 'WBC', 'E2', 'PRL', 'LDL', 'HDL', 'TG', 'GLU', 'CREATININE', 'TT', 'CRP'].includes(l));
    drugExtraLabs.forEach(l => { if (!week4Labs.includes(l)) week4Labs.push(l); });
    const week4Diags: string[] = [];
    if (triggers.some(t => t.substanceClass === 'oral_17aa')) week4Diags.push('usg_obp');
    if (triggers.some(t => t.substanceClass === 'insulin')) week4Diags.push('echocg');
    drugExtraDiags.forEach(d => { if (!week4Diags.includes(d)) week4Diags.push(d); });

    schedule.push({
      week: 4,
      label: 'Контроль 4 неделя',
      labs: week4Labs,
      diagnostics: week4Diags.length > 0 ? week4Diags : ['echocg', 'bp_monitor'],
      urgency: 'important',
      reason: 'Ранний контроль: печень, кровь, гормоны, липиды.' + (triggers.length > 0 ? ' + препараты-триггеры.' : ''),
      phaseSegment: 'mid_course'
    });

    const week8Labs = [...baseLabs];
    drugExtraLabs.forEach(l => { if (!week8Labs.includes(l)) week8Labs.push(l); });
    const week8Diags = [...baseDiags];
    drugExtraDiags.forEach(d => { if (!week8Diags.includes(d)) week8Diags.push(d); });

    schedule.push({
      week: 8,
      label: 'Контроль 8 неделя (конец курса)',
      labs: week8Labs,
      diagnostics: week8Diags,
      urgency: 'critical',
      reason: 'Полный повторный профиль + все препараты-триггеры.',
      phaseSegment: 'end_course'
    });

    if (phaseKey === 'course_bridge_course') {
      const bridgeLabs = REQUIRED_LABS_PER_PHASE.bridge ?? [];
      schedule.push({
        week: 10,
        label: 'Контроль моста',
        labs: [...bridgeLabs, ...Array.from(drugExtraLabs).filter(l => !bridgeLabs.includes(l))],
        diagnostics: REQUIRED_DIAGNOSTICS_PER_PHASE.bridge ?? [],
        urgency: 'important',
        reason: 'Мост — частичный контроль + специфичные триггеры.',
        phaseSegment: 'bridge'
      });
      schedule.push({
        week: 12,
        label: 'Повторный базовый (2-й курс)',
        labs: [...(REQUIRED_LABS_PER_PHASE.baseline ?? []), ...Array.from(drugExtraLabs)],
        diagnostics: [...(REQUIRED_DIAGNOSTICS_PER_PHASE.baseline ?? [])],
        urgency: 'critical',
        reason: 'Новый базовый профиль перед 2-м курсом.',
        phaseSegment: 'baseline'
      });
    }
  } else if (phaseKey === 'pct') {
    schedule.push({
      week: 0,
      label: 'Анализы начала ПКТ',
      labs: [...baseLabs],
      diagnostics: [...baseDiags],
      urgency: 'critical',
      reason: 'Полный профиль перед началом ПКТ — состояние оси ГГЯ, печень, кровь.',
      phaseSegment: 'start_pct'
    });
    const midPctLabs = baseLabs.filter(l => ['TT', 'LH', 'FSH', 'E2', 'PRL', 'SHBG', 'ALT', 'HCT', 'IGF1', 'CRP'].includes(l));
    drugExtraLabs.forEach(l => { if (!midPctLabs.includes(l)) midPctLabs.push(l); });
    schedule.push({
      week: 2,
      label: 'Контроль 2 нед ПКТ',
      labs: midPctLabs,
      diagnostics: [],
      urgency: 'important',
      reason: 'Ось ГГЯ: ЛГ/ФСГ/ТТ начинают восстанавливаться. Ранний индикатор.',
      phaseSegment: 'mid_pct'
    });
    schedule.push({
      week: 4,
      label: 'Конец ПКТ',
      labs: [...(REQUIRED_LABS_PER_PHASE.post_pct ?? []), ...Array.from(drugExtraLabs)],
      diagnostics: [...(REQUIRED_DIAGNOSTICS_PER_PHASE.post_pct ?? [])],
      urgency: 'critical',
      reason: 'Финальный контроль ПКТ — полная проверка восстановления.',
      phaseSegment: 'end_pct'
    });
  } else if (phaseKey === 'bridge') {
    schedule.push({
      week: 0,
      label: 'Базовые мост',
      labs: [...baseLabs, ...Array.from(drugExtraLabs)],
      diagnostics: [...baseDiags, ...Array.from(drugExtraDiags)],
      urgency: 'important',
      reason: 'Контроль на мосту — минимальный профиль + триггеры.',
      phaseSegment: 'bridge'
    });
    schedule.push({
      week: 4,
      label: 'Контроль 4 нед моста',
      labs: baseLabs.filter(l => ['TT', 'LH', 'FSH', 'E2', 'ALT', 'HCT', 'CRP', 'TSH', 'IGF1'].includes(l)),
      diagnostics: [],
      urgency: 'optional',
      reason: 'Частичный контроль при длительном мосту.',
      phaseSegment: 'bridge'
    });
  } else if (phaseKey === 'fertility') {
    schedule.push({
      week: 0,
      label: 'Фертильность — полный профиль',
      labs: [...baseLabs],
      diagnostics: [...baseDiags],
      urgency: 'critical',
      reason: 'Полная фертильность: гормоны, спермограмма, ингибин Б, АМГ.',
      phaseSegment: 'fertility'
    });
    schedule.push({
      week: 6,
      label: 'Контроль 6 нед',
      labs: ['TT', 'FT', 'LH', 'FSH', 'E2', 'PRL', 'SHBG', 'INHB', 'AMH'],
      diagnostics: [],
      urgency: 'important',
      reason: 'Промежуточный контроль гормонов фертильности.',
      phaseSegment: 'fertility'
    });
    schedule.push({
      week: 12,
      label: 'Повторная спермограмма (12 нед)',
      labs: [...baseLabs],
      diagnostics: ['usg_testes'],
      urgency: 'critical',
      reason: 'Цикл сперматогенеза ~72 дня. Повторная спермограмма через 12 нед.',
      phaseSegment: 'fertility'
    });
  } else {
    schedule.push({
      week: 0,
      label: 'Базовые анализы',
      labs: [...baseLabs, ...Array.from(drugExtraLabs)],
      diagnostics: [...baseDiags, ...Array.from(drugExtraDiags)],
      urgency: 'critical',
      reason: 'Полный базовый профиль — точка отсчёта для всех расчётов.',
      phaseSegment: 'baseline'
    });
    schedule.push({
      week: 8,
      label: 'Контроль 8 нед',
      labs: baseLabs.filter(l => ['ALT', 'AST', 'HCT', 'HGB', 'TT', 'TSH', 'CRP', 'LDL', 'HDL', 'GLU', 'CREATININE'].includes(l)),
      diagnostics: [],
      urgency: 'optional',
      reason: 'Рутинный контроль при отсутствии активного курса.',
      phaseSegment: 'baseline'
    });
  }

  triggers.forEach(t => {
    const triggeredWeeks: number[] = [];
    for (let w = t.frequencyWeeks; w <= Math.max(weeksSinceStart + 12, 16); w += t.frequencyWeeks) {
      if (!schedule.some(s => Math.abs(s.week - w) < 2 && s.labs.some(l => t.extraLabs.includes(l)))) {
        triggeredWeeks.push(w);
      }
    }
    triggeredWeeks.forEach(w => {
      if (!schedule.some(s => s.week === w)) {
        schedule.push({
          week: w,
          label: `Препарат-триггер: ${t.reason.split('.')[0]}`,
          labs: [...t.extraLabs],
          diagnostics: [...t.extraDiagnostics],
          urgency: 'important',
          reason: t.reason,
          phaseSegment: 'drug_trigger'
        });
      } else {
        const existing = schedule.find(s => s.week === w)!;
        t.extraLabs.forEach(l => { if (!existing.labs.includes(l)) existing.labs.push(l); });
        t.extraDiagnostics.forEach(d => { if (!existing.diagnostics.includes(d)) existing.diagnostics.push(d); });
      }
    });
  });

  schedule.sort((a, b) => a.week - b.week);

  return schedule;
}

export function getCurrentLabStatus(
  schedule: LabScheduleItem[],
  submittedLabs: { code: string; date: string }[],
  currentWeek: number
): { upcoming: LabScheduleItem[]; overdue: LabScheduleItem[]; completed: LabScheduleItem[]; nextDue: LabScheduleItem | null } {
  const labCodes = new Set(submittedLabs.map(l => l.code.toUpperCase()));
  const upcoming: LabScheduleItem[] = [];
  const overdue: LabScheduleItem[] = [];
  const completed: LabScheduleItem[] = [];

  for (const item of schedule) {
    if (item.week > currentWeek + 1) {
      upcoming.push(item);
      continue;
    }
    const missingLabs = item.labs.filter(l => !labCodes.has(l.toUpperCase()));
    const totalRequired = item.labs.length;
    const filledRatio = totalRequired > 0 ? (totalRequired - missingLabs.length) / totalRequired : 1;

    if (filledRatio >= 0.8) {
      completed.push(item);
    } else if (item.week <= currentWeek) {
      overdue.push(item);
    } else {
      upcoming.push(item);
    }
  }

  const nextDue = upcoming[0] ?? null;

  return { upcoming, overdue, completed, nextDue };
}

export function getDrugSpecificLabs(courseEntries: CourseEntry[]): { labs: string[]; diagnostics: string[]; reasons: string[] } {
  const triggers = getActiveDrugTriggers(courseEntries);
  const labs = new Set<string>();
  const diagnostics = new Set<string>();
  const reasons: string[] = [];

  for (const t of triggers) {
    t.extraLabs.forEach(l => labs.add(l));
    t.extraDiagnostics.forEach(d => diagnostics.add(d));
    reasons.push(t.reason);
  }

  return { labs: Array.from(labs), diagnostics: Array.from(diagnostics), reasons };
}

function resolveSchedulePhaseKey(phase: string): string {
  const p = phase.toLowerCase();
  if (p.includes('fertility')) return 'fertility';
  if (p.includes('course-bridge') || p.includes('course_bridge')) return 'course_bridge_course';
  if (p.includes('course') && !p.includes('bridge')) return 'on_cycle';
  if (p.includes('bridge')) return 'bridge';
  if (p.includes('post_pct') || p.includes('post-pct')) return 'post_pct';
  if (p.includes('pct')) return 'pct';
  return 'baseline';
}

export function getWeeksSinceStart(courseStartDate: string): number {
  if (!courseStartDate) return 0;
  const start = new Date(courseStartDate);
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (7 * 86400000)));
}