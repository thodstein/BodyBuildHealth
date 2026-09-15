/**
 * armlift-correction.engine.ts — топ-3 коррекции + мини спец-блок 4 нед (PRO-5 D2).
 * Протоколы — строками из источников (CoC FAQ, NSCA, SBS 2024, PoinT GO), без новой математики.
 * Чистые функции.
 */
import type { ArmliftWeakLink } from './armlift-diagnosis.engine';

export interface ArmliftCorrection {
  id: string;
  title: string;
  protocol: string;
  dose: string;
  freq: string;
  source: string;
}

const C: Record<ArmliftWeakLink, ArmliftCorrection[]> = {
  thumb: [
    { id: 'plate_pinch', title: 'Plate pinch 3×20–30с', protocol: '2 плиты гладкими наружу, щипок до отказа формы', dose: '3 подхода', freq: '2–3×/нед', source: 'NSCA plate pinch' },
    { id: 'hub_lift', title: 'Hub-подъёмы 3×5', protocol: 'Лёгкий хаб, 5 подушечек на базе, без дверной ручки', dose: '3×5', freq: '2×/нед', source: 'IronMind Hub' },
    { id: 'pinch_flip', title: 'Pinch flips лёгкие', protocol: 'Бампер переворот 3×6, только без боли в большом', dose: '3×6', freq: '1×/нед', source: 'NSCA flips' },
  ],
  fingers: [
    { id: 'rt_volume', title: 'RT/толстый гриф 5×3', protocol: 'Тяжёлые тройки DOH + холд 10с на последнем', dose: '5×3', freq: '2×/нед', source: 'SBS DOH holds' },
    { id: 'axle_doh', title: 'Axle DOH без лямок до 85%', protocol: 'Все разминки двойным пронированным, лямки только на максе', dose: 'до 85% 1ПМ', freq: 'каждая тяга', source: 'AUSA Beginners' },
    { id: 'towel_row', title: 'Полотенце-тяги 3×8', protocol: 'Полотенце через турник/ручку — нестабильность', dose: '3×8', freq: '1–2×/нед', source: 'NSCA towel' },
  ],
  wrist_ext: [
    { id: 'band_ext', title: 'Экстензия с резинкой 3×15–25', protocol: 'Полное раскрытие в пястно-фаланговых, медленно', dose: '3×20', freq: '3–4×/нед', source: 'PoinT GO ext' },
    { id: 'wrist_roller', title: 'Кистевой роллер лёгкий', protocol: 'Вверх-вниз без провала запястья в сгиб', dose: '3 подъёма', freq: '2×/нед', source: 'Gripnatic roller' },
    { id: 'rev_curl', title: 'Обратные сгибания 3×12–15', protocol: 'Предплечье на скамье, полный диапазон', dose: '3×12', freq: '2×/нед', source: 'NSCA ext balance' },
  ],
  support_endurance: [
    { id: 'farmer', title: 'Farmer 3×20–40м', protocol: '50–80% веса тела в руку, отказ хвата на 40–45с', dose: '3 подхода', freq: '2×/нед', source: 'NSCA carries' },
    { id: 'dead_hang', title: 'Вис 3×30–45с', protocol: 'Прямые руки, без киппинга, до 60с — потом полотенце/толстый', dose: '3×40с', freq: '2×/нед', source: 'SBS hangs' },
    { id: 'axle_hold', title: 'Axle-hold 3×30с', protocol: 'Толстый гриф на стойках, DOH, 90–120с отдых', dose: '3×30с', freq: '1–2×/нед', source: 'PoinT GO support' },
  ],
  technique: [
    { id: 'rule_single', title: 'Сессия «по правилам»', protocol: 'Протирка + мел + калибровка + 1с локаут каждый подход', dose: '1 сессия', freq: '1×/нед', source: 'IronMind/AUSA rules' },
    { id: 'video_check', title: 'Видео-сверка 3 попыток', protocol: 'Сбоку: параллель, центр, без протяжки по ноге', dose: '3 попытки', freq: '1×/2 нед', source: 'AUSA video judging' },
    { id: 'opener_drill', title: 'Opener 85% ×3 чисто', protocol: 'Три чистых по правилам вместо макса', dose: '3×1', freq: '1×/нед', source: 'LMS тактика' },
  ],
  asymmetry: [
    { id: 'weak_first', title: 'Слабая рука первой +1 подход', protocol: 'Слабую первой, +1 сет, сильная — maintenance', dose: '+1 сет', freq: 'каждая хват-сессия', source: 'Bilateral-практика' },
    { id: 'unilateral_hold', title: 'Односторонние холды', protocol: 'Только слабая: pinch/RT-hold 3×20с', dose: '3×20с', freq: '2×/нед', source: 'NSCA unilateral' },
    { id: 'mirror_test', title: 'Контрольный тест 1×/2 нед', protocol: 'Тот же снаряд L/R, та же позиция', dose: '1 тест', freq: '1×/2 нед', source: 'Mathiowetz-практика' },
  ],
  conditioning: [
    { id: 'stop_pain', title: 'Стоп-нагрузка при боли', protocol: 'Хват на паузу, экстензия без боли + лёд/врач', dose: 'пауза', freq: 'до ухода боли', source: 'Red-flags скрининг' },
    { id: 'ext_easy', title: 'Лёгкая экстензия без боли', protocol: 'Резинка минимальная, 2×15, без провокации', dose: '2×15', freq: 'ежедневно', source: 'Rehab-практика' },
    { id: 'return_test', title: 'Возврат через тест', protocol: 'Безболевой холд 20с → 50% объёма → полный', dose: 'ступени', freq: 'по готовности', source: 'Return-to-play' },
  ],
};

export function rankArmliftCorrections(weakLink: ArmliftWeakLink): ArmliftCorrection[] {
  return [...(C[weakLink] || C.fingers)].slice(0, 3);
}

export interface ArmliftSpecWeek {
  week: number;
  focus: string;
  target: string;
  volume: string;
}

/** Мини спец-блок 4 нед: волна 3/2/1 (накопление/интенс/делод), сухожилия успевают (8–12 нед — только старт). */
export function buildArmliftSpecBlock(weakLink: ArmliftWeakLink, implement: string): ArmliftSpecWeek[] {
  const top = rankArmliftCorrections(weakLink)[0];
  const impl = String(implement || 'rolling_thunder');
  return [
    { week: 1, focus: `База: ${top.title}`, target: impl, volume: '3 сессии · объём 100%' },
    { week: 2, focus: `Объём: ${top.title} +5–10%`, target: impl, volume: '3 сессии · объём 105%' },
    { week: 3, focus: 'Интенс: тяжёлые единички/холды', target: impl, volume: '2 сессии · объём 85%, вес ↑' },
    { week: 4, focus: 'Делод хвату 50% + тест', target: impl, volume: '2 лёгкие · тест точки срыва' },
  ];
}
