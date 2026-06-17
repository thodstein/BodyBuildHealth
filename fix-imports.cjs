const fs = require("fs");
let f = fs.readFileSync("src/ui/screens/SupportScreen.tsx", "utf-8");

// Add catalog-exports import after support-catalog import
const oldLine = "from '../../data/support-catalog';";
const newLine = "from '../../data/support-catalog';\nimport { CATALOG_SIZE, CANONICAL_SIZE } from '../../data/catalog-exports';";
f = f.replace(oldLine, newLine);

// Replace canonical-map import with catalog-exports
f = f.replace("import { CANONICAL_ID_MAP } from '../../data/canonical-map';", "import { CANONICAL_ID_MAP } from '../../data/catalog-exports';");

// Replace the force-include useEffect with a const that uses CATALOG_SIZE
f = f.replace(
  "// Force include catalog data in bundle\n  useEffect(() => { if (SUPPORT_CATALOG_DATA && Object.keys(SUPPORT_CATALOG_DATA).length > 0 && Object.keys(CANONICAL_ID_MAP).length > 0) { /* catalog loaded */ } }, []);",
  "// Force catalog data inclusion (prevents Vite tree-shaking)\n  const _catalogDataSize = CATALOG_SIZE + CANONICAL_SIZE;"
);

fs.writeFileSync("src/ui/screens/SupportScreen.tsx", f, "utf-8");
console.log("Fixed imports!");