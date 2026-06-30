import {
  BRIDGE_MECH_TO_CATALOG,
  findCatalogSubstancesForBridgeMech,
} from '../src/data/mechanism-code-bridge';

import { SUPPORT_CATALOG_DATA } from '../src/data/support-index';

interface SystemGroup {
  label: string;
  bridgeKeys: string[];
}

function getSystemLabel(sysPrefix: string): string {
  const labels: Record<string, string> = {
    cardio: '❤️ CARDIO',
    hepatic: '🫁 HEPATIC',
    renal: '🫘 RENAL',
    neuro: '🧠 NEURO',
    neuro_tox: '☣️ NEURO_TOX',
    endocrine: '⚖️ ENDOCRINE',
    hematologic: '🩸 HEMATOLOGIC',
    reproductive: '🧬 REPRODUCTIVE',
    musculoskeletal: '💪 MUSCULOSKELETAL',
  };
  return labels[sysPrefix] || sysPrefix.toUpperCase();
}

function padRight(s: string, len: number): string {
  const visible = s.replace(/[\u{1F300}-\u{1FAFF}]/gu, '  ').length;
  const diff = len - visible;
  return s + (diff > 0 ? ' '.repeat(diff) : '');
}

function sepLine(len: number): string {
  return '─'.repeat(len);
}

export function dumpAllBridgeSubs(): void {
  const bridgeKeys = Object.keys(BRIDGE_MECH_TO_CATALOG);

  // Group by system prefix
  const groups: Record<string, string[]> = {};
  for (const key of bridgeKeys) {
    const sys = key.replace(/_\d+$/, '');
    if (!groups[sys]) groups[sys] = [];
    groups[sys].push(key);
  }

  const sysOrder = [
    'cardio', 'hepatic', 'renal', 'neuro', 'neuro_tox',
    'endocrine', 'hematologic', 'reproductive', 'musculoskeletal',
  ];

  const idWidth = 18;
  const tierWidth = 10;
  const nameWidth = 42;
  const totalWidth = idWidth + tierWidth + nameWidth + 6;

  for (const sys of sysOrder) {
    const keys = groups[sys];
    if (!keys || keys.length === 0) continue;

    const systemLabel = getSystemLabel(sys);
    console.log(`\n${'═'.repeat(totalWidth)}`);
    console.log(`  ${systemLabel}  (${keys.length} mechanisms, ${Object.keys(BRIDGE_MECH_TO_CATALOG).length} total bridge keys)`);
    console.log(`${'═'.repeat(totalWidth)}`);

    for (const key of keys) {
      const codes = BRIDGE_MECH_TO_CATALOG[key];
      const codeSummary = codes.length <= 5
        ? codes.join(', ')
        : codes.slice(0, 4).join(', ') + ` … (+${codes.length - 4} more)`;

      console.log(`\n  ${key}: ${codeSummary}`);
      console.log(`  ${'┌' + '─'.repeat(idWidth) + '┬' + '─'.repeat(tierWidth) + '┬' + '─'.repeat(nameWidth) + '┐'}`);

      // Header row
      console.log(`  │${padRight(' ID', idWidth)}│${padRight(' Tier', tierWidth)}│${padRight(' Name', nameWidth)}│`);
      console.log(`  ${'├' + '─'.repeat(idWidth) + '┼' + '─'.repeat(tierWidth) + '┼' + '─'.repeat(nameWidth) + '┤'}`);

      const subIds = findCatalogSubstancesForBridgeMech(key);
      if (subIds.length === 0) {
        console.log(`  │${padRight(' (none)', idWidth)}│${padRight('', tierWidth)}│${padRight('', nameWidth)}│`);
      } else {
        for (const subId of subIds) {
          const entry = SUPPORT_CATALOG_DATA[subId];
          if (!entry) {
            console.log(`  │${padRight(' ' + subId, idWidth)}│${padRight(' ???', tierWidth)}│${padRight(' (no entry)', nameWidth)}│`);
            continue;
          }
          const tier = entry.tier || '?';
          const name = entry.nameRu || entry.name || subId;
          console.log(`  │${padRight(' ' + subId, idWidth)}│${padRight(' ' + tier, tierWidth)}│${padRight(' ' + name, nameWidth)}│`);
        }
      }

      console.log(`  ${'└' + '─'.repeat(idWidth) + '┴' + '─'.repeat(tierWidth) + '┴' + '─'.repeat(nameWidth) + '┘'}`);
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(totalWidth)}`);
  console.log('  SUMMARY');
  console.log(`${'═'.repeat(totalWidth)}`);
  let totalSubs = new Set<string>();
  let totalSubsWithCount: Record<string, number> = {};
  for (const key of bridgeKeys) {
    const ids = findCatalogSubstancesForBridgeMech(key);
    for (const id of ids) {
      totalSubs.add(id);
      totalSubsWithCount[id] = (totalSubsWithCount[id] || 0) + 1;
    }
  }
  console.log(`  Total bridge keys: ${bridgeKeys.length}`);
  console.log(`  Total unique substances in auto-index: ${totalSubs.size}`);

  // Top-20 most bridging substances
  const sorted = Object.entries(totalSubsWithCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log(`\n  Top-20 substances by bridge coverage:`);
  console.log(`  ${'┌' + '─'.repeat(idWidth) + '┬' + '─'.repeat(tierWidth) + '┬' + '─'.repeat(nameWidth) + '┬' + '─'.repeat(8) + '┐'}`);
  console.log(`  │${padRight(' ID', idWidth)}│${padRight(' Tier', tierWidth)}│${padRight(' Name', nameWidth)}│${padRight(' Count', 8)}│`);
  console.log(`  ${'├' + '─'.repeat(idWidth) + '┼' + '─'.repeat(tierWidth) + '┼' + '─'.repeat(nameWidth) + '┼' + '─'.repeat(8) + '┤'}`);
  for (const [id, count] of sorted) {
    const entry = SUPPORT_CATALOG_DATA[id];
    const tier = entry?.tier || '?';
    const name = entry?.nameRu || entry?.name || id;
    console.log(`  │${padRight(' ' + id, idWidth)}│${padRight(' ' + tier, tierWidth)}│${padRight(' ' + name, nameWidth)}│${padRight(' ' + String(count), 8)}│`);
  }
  console.log(`  ${'└' + '─'.repeat(idWidth) + '┴' + '─'.repeat(tierWidth) + '┴' + '─'.repeat(nameWidth) + '┴' + '─'.repeat(8) + '┘'}`);
  console.log();
}

// Auto-execute when run directly
dumpAllBridgeSubs();
