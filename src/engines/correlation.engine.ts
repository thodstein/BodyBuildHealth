import { CorrelationInput, CorrelationOutput } from '../core/types';

const RULES = [
  { id:'high_hct_iron', cond:(i)=>i.labs.some(l=>l.code==='HCT'&&l.value>52)&&i.symptoms.includes('fatigue'), act:'Снизить железо, рассмотреть донацию. Hct >52 повышает вязкость.', impact:'high' as const, effort:'low' as const },
  { id:'low_sleep_recovery', cond:(i)=>i.readiness.recovery<45, act:'Добавить 1–2 ч сна или магний/теанин. Восстановление критически просело.', impact:'high' as const, effort:'med' as const },
  { id:'high_e2_gyno', cond:(i)=>i.labs.some(l=>l.code==='E2'&&l.value>45)&&i.symptoms.includes('gyno_tenderness'), act:'Проверить E2, рассмотреть анастрозол 0.25мг или дозу теста.', impact:'med' as const, effort:'med' as const },
  { id:'low_fiber_dyslipid', cond:(i)=>i.readiness.nutrition<60, act:'Увеличить клетчатку до 35г/день. Снижает ЛПНП на 10–15%.', impact:'med' as const, effort:'low' as const },
  { id:'high_blood_pressure', cond:(i)=>i.risks.systemBreakdown['cardio']?.net > 40, act:'Проверить приём телмисартана, снизить натрий <5г/день.', impact:'high' as const, effort:'low' as const },
  { id:'low_protein_cut', cond:(i)=>i.readiness.nutrition<70&&i.symptoms.includes('hunger'), act:'Увеличить белок до 2.2–2.4 г/кг. Снижает голод и сохраняет мышцы.', impact:'med' as const, effort:'med' as const },
  { id:'trend_alt_rising', cond:(i)=>i.labs.filter(l=>l.code==='ALT').length>=2 && i.labs.filter(l=>l.code==='ALT')[1].value > i.labs.filter(l=>l.code==='ALT')[0].value, act:'Тренд АЛТ растёт. Добавить TUDCA/NAC, проверить дозу оралов.', impact:'high' as const, effort:'med' as const }
];

export function evaluateCorrelations(input: CorrelationInput): CorrelationOutput {
  const actions = RULES.filter(r => r.cond(input)).map(r => ({
    id: r.id, title: r.id.replace(/_/g,' ').toUpperCase(),
    impact: r.impact, effort: r.effort, reason: r.act
  }));

  const flags: string[] = [];
  if (input.readiness.fatigue > 70) flags.push('🔴 HIGH FATIGUE');
  if (input.risks.overallNet > 40) flags.push('🟡 NET RISK >40%');
  if (input.labs.some(l=>l.code==='HCT'&&l.value>54)) flags.push('🔴 HCT >54%');

  return { actions, flags };
}