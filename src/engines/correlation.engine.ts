import { CorrelationInput, CorrelationOutput } from '../core/types';

const RULES = [
  { id:'high_hct_iron', cond:(i: CorrelationInput)=>i.labs.some((l: { code: string; value: number })=>l.code==='HCT'&&l.value>52)&&i.symptoms.includes('fatigue'), act:'РЎРЅРёР·РёС‚СЊ Р¶РµР»РµР·Рѕ, СЂР°СЃСЃРјРѕС‚СЂРµС‚СЊ РґРѕРЅР°С†РёСЋ. Hct >52 РїРѕІС‹С€Р°РµС‚ РІСЏР·РєРѕСЃС‚СЊ.', impact:'high', effort:'low' },
  { id:'low_sleep_recovery', cond:(i: CorrelationInput)=>i.readiness.recovery<45, act:'Р”РѕР±Р°РІРёС‚СЊ 1вЂ“2 С‡ СЃРЅР° РёР»Рё РјР°РіРЅРёР№/С‚РµР°РЅРёРЅ. Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РєСЂРёС‚РёС‡РµСЃРєРё РїСЂРѕСЃРµР»Рѕ.', impact:'high', effort:'med' },
  { id:'high_e2_gyno', cond:(i: CorrelationInput)=>i.labs.some((l: { code: string; value: number })=>l.code==='E2'&&l.value>45)&&i.symptoms.includes('gyno_tenderness'), act:'РџСЂРѕРІРµСЂРёС‚СЊ E2, СЂР°СЃСЃРјРѕС‚СЂРµС‚СЊ Р°РЅР°СЃС‚СЂРѕР·РѕР» 0.25РјРі РёР»Рё РґРѕР·Сѓ С‚РµСЃС‚Р°.', impact:'med', effort:'med' },
  { id:'low_fiber_dyslipid', cond:(i: CorrelationInput)=>i.readiness.nutrition<60, act:'РЈРІРµР»РёС‡РёС‚СЊ РєР»РµС‚С‡Р°С‚РєСѓ РґРѕ 35Рі/РґРµРЅСЊ. РЎРЅРёР¶Р°РµС‚ Р›РџРќРџ РЅР° 10вЂ“15%.', impact:'med', effort:'low' },
  { id:'high_blood_pressure', cond:(i: CorrelationInput)=>i.risks.systemBreakdown['cardio']?.net > 40, act:'РџСЂРѕРІРµСЂРёС‚СЊ РїСЂРёС‘Рј С‚РµР»РјРёСЃР°СЂС‚Р°РЅР°, СЃРЅРёР·РёС‚СЊ РЅР°С‚СЂРёР№ <5Рі/РґРµРЅСЊ.', impact:'high', effort:'low' },
  { id:'low_protein_cut', cond:(i: CorrelationInput)=>i.readiness.nutrition<70&&i.symptoms.includes('hunger'), act:'РЈРІРµР»РёС‡РёС‚СЊ Р±РµР»РѕРє РґРѕ 2.2вЂ“2.4 Рі/РєРі. РЎРЅРёР¶Р°РµС‚ РіРѕР»РѕРґ Рё СЃРѕС…СЂР°РЅСЏРµС‚ РјС‹С€С†С‹.', impact:'med', effort:'med' },
  { id:'trend_alt_rising', cond:(i: CorrelationInput)=>i.labs.filter((l: { code: string; value: number })=>l.code==='ALT').length>=2 && i.labs.filter((l: { code: string; value: number })=>l.code==='ALT')[1].value > i.labs.filter((l: { code: string; value: number })=>l.code==='ALT')[0].value, act:'РўСЂРµРЅРґ РђР›Рў СЂР°СЃС‚С‘С‚. Р”РѕР±Р°РІРёС‚СЊ TUDCA/NAC, РїСЂРѕРІРµСЂРёС‚СЊ РґРѕР·Сѓ РѕСЂР°Р»РѕРІ.', impact:'high', effort:'med' }
];

export function evaluateCorrelations(input: CorrelationInput): CorrelationOutput {
  const actions = RULES.filter(r => r.cond(input)).map(r => ({
    id: r.id, title: r.id.replace(/_/g,' ').toUpperCase(),
    impact: r.impact, effort: r.effort, reason: r.act
  }));

  const flags: string[] = [];
  // if (input.readiness.fatigue > 70) flags.push('рџ”ґ HIGH FATIGUE');
  if (input.risks.overallNet > 40) flags.push('рџџЎ NET RISK >40%');
  if (input.labs.some((l: { code: string; value: number })=>l.code==='HCT'&&l.value>54)) flags.push('рџ”ґ HCT >54%');

  return { actions, flags };
}
