const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/ui/screens/SupportScreen.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Add selectedCatalogId state after catalogSubTab
const stateInsert = "\n  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);";
const catalogSubTabLine = "const [catalogSubTab, setCatalogSubTab] = useState<'type' | 'organ' | 'tier'>('type');";
const idx = content.indexOf(catalogSubTabLine);
if (idx === -1) { console.error('Cannot find catalogSubTab'); process.exit(1); }
const lineEnd = content.indexOf('\n', idx);
content = content.slice(0, lineEnd) + stateInsert + content.slice(lineEnd);
console.log('Step 1: Added selectedCatalogId state');

// Step 2: Add catalog useMemos before SUPPORT_TIER_GROUPS
const tierGroupsPos = content.indexOf("const SUPPORT_TIER_GROUPS = useMemo");
if (tierGroupsPos === -1) { console.error('Cannot find SUPPORT_TIER_GROUPS'); process.exit(1); }

const memos = `
  // === CATALOG DATA useMemos (284 entries from SUPPORT_CATALOG_DATA) ===
  const catalogEntries = useMemo(() => {
    const entries = Object.values(SUPPORT_CATALOG_DATA);
    const q = searchQuery.toLowerCase();
    if (q) {
      return entries.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.nameRu.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.some(c => c.toLowerCase().includes(q)) ||
        e.mechanisms.some(m => m.toLowerCase().includes(q)) ||
        e.organs.some(o => o.toLowerCase().includes(q))
      );
    }
    return entries;
  }, [searchQuery]);

  const catalogEntriesFiltered = useMemo(() => {
    if (supportTierFilter === 'all') return catalogEntries;
    return catalogEntries.filter(e => e.tier === supportTierFilter);
  }, [catalogEntries, supportTierFilter]);

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, SupportCatalogEntry[]> = {};
    for (const e of catalogEntriesFiltered) {
      const primaryCat = e.category[0] || 'other';
      if (!groups[primaryCat]) groups[primaryCat] = [];
      groups[primaryCat].push(e);
    }
    const catOrder = ['vitamin','mineral','amino_acid','fatty_acid','antioxidant','adaptogen','herb','probiotic','nootropic','peptide','hormone','enzyme','electrolyte','antiinflammatory','hepatoprotector','cardioprotector','neuroprotector','renoprotector','joint','immunomodulator','anabolic','metabolic','pharma','other'];
    return catOrder.filter(c => groups[c]).map(c => ({ cat: c, entries: groups[c], count: groups[c].length }))
      .concat(Object.keys(groups).filter(c => !catOrder.includes(c)).map(c => ({ cat: c, entries: groups[c], count: groups[c].length })));
  }, [catalogEntriesFiltered]);

  const organCatalog = useMemo(() => {
    const groups: Record<string, { key: string; label: string; emoji: string; entries: SupportCatalogEntry[]; count: number }> = {} as any;
    const ORG_MAP: Record<string, { key: string; label: string; emoji: string }> = {
      LIVER: { key:'liver', label:'\u041F\u0435\u0447\u0435\u043D\u044C', emoji:'\u041A\u042B' }, KIDNEYS: { key:'kidneys', label:'\u041F\u043E\u0447\u043A\u0438', emoji:'\u041A\u042A' },
      HEART: { key:'heart', label:'\u0421\u0435\u0440\u0434\u0446\u0435', emoji:'\u2764\uFE0F' }, VESSELS: { key:'heart', label:'\u0421\u0435\u0440\u0434\u0446\u0435 \u0438 \u0441\u043E\u0441\u0443\u0434\u044B', emoji:'\u041A\u042B' },
      BRAIN: { key:'brain', label:'\u041C\u043E\u0437\u0433 \u0438 \u043D\u0435\u0440\u0432\u044B', emoji:'\u041A\u042C' }, NERVES: { key:'brain', label:'\u041C\u043E\u0437\u0433 \u0438 \u043D\u0435\u0440\u0432\u044B', emoji:'\u041A\u042C' },
      LUNGS: { key:'lungs', label:'\u041B\u0451\u0433\u043A\u0438\u0435', emoji:'\u041A\u042B' }, SKIN: { key:'skin', label:'\u041A\u043E\u0436\u0430 \u0438 \u0432\u043E\u043B\u043E\u0441\u044B', emoji:'\u2728' },
      EYES: { key:'eyes', label:'\u0413\u043B\u0430\u0437\u0430', emoji:'\u041A\u0424' }, IMMUNE_SYSTEM: { key:'immune', label:'\u0418\u043C\u043C\u0443\u043D\u0438\u0442\u0435\u0442', emoji:'\u041A\u042C' },
      REPRODUCTIVE: { key:'repro', label:'\u0420\u0435\u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u0430\u044F', emoji:'\u041A\u042C' }, MUSCLES: { key:'muscles', label:'\u041C\u044B\u0448\u0446\u044B', emoji:'\u041A\u042A' },
      BONES: { key:'bones', label:'\u041A\u043E\u0441\u0442\u0438 \u0438 \u0441\u0443\u0441\u0442\u0430\u0432\u044B', emoji:'\u041A\u042B' }, JOINTS: { key:'bones', label:'\u041A\u043E\u0441\u0442\u0438 \u0438 \u0441\u0443\u0441\u0442\u0430\u0432\u044B', emoji:'\u041A\u042B' },
      PANCREAS: { key:'endocrine', label:'\u042D\u043D\u0434\u043E\u043A\u0440\u0438\u043D\u043D\u0430\u044F', emoji:'\u041A\u042C' }, THYROID: { key:'endocrine', label:'\u042D\u043D\u0434\u043E\u043A\u0440\u0438\u043D\u043D\u0430\u044F', emoji:'\u041A\u042C' },
      ADRENALS: { key:'endocrine', label:'\u042D\u043D\u0434\u043E\u043A\u0440\u0438\u043D\u043D\u0430\u044F', emoji:'\u041A\u042C' }, STOMACH: { key:'gi', label:'\u0416\u041A\u0422', emoji:'\u041A\u042B' },
      INTESTINES: { key:'gi', label:'\u0416\u041A\u0422', emoji:'\u041A\u042B' }, BLOOD: { key:'blood', label:'\u041A\u0440\u043E\u0432\u044C', emoji:'\u041A\u042B' },
      PROSTATE: { key:'repro', label:'\u0420\u0435\u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u0430\u044F', emoji:'\u041A\u042C' }, TESTES: { key:'repro', label:'\u0420\u0435\u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u0430\u044F', emoji:'\u041A\u042C' },
    };
    const otherGroup: SupportCatalogEntry[] = [];
    for (const e of catalogEntriesFiltered) {
      const eOrgans = e.organs || [];
      if (eOrgans.length === 0) { otherGroup.push(e); continue; }
      const seen = new Set<string>();
      for (const o of eOrgans) {
        const m = (ORG_MAP as any)[o];
        if (m && !seen.has(m.key)) {
          seen.add(m.key);
          if (!groups[m.key]) groups[m.key] = { key:m.key, label:m.label, emoji:m.emoji, entries:[], count:0 };
          groups[m.key].entries.push(e);
          groups[m.key].count++;
        }
      }
    }
    if (otherGroup.length > 0) groups['other'] = { key:'other', label:'\u041F\u0440\u043E\u0447\u0435\u0435', emoji:'\u041A\u042C', entries:otherGroup, count:otherGroup.length };
    return Object.values(groups).sort((a,b) => b.count - a.count);
  }, [catalogEntriesFiltered]);

  const tierCatalog = useMemo(() => {
    const tiers: Record<string, { key:string; label:string; emoji:string; color:string; desc:string; entries:SupportCatalogEntry[]; count:number }> = {
      core: { key:'core', label:'\u042F\u0434\u0440\u043E', emoji:'\u041A\u042C', color:'#22c55e', desc:'\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u043D\u0430 \u043B\u044E\u0431\u043E\u043C \u043A\u0443\u0440\u0441\u0435', entries:[] as SupportCatalogEntry[], count:0 },
      standard: { key:'standard', label:'\u0421\u0442\u0430\u043D\u0434\u0430\u0440\u0442', emoji:'\u041A\u042C', color:'#eab308', desc:'\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D\u043E \u043F\u0440\u0438 \u0434\u043E\u0437\u0430\u0445 >500 \u043C\u0433/\u043D\u0435\u0434', entries:[] as SupportCatalogEntry[], count:0 },
      advanced: { key:'advanced', label:'\u041F\u0440\u043E\u0434\u0432\u0438\u043D\u0443\u0442\u044B\u0439', emoji:'\u041A\u042C', color:'#f97316', desc:'\u041F\u0440\u0438 \u0441\u043F\u0435\u0446\u0438\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0446\u0435\u043B\u044F\u0445', entries:[] as SupportCatalogEntry[], count:0 },
      specialty: { key:'specialty', label:'\u0421\u043F\u0435\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439', emoji:'\u041A\u042C', color:'#ef4444', desc:'\u0424\u0430\u0440\u043C\u0430\u043A\u043E\u043B\u043E\u0433\u0438\u044F, \u0440\u0435\u0446\u0435\u043F\u0442\u0443\u0440\u043D\u044B\u0435', entries:[] as SupportCatalogEntry[], count:0 },
    };
    for (const e of catalogEntriesFiltered) {
      if (tiers[e.tier]) { tiers[e.tier].entries.push(e); tiers[e.tier].count++; }
      else { tiers.specialty.entries.push(e); tiers.specialty.count++; }
    }
    return Object.values(tiers);
  }, [catalogEntriesFiltered]);

`;

