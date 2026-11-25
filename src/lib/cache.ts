const sessionCache = new Map<string, { result: string; source: 'ON_DEVICE' | 'IN_CLOUD'; timestamp: number }>();

export function getCachedResult(key: string) {
  return sessionCache.get(key) || null;
}

export function setCachedResult(key: string, result: string, source: 'ON_DEVICE' | 'IN_CLOUD') {
  sessionCache.set(key, {
    result,
    source,
    timestamp: Date.now(),
  });
}

export function buildCacheKey(mode: string, promptText: string): string {
  // Simple deterministic key
  let hash = 0;
  for (let i = 0; i < promptText.length; i++) {
    hash = (hash << 5) - hash + promptText.charCodeAt(i);
    hash |= 0;
  }
  return `${mode}:${hash}`;
}
