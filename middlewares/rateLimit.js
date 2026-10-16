// Limity pro jednu instanci serveru. Pro více instancí je třeba sdílené úložiště.
const buckets = new Map();

export function rateLimit({ windowMs, max, key }) {
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = key(req);
    let entry = buckets.get(bucketKey);
    if (!entry || entry.expires <= now) entry = { count: 0, expires: now + windowMs };
    entry.count += 1;
    buckets.set(bucketKey, entry);

    if (buckets.size > 20000) {
      for (const [id, record] of buckets) {
        if (record.expires <= now) buckets.delete(id);
      }
      while (buckets.size > 20000) buckets.delete(buckets.keys().next().value);
    }
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.expires - now) / 1000)));
      return res.status(429).json({ error: "Příliš mnoho požadavků. Zkus to později." });
    }
    next();
  };
}

export const limitLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  key: (req) => `login:${req.ip}:${String(req.body?.email || "").toLowerCase().slice(0, 100)}`,
});

export const limitRegistrace = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  key: (req) => `register:${req.ip}`,
});

export const limitGenerovani = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  key: (req) => `generate:${req.user.id}`,
});