content = content.slice(0, tierGroupsPos) + memos + content.slice(tierGroupsPos);
console.log('Step 2: Added catalog useMemos');

// Step 3: Replace the inner catalog section (organ + tier + type sub-tabs)
// Find start: {catalogSubTab === 'organ' && (
const organStart = content.indexOf("{catalogSubTab === 'organ' && (");
const synergiesStart = content.indexOf("{renderView(infoView, 'synergies'");
if (organStart === -1 || synergiesStart === -1) { console.error('Cannot find markers'); process.exit(1); }

// Find the line start
let sectionStart = organStart;
while (sectionStart > 0 && content[sectionStart - 1] !== '\n') sectionStart--;

// Find end: just before synergies renderView, go back to find closing tags
let sectionEnd = synergiesStart;
while (sectionEnd > sectionStart && (content[sectionEnd - 1] === '\n' || content[sectionEnd - 1] === ' ' || content[sectionEnd - 1] === '\r')) sectionEnd--;

// The original closing was:
//                )}
//              </div>
//            )}
// So we need to include the proper closing for the renderView callback

const closingTags = '\n              </div>\n            )}';

// Load the new catalog content from the file
const newInnerCatalog = fs.readFileSync(path.join(__dirname, 'new-inner-catalog.txt'), 'utf8');

