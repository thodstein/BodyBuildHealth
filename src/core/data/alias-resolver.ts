import { resolveLabMarker } from '../labs-mapping';

const customAliases: Record<string, string> = {};

export function resolveAlias(name: string): string {
  const custom = customAliases[name.trim().toLowerCase()];
  if (custom) return custom;
  return resolveLabMarker(name);
}

export function resolveAliases(names: string[]): string[] {
  return names.map((name) => resolveAlias(name));
}

export function addCustomAlias(alias: string, canonicalId: string): void {
  customAliases[alias.trim().toLowerCase()] = canonicalId.toUpperCase();
}