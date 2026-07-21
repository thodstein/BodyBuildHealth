export type DrugSupInteraction = { drug: string; substance: string; effect: string; severity: string; mechanism: string };

// DEPRECATED: merged into INTERACTIONS_DB (support-interactions-db.ts) — use findInteractionsForId() instead
export const KNOWN_DRUG_SUP_INTERACTIONS: DrugSupInteraction[] = [];