content = content.slice(0, sectionStart) + newInnerCatalog + closingTags + content.slice(sectionEnd + 1);
console.log('Step 3: Replaced inner catalog section. New size:', content.length);

// Step 4: Replace the outer catalog section
const outerStart = content.indexOf("{/* ===== CATALOG (ALL_SUBSTANCES");
const outerSynergies = content.indexOf("{/* ===== SYNERGIES (ALL_INTERACTIONS");
if (outerStart === -1 || outerSynergies === -1) { console.error('Cannot find outer catalog markers'); process.exit(1); }

// Find end of outer catalog section
let outerEnd = outerSynergies;
while (outerEnd > outerStart && (content[outerEnd - 1] === '\n' || content[outerEnd - 1] === ' ' || content[outerEnd - 1] === '\r')) outerEnd--;
let outerEndLine = content.indexOf('\n', outerEnd);
if (outerEndLine === -1) outerEndLine = content.length;

const newOuterCatalog = fs.readFileSync(path.join(__dirname, 'new-outer-catalog.txt'), 'utf8');

content = content.slice(0, outerStart) + newOuterCatalog + content.slice(outerEndLine + 1);
console.log('Step 4: Replaced outer catalog section');

// Step 5: Update count displays
content = content.replace('�����: ${ALL_SUBSTANCES.length} �������', '�����: ��������� ��������');
content = content.replace('build:2026-06-15 | subs:{ALL_SUBSTANCES.length} | int:{ALL_INTERACTIONS.length} | stacks:{ALL_STACKS.length} | tab:{calcView}/{infoView}', 'build:2026-06-17 | catalog:{Object.keys(SUPPORT_CATALOG_DATA).length} | int:{ALL_INTERACTIONS.length} | stacks:{ALL_STACKS.length} | tab:{calcView}/{infoView}');
console.log('Step 5: Updated count displays');

fs.writeFileSync(filePath, content, 'utf8');
console.log('All changes saved! Final size:', content.length);
