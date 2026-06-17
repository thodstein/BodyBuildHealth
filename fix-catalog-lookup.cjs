const fs = require("fs");
let f = fs.readFileSync("src/ui/screens/SupportScreen.tsx", "utf-8");

// 1. Add CANONICAL_ID_MAP import after support-catalog import
const oldImport = "from '../../data/support-catalog';";
const newImport = "from '../../data/support-catalog';\nimport { CANONICAL_ID_MAP } from '../../data/canonical-map';";
f = f.replace(oldImport, newImport);

// 2. Fix renderCatalogDetail to resolve canonical ID
const oldFunc = "const renderCatalogDetail = (subId: string): React.ReactNode => {\n  const entry = SUPPORT_CATALOG_DATA[subId];\n  if (!entry) return null;";
const newFunc = "const renderCatalogDetail = (subId: string): React.ReactNode => {\n  const canonicalId = CANONICAL_ID_MAP[subId] || CANONICAL_ID_MAP[subId.toLowerCase()] || subId.toLowerCase();\n  const entry = SUPPORT_CATALOG_DATA[canonicalId] || SUPPORT_CATALOG_DATA[subId];\n  if (!entry) return null;";
f = f.replace(oldFunc, newFunc);

fs.writeFileSync("src/ui/screens/SupportScreen.tsx", f, "utf-8");
console.log("Fixed! Added CANONICAL_ID_MAP import and canonical ID resolution in renderCatalogDetail");