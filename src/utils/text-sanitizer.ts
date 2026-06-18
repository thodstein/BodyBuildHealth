export function decodeGarbled(text: string): string {
  if (!text || typeof text !== 'string') return text;
  if (hasValidRussian(text)) return text;
  try {
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code <= 0x7F) { bytes.push(code); continue; }
      if (code >= 0x0410 && code <= 0x042F) { bytes.push(code - 0x0410 + 0xC0); continue; }
      if (code >= 0x0430 && code <= 0x044F) { bytes.push(code - 0x0430 + 0xE0); continue; }
      if (code >= 0x0400 && code <= 0x040F) { bytes.push(code - 0x0400 + 0x80); continue; }
      if (code === 0x0401) { bytes.push(0xA1); continue; }
      if (code === 0x0451) { bytes.push(0xB1); continue; }
      if (code === 0x2014 || code === 0x2015) { bytes.push(0x97); continue; }
      if (code === 0x2013) { bytes.push(0x96); continue; }
      if (code === 0x2116) { bytes.push(0xB9); continue; }
      if (code === 0x00A0) { bytes.push(0xA0); continue; }
      if (code === 0x20AC) { bytes.push(0x88); continue; }
      if (code === 0x2122) { bytes.push(0x99); continue; }
      if (code === 0x2030) { bytes.push(0x89); continue; }
      if (code >= 0x2018 && code <= 0x2019) { bytes.push(code === 0x2018 ? 0x91 : 0x92); continue; }
      if (code >= 0x201C && code <= 0x201D) { bytes.push(code === 0x201C ? 0x93 : 0x94); continue; }
      if (code === 0x2022) { bytes.push(0x95); continue; }
      if (code === 0x2026) { bytes.push(0x85); continue; }
      if (code === 0x2020) { bytes.push(0x86); continue; }
      if (code === 0x2021) { bytes.push(0x87); continue; }
      if (code >= 0x2039 && code <= 0x203A) { bytes.push(code === 0x2039 ? 0x8B : 0x9B); continue; }
      bytes.push(code & 0xFF);
    }
    const result = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    if (hasValidRussian(result)) return result;
    return text;
  } catch {
    return text;
  }
}

function hasValidRussian(text: string): boolean {
  if (!text || text.length < 4) return false;
  const cyrillicCount = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return false;
  const ratio = cyrillicCount / totalChars;
  if (ratio > 0.25) return true;
  const hasRussianWords = /(?:для|через|при|после|синерг|защит|эффект|печен|серд|сниж|повыш|улучш|поддерж|восстан|регул|стимул|ингиб|актив|критич|эссенц|кофакт|дефиц|функц|систем|орган|механ|клетк|препар|дозиров|рекоменд|комбин|действ|сочет|усилив|дополн|компенс)/i.test(text);
  if (hasRussianWords) return true;
  return false;
}

export function cleanDesc(substance: { id?: string; name?: string; description?: string } | null | undefined): string {
  if (!substance) return '';
  const d = substance.description || '';
  const decoded = decodeGarbled(d);
  if (decoded !== d) return decoded;
  if (hasValidRussian(d) || isReadableText(d)) return d;
  return substance.name || substance.id?.replace(/_/g, ' ') || '';
}

export function cleanSynergy(pair: { mechanism?: string; synergyType?: string; clinicalNote?: string }): string {
  if (!pair.mechanism) return '';
  const decoded = decodeGarbled(pair.mechanism);
  if (hasValidRussian(decoded)) return decoded;
  if (hasValidRussian(pair.mechanism)) return pair.mechanism;
  const map: Record<string, string> = {
    synergistic: 'Синергетический эффект при совместном применении',
    additive: 'Аддитивный эффект: препараты дополняют друг друга',
    potentiative: 'Потенцирующий эффект: усиливает действие',
    complementary: 'Комплементарное действие: компенсация побочных эффектов',
  };
  return pair.synergyType && map[pair.synergyType] ? map[pair.synergyType] : 'Взаимодействие препаратов';
}

export function isReadableText(text: string): boolean {
  if (!text || text.length < 2) return false;
  const clean = text.replace(/[\s\-–—,.!?;:()"'«»+%=@#№*~/[\]{}<>|&^$`]+/g, '');
  if (clean.length === 0) return true;
  return /^[а-яА-Яa-zA-Z0-9]+$/u.test(clean);
}
