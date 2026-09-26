import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * E11 lock: в зоне хаба Интеллекта не должно оставаться МЁРТВЫХ runtime-экспортов
 * (const/function/class), у которых нет ни одного потребителя — ни в проде, ни в тестах.
 *
 * Почему только runtime, а не type-only экспорты:
 *  - интерфейсы/типы стираются компилятором, не стоят ничего в рантайме и документируют форму
 *    результата; их удаление = churn без функциональной ценности (политика проекта);
 *  - мёртвый runtime-код — это реальный мусор: он врёт («поле всегда 0»), тянет зависимости
 *    и провоцирует ошибочные вызовы. Именно его чистим.
 *
 * Осознанные исключения (ALLOW) перечислены явно, чтобы каждое решение было видимым.
 */

const ZONE_DIR = resolve(__dirname, '..');
const REPO_SRC = resolve(__dirname, '../../..');

/**
 * Осознанные исключения (ALLOW) перечислены явно, чтобы каждое решение было видимым.
 * Пусто: на Sep 2026 мёртвых runtime-экспортов в зоне нет (E11-чистка закрыта).
 * Если появится новый легаси-экспорт — вносить только сюда и с причиной.
 */
const ALLOW: Record<string, string> = {};

function listFiles(dir: string, exts = ['.ts', '.tsx'], skipTests = true): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      if (skipTests && e.name === '__tests__') continue;
      out.push(...listFiles(p, exts, skipTests));
    } else if (exts.some(x => e.name.endsWith(x))) {
      out.push(p);
    }
  }
  return out;
}

const RUNTIME_EXPORT = [
  /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm,
  /^export\s+class\s+([A-Za-z0-9_]+)/gm,
  /^export\s+(?:const|let)\s+([A-Za-z0-9_]+)/gm,
  // re-export списком: export { a, b as c }
  /^export\s*\{([^}]*)\}/gm,
];

function runtimeExportsOf(src: string): string[] {
  const out = new Set<string>();
  for (const re of RUNTIME_EXPORT) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const body = m[1];
      if (body.includes('{')) continue;           // re-export из другого модуля — не наш символ
      for (const part of body.split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name && /^[A-Za-z0-9_]+$/.test(name) && !/^type$/.test(name)) out.add(name);
      }
    }
  }
  return [...out];
}

describe('E11 lock: нет мёртвых runtime-экспортов в зоне хаба Интеллекта', () => {
  const zoneFiles = listFiles(ZONE_DIR).filter(f => {
    const n = f.split(/[\\/]/).pop() || '';
    return /^intelligence-.*\.ts$/.test(n) || ['training-load.engine.ts', 'autoregulation.engine.ts',
      'autoregulation-pro.engine.ts', 'srpe-store.ts', 'hrv-baseline.engine.ts'].includes(n);
  });
  const repoFiles = listFiles(REPO_SRC, ['.ts', '.tsx'], false);   // включая тесты: потребителем считается и тест
  const cache = new Map<string, string>();
  const read = (f: string) => {
    if (!cache.has(f)) cache.set(f, readFileSync(f, 'utf8'));
    return cache.get(f)!;
  };

  it('зона найдена и непуста (иначе лок ничего не проверяет)', () => {
    expect(zoneFiles.length).toBeGreaterThanOrEqual(8);
  });

  it('каждый runtime-экспорт зоны имеет потребителя (внутри модуля, в проде или в тесте)', () => {
    const lastDead: string[] = [];
    for (const zf of zoneFiles) {
      const src = read(zf);
      const lines = src.split('\n');
      for (const name of runtimeExportsOf(src)) {
        const rx = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        // 1) внутреннее использование: считаем совпадения, кроме строки объявления
        let internal = 0;
        lines.forEach(l => {
          if (rx.test(l) && !new RegExp('^\\s*export\\s+(?:const|let|function|async function|class)\\s+' + name + '\\b').test(l)) {
            internal++;
          }
        });
        // 2) внешнее использование: другие файлы репозитория (прод + тесты)
        let external = false;
        for (const f of repoFiles) {
          if (f === zf) continue;
          if (rx.test(read(f))) { external = true; break; }
        }
        if (internal === 0 && !external) lastDead.push(`${zf.split(/[\\/]/).pop()} -> ${name}`);
      }
    }
    if (lastDead.length) console.log('DEAD EXPORTS:', lastDead.join(' | '));
    expect(lastDead).toEqual([]);
  });

  it('ALLOW не растёт молча: каждая запись реально встречается в репозитории', () => {
    for (const name of Object.keys(ALLOW)) {
      const found = repoFiles.some(f => read(f).includes(name));
      expect(found, `ALLOW: ${name} больше не встречается — удалите запись`).toBe(true);
    }
  });

  it('E11-факты: помеченные как мёртвые символы действительно отсутствуют в коде', () => {
    const zone = zoneFiles.map(read).join('\n');
    for (const gone of ['WeeklyLoad', 'intensityCap', 'repRangeMod', 'baseRate',
                        'totalDailyLoadsFromMuscle']) {
      expect(zone.includes(gone), `${gone} должен быть удалён (E11)`).toBe(false);
    }
  });

  it('легаси-снапшот v1 остаётся только источником миграции, а не рабочим путём', () => {
    const hub = readFileSync(
      resolve(__dirname, '../../../ui/screens/TrainingScreen_parts/UnifiedIntelligenceHub.tsx'), 'utf8');
    expect(hub).toContain('he_unified_intel_snapshot_v1');
    // рядом обязана быть пометка про легаси, иначе кто-то решит писать в него
    const i = hub.indexOf('he_unified_intel_snapshot_v1');
    const around = hub.slice(Math.max(0, i - 200), i + 120);
    expect(around.toLowerCase()).toContain('legacy');
  });
});
