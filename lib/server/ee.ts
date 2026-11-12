// Faqat serverda ishlatiladi (API route'lar va scripts/).
import ee from "@google/earthengine";

let ready: Promise<void> | null = null;

function loadKey(): { project_id: string; client_email: string; private_key: string } {
  const raw = process.env.GEE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GEE_SERVICE_ACCOUNT_KEY muhit o‘zgaruvchisi topilmadi");
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(text);
}

export function initEE(): Promise<void> {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    const key = loadKey();
    ee.data.authenticateViaPrivateKey(
      key,
      () => ee.initialize(null, null, () => resolve(), (e: unknown) => reject(e), null, process.env.GEE_PROJECT || key.project_id),
      (e: unknown) => reject(e),
    );
  }).catch((e) => {
    ready = null;
    throw e instanceof Error ? e : new Error(String(e));
  });
  return ready;
}

export function evaluate<T>(obj: { evaluate: (cb: (r: T, e?: string) => void) => void }): Promise<T> {
  return new Promise((resolve, reject) =>
    obj.evaluate((r, e) => (e ? reject(new Error(e)) : resolve(r))),
  );
}

export function getMapUrl(image: unknown, vis: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    (image as { getMap: (v: unknown, cb: (m: { urlFormat: string } | null, e?: string) => void) => void }).getMap(
      vis,
      (m, e) => (e || !m ? reject(new Error(e || "getMap xatosi")) : resolve(m.urlFormat)),
    );
  });
}

/** Oddiy TTL kesh (serverless instance ichida) */
const cache = new Map<string, { t: number; v: Promise<unknown> }>();
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as Promise<T>;
  const v = fn().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, { t: Date.now(), v });
  return v;
}

export { ee };
