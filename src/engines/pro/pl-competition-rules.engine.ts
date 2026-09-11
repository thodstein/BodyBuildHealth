/**
 * pl-competition-rules.engine.ts — P4: зачёт/незачёт по правилам IPF/USAPL.
 *
 * Только факты регламентов (глубина приседа, пауза жима, локаут, сигналы) —
 * без выдуманных норм. Вход — наблюдаемые флаги (судья/видео/самооценка),
 * выход — вердикт clean/question/fail + список проваленных пунктов.
 * Скрининг, не судейство: question = «под вопросом, проверьте на видео».
 */
import type { Lift } from '../lms/weakpoint-pl';

export type RulesVerdict = 'clean' | 'question' | 'fail';

export interface RuleCheck {
  id: string;
  label: string;
  critical: boolean;
}

export const RULE_CHECKS: Partial<Record<Lift, RuleCheck[]>> = {
  squat: [
    { id: 'depth', label: 'Глубина: верх бедра у таза ниже верха колен', critical: true },
    { id: 'lockout', label: 'Старт/финиш: стойка прямо, колени выпрямлены', critical: true },
    { id: 'no_bounce', label: 'Без двойного отбива внизу и движения вниз', critical: true },
    { id: 'signals', label: 'Сигналы судьи (squat/rack) соблюдены', critical: false },
  ],
  bench: [
    { id: 'touch', label: 'Касание груди (не живота/ремня)', critical: true },
    { id: 'pause', label: 'Пауза на груди до сигнала press', critical: true },
    { id: 'lockout', label: 'Дожим до прямых рук (локти)', critical: true },
    { id: 'no_down', label: 'Без движения вниз при дожиме', critical: true },
    { id: 'contact', label: 'Голова/плечи/ягодицы на скамье, стопы на помосте', critical: false },
  ],
  deadlift: [
    { id: 'lockout', label: 'Финиш: стойка прямо, колени выпрямлены, плечи отведены', critical: true },
    { id: 'no_down', label: 'Без движения вниз и без поддержки бёдрами (hitch)', critical: true },
    { id: 'control', label: 'Возврат на помост под контролем (не бросок)', critical: false },
    { id: 'signals', label: 'Ожидание сигнала down', critical: false },
  ],
  sumo: [
    { id: 'lockout', label: 'Финиш: стойка прямо, колени выпрямлены, плечи отведены', critical: true },
    { id: 'no_down', label: 'Без движения вниз и без поддержки бёдрами (hitch)', critical: true },
    { id: 'control', label: 'Возврат на помост под контролем (не бросок)', critical: false },
    { id: 'signals', label: 'Ожидание сигнала down', critical: false },
  ],
  ohp: [
    { id: 'lockout', label: 'Финиш: руки прямые, корпус без отклонения', critical: true },
    { id: 'no_legs', label: 'Без швунга ногами (строгий жим)', critical: false },
  ],
};

export interface RulesResult {
  verdict: RulesVerdict;
  failed: string[];
  failedLabels: string[];
  text: string;
}

/** Проверка лифта по флагам {checkId: ok}. Отсутствующий флаг = «под вопросом», не провал. */
export function checkLiftRules(lift: Lift, checks: Record<string, boolean | null | undefined>): RulesResult {
  const defs = RULE_CHECKS[lift] ?? [];
  if (defs.length === 0) {
    return { verdict: 'question', failed: [], failedLabels: [], text: 'Чек-листа для этого движения нет — только базовые лифты.' };
  }
  const failed = defs.filter(d => checks[d.id] === false);
  const unknown = defs.filter(d => checks[d.id] == null);
  const critFail = failed.filter(d => d.critical);
  const verdict: RulesVerdict = critFail.length > 0 ? 'fail' : failed.length > 0 || unknown.length > 0 ? 'question' : 'clean';
  const text =
    verdict === 'clean'
      ? 'Зачёт: все пункты чек-листа соблюдены.'
      : verdict === 'fail'
        ? `Незачёт: ${critFail.map(d => d.label).join('; ')}.`
        : `Под вопросом: ${[...failed, ...unknown].map(d => d.label).join('; ')} — проверьте на видео.`;
  return { verdict, failed: failed.map(d => d.id), failedLabels: failed.map(d => d.label), text };
}
