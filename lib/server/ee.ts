// Faqat serverda ishlatiladi (API route'lar va scripts/).
import ee from "@google/earthengine";

let ready: Promise<void> | null = null;

export interface ServiceKey { project_id: string; client_email: string; private_key: string }
let parsedKey: ServiceKey | null = null;

/**
 * Service account kaliti GEE_SERVICE_ACCOUNT_KEY dan o'qiladi: JSON matnining o'zi yoki uning base64 ko'rinishi.
 * .env dagidek bittalik qo'shtirnoq ichida joylangan qiymat va private_key ichidagi "\n" qochirilgan holat ham qabul qilinadi.
 */
export function loadKey(): ServiceKey {
  return (parsedKey ??= parseServiceKey(process.env.GEE_SERVICE_ACCOUNT_KEY));
}

export function parseServiceKey(value: string | undefined): ServiceKey {
  let raw = (value ?? "").trim();
  if (!raw) {
    throw new Error("GEE_SERVICE_ACCOUNT_KEY muhit o‘zgaruvchisi topilmadi (Vercel: Settings → Environment Variables)");
  }
  if (raw.length > 1 && raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1).trim();
  let k: Partial<ServiceKey> | null = null;
  try {
    k = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    /* pastda umumiy xabar beriladi */
  }
  if (!k || typeof k !== "object" || !k.client_email || !k.private_key) {
    throw new Error("GEE_SERVICE_ACCOUNT_KEY formati noto‘g‘ri: service account JSON fayl matni (yoki uning base64 ko‘rinishi) kerak");
  }
  return { project_id: k.project_id ?? "", client_email: k.client_email, private_key: k.private_key.replace(/\\n/g, "\n") };
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
