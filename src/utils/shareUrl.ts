import type { StrategySpec } from '../types/quant';

export function encodeStrategyToShareUrl(strategy: StrategySpec): string {
  const json = JSON.stringify(strategy);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#s=${b64}`;
}

export function decodeStrategyFromUrlHash(): StrategySpec | null {
  try {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#s=')) return null;
    const raw = hash.slice(3).replace(/-/g, '+').replace(/_/g, '/');
    const pad = raw.length % 4 === 0 ? '' : '='.repeat(4 - (raw.length % 4));
    const binary = atob(raw + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as StrategySpec;
    if (
      parsed &&
      typeof parsed.name === 'string' &&
      Array.isArray(parsed.entryRules) &&
      Array.isArray(parsed.exitRules) &&
      parsed.execution
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
