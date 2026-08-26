const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return { ok: true };
  }
  if (cur.n >= limit) return { ok: false };
  cur.n += 1;
  return { ok: true };
}
