// Side effects file to prevent Vite tree-shaking of catalog data
import { SUPPORT_CATALOG_DATA } from "./support-catalog";
import { CANONICAL_ID_MAP } from "./canonical-map";

// Re-export everything to ensure it stays in the bundle
export { SUPPORT_CATALOG_DATA, CANONICAL_ID_MAP };
export const CATALOG_SIZE = Object.keys(SUPPORT_CATALOG_DATA).length;
export const CANONICAL_SIZE = Object.keys(CANONICAL_ID_MAP).length;