import { createHmac, randomBytes } from "crypto";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";

export interface StorageProvider {
  name: string;
  put(key: string, bytes: Buffer, contentType: string): Promise<{ key: string }>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}

const root = process.env.VERCEL
  ? path.join("/tmp", "taxpilot-storage")
  : path.join(process.cwd(), "storage", "documents");

export class LocalDiskStorage implements StorageProvider {
  name = "local-disk";
  async put(key: string, bytes: Buffer) {
    const full = path.join(root, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return { key };
  }
  async get(key: string) {
    return readFile(path.join(root, key));
  }
  async delete(key: string) {
    await unlink(path.join(root, key)).catch(() => undefined);
  }
  async signedUrl(key: string, ttlSeconds: number) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = createHmac("sha256", process.env.AUTH_SECRET || "dev-only")
      .update(`${key}:${exp}`)
      .digest("hex");
    return `/api/documents/signed?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
  }
}

export function getStorage(): StorageProvider {
  return new LocalDiskStorage();
}

export function newStorageKey(userId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${Date.now()}-${randomBytes(4).toString("hex")}-${safe}`;
}
